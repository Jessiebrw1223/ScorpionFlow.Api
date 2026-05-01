using System.Data;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ScorpionFlow.Application.Interfaces;
using ScorpionFlow.Infrastructure.Persistence;

namespace ScorpionFlow.API.Controllers;

[Route("api/data/{table}")]
public class DataController : ApiControllerBase
{
    private static readonly HashSet<string> AllowedTables = new(StringComparer.OrdinalIgnoreCase)
    {
        "profiles", "clients", "projects", "tasks", "project_resources", "project_contributions",
        "quotations", "quotation_items", "team_members", "team_invitations", "project_members",
        "account_subscriptions", "notifications", "user_roles", "user_settings", "email_send_log",
        "admin_audit_logs", "subscription_events"
    };

    private static readonly HashSet<string> PublicTables = new(StringComparer.OrdinalIgnoreCase)
    {
        "profiles"
    };

    private readonly AppDbContext _db;
    public DataController(AppDbContext db, ICurrentUser currentUser) : base(currentUser) => _db = db;

    [HttpPost("query")]
    public async Task<IActionResult> Query(string table, DataQueryRequest request, CancellationToken ct)
    {
        if (!IsTableAllowed(table)) return BadRequest(new { message = "Tabla no permitida." });
        if (!PublicTables.Contains(table) && EnsureAuthenticated() is UnauthorizedObjectResult unauth) return unauth;

        await using var connection = _db.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open) await connection.OpenAsync(ct);

        var where = BuildWhere(request.Filters, out var parameters);
        var count = request.Count is not null ? await ExecuteScalarCount(connection, table, where.Sql, parameters, ct) : (int?)null;

        if (request.Head) return Ok(new { data = Array.Empty<object>(), count });

        var sql = $"select * from \"{table}\"{where.Sql}";
        if (request.OrderBy is not null && IsSafeIdentifier(request.OrderBy.Column))
            sql += $" order by \"{request.OrderBy.Column}\" {(request.OrderBy.Ascending ? "asc" : "desc")}";
        if (request.Limit.HasValue) sql += $" limit {Math.Clamp(request.Limit.Value, 1, 500)}";
        if (request.Single is "single" or "maybeSingle") sql += " limit 1";

        var rows = await ExecuteRows(connection, sql, parameters, ct);
        object? data = request.Single is "single" or "maybeSingle" ? rows.FirstOrDefault() : rows;
        return Ok(new { data, count });
    }

    [HttpPost("insert")]
    public async Task<IActionResult> Insert(string table, DataQueryRequest request, CancellationToken ct)
    {
        if (!IsTableAllowed(table)) return BadRequest(new { message = "Tabla no permitida." });
        if (EnsureAuthenticated() is UnauthorizedObjectResult unauth) return unauth;

        var items = NormalizePayload(request.Payload);
        if (items.Count == 0) return BadRequest(new { message = "Payload vacío." });

        await using var connection = _db.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open) await connection.OpenAsync(ct);

        var inserted = new List<Dictionary<string, object?>>();
        foreach (var item in items)
        {
            AddOwnerIfMissing(item);
            var columns = item.Keys.Where(IsSafeIdentifier).ToList();
            var values = columns.Select((c, i) => $"@p{i}").ToList();
            var sql = $"insert into \"{table}\" ({string.Join(",", columns.Select(c => $"\"{c}\""))}) values ({string.Join(",", values)}) returning *";
            inserted.AddRange(await ExecuteRows(connection, sql, columns.Select(c => item[c]).ToList(), ct));
        }

        object? data = request.Single is "single" or "maybeSingle"
    ? inserted.FirstOrDefault()
    : inserted;

return Ok(new { data, count = inserted.Count });
    }

    [HttpPost("upsert")]
    public async Task<IActionResult> Upsert(string table, DataQueryRequest request, CancellationToken ct)
    {
        // Puente seguro: si viene id actualiza; si no, inserta.
        var items = NormalizePayload(request.Payload);
        if (items.Count == 1 && items[0].TryGetValue("id", out var id) && id is not null)
        {
            request.Filters = new List<DataFilter> { new("id", "eq", JsonSerializer.SerializeToElement(id)) };
            request.Payload = JsonSerializer.SerializeToElement(items[0]);
            return await Update(table, request, ct);
        }
        return await Insert(table, request, ct);
    }

    [HttpPost("update")]
    public async Task<IActionResult> Update(string table, DataQueryRequest request, CancellationToken ct)
    {
        if (!IsTableAllowed(table)) return BadRequest(new { message = "Tabla no permitida." });
        if (EnsureAuthenticated() is UnauthorizedObjectResult unauth) return unauth;

        var item = NormalizePayload(request.Payload).FirstOrDefault();
        if (item is null) return BadRequest(new { message = "Payload vacío." });

        await using var connection = _db.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open) await connection.OpenAsync(ct);

        var where = BuildWhere(request.Filters, out var whereParams);
        if (string.IsNullOrWhiteSpace(where.Sql)) return BadRequest(new { message = "Update requiere filtros." });

        var columns = item.Keys.Where(IsSafeIdentifier).Where(k => !string.Equals(k, "id", StringComparison.OrdinalIgnoreCase)).ToList();
        var setSql = string.Join(",", columns.Select((c, i) => $"\"{c}\" = @p{i}"));
        var parameters = columns.Select(c => item[c]).Concat(whereParams).ToList();
        var fixedWhere = ReindexWhere(where.Sql, columns.Count);
        var sql = $"update \"{table}\" set {setSql}{fixedWhere} returning *";
        var rows = await ExecuteRows(connection, sql, parameters, ct);
        object? data = request.Single is "single" or "maybeSingle"
    ? rows.FirstOrDefault()
    : rows;

return Ok(new { data, count = rows.Count });
    }

    [HttpPost("delete")]
    public async Task<IActionResult> Delete(string table, DataQueryRequest request, CancellationToken ct)
    {
        if (!IsTableAllowed(table)) return BadRequest(new { message = "Tabla no permitida." });
        if (EnsureAuthenticated() is UnauthorizedObjectResult unauth) return unauth;

        await using var connection = _db.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open) await connection.OpenAsync(ct);
        var where = BuildWhere(request.Filters, out var parameters);
        if (string.IsNullOrWhiteSpace(where.Sql)) return BadRequest(new { message = "Delete requiere filtros." });
        var sql = $"delete from \"{table}\"{where.Sql} returning *";
        var rows = await ExecuteRows(connection, sql, parameters, ct);
        return Ok(new { data = rows, count = rows.Count });
    }

    private bool IsTableAllowed(string table) => IsSafeIdentifier(table) && AllowedTables.Contains(table);
    private static bool IsSafeIdentifier(string value) => !string.IsNullOrWhiteSpace(value) && value.All(c => char.IsLetterOrDigit(c) || c == '_');

    private void AddOwnerIfMissing(Dictionary<string, object?> item)
    {
        if (!item.ContainsKey("owner_id") && CurrentUser.IsAuthenticated && CurrentUser.UserId != Guid.Empty)
            item["owner_id"] = CurrentUser.UserId;
    }

    private static List<Dictionary<string, object?>> NormalizePayload(JsonElement? payload)
    {
        if (payload is null) return new();
        var element = payload.Value;
        if (element.ValueKind == JsonValueKind.Array)
            return element.EnumerateArray().Select(ToDictionary).ToList();
        if (element.ValueKind == JsonValueKind.Object)
            return new List<Dictionary<string, object?>> { ToDictionary(element) };
        return new();
    }

    private static Dictionary<string, object?> ToDictionary(JsonElement element)
    {
        var dict = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        foreach (var prop in element.EnumerateObject()) dict[prop.Name] = ToClr(prop.Value);
        return dict;
    }

    private static object? ToClr(JsonElement value) => value.ValueKind switch
    {
        JsonValueKind.Null => DBNull.Value,
        JsonValueKind.Undefined => DBNull.Value,
        JsonValueKind.String => value.TryGetGuid(out var g) ? g : value.GetString(),
        JsonValueKind.Number => value.TryGetInt64(out var l) ? l : value.GetDecimal(),
        JsonValueKind.True => true,
        JsonValueKind.False => false,
        _ => value.GetRawText()
    };

    private static (string Sql, List<object?> Parameters) BuildWhere(List<DataFilter>? filters, out List<object?> parameters)
    {
        parameters = new List<object?>();
        if (filters is null || filters.Count == 0) return ("", parameters);
        var clauses = new List<string>();
        foreach (var filter in filters.Where(f => IsSafeIdentifier(f.Column)))
        {
            var index = parameters.Count;
            var op = filter.Op.ToLowerInvariant();
            if (op == "is" && filter.Value.ValueKind == JsonValueKind.Null)
            {
                clauses.Add($"\"{filter.Column}\" is null");
                continue;
            }
            if (op == "in" && filter.Value.ValueKind == JsonValueKind.Array)
            {
                var values = filter.Value.EnumerateArray().Select(ToClr).ToList();
                var names = new List<string>();
                foreach (var v in values)
                {
                    names.Add($"@p{parameters.Count}");
                    parameters.Add(v);
                }
                clauses.Add($"\"{filter.Column}\" in ({string.Join(",", names)})");
                continue;
            }
            var sqlOp = op switch { "eq" => "=", "neq" => "<>", "gt" => ">", "gte" => ">=", "lt" => "<", "lte" => "<=", "ilike" => "ilike", _ => "=" };
            clauses.Add($"\"{filter.Column}\" {sqlOp} @p{index}");
            parameters.Add(ToClr(filter.Value));
        }
        return clauses.Count == 0 ? ("", parameters) : ($" where {string.Join(" and ", clauses)}", parameters);
    }

    private static string ReindexWhere(string sql, int offset)
    {
        for (var i = 50; i >= 0; i--) sql = sql.Replace($"@p{i}", $"@p{i + offset}");
        return sql;
    }

    private static async Task<int> ExecuteScalarCount(System.Data.Common.DbConnection connection, string table, string whereSql, List<object?> parameters, CancellationToken ct)
    {
        await using var cmd = connection.CreateCommand();
        cmd.CommandText = $"select count(*) from \"{table}\"{whereSql}";
        AddParameters(cmd, parameters);
        var result = await cmd.ExecuteScalarAsync(ct);
        return Convert.ToInt32(result);
    }

    private static async Task<List<Dictionary<string, object?>>> ExecuteRows(System.Data.Common.DbConnection connection, string sql, List<object?> parameters, CancellationToken ct)
    {
        await using var cmd = connection.CreateCommand();
        cmd.CommandText = sql;
        AddParameters(cmd, parameters);
        var rows = new List<Dictionary<string, object?>>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var row = new Dictionary<string, object?>();
            for (var i = 0; i < reader.FieldCount; i++) row[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
            rows.Add(row);
        }
        return rows;
    }

    private static void AddParameters(System.Data.Common.DbCommand cmd, List<object?> parameters)
    {
        for (var i = 0; i < parameters.Count; i++)
        {
            var p = cmd.CreateParameter();
            p.ParameterName = $"p{i}";
            p.Value = parameters[i] ?? DBNull.Value;
            cmd.Parameters.Add(p);
        }
    }
}

public class DataQueryRequest
{
    public string? Select { get; set; }
    public List<DataFilter>? Filters { get; set; }
    public DataOrder? OrderBy { get; set; }
    public int? Limit { get; set; }
    public string? Single { get; set; }
    public string? Count { get; set; }
    public bool Head { get; set; }
    public JsonElement? Payload { get; set; }
}

public record DataFilter(string Column, string Op, JsonElement Value);
public record DataOrder(string Column, bool Ascending = true);
