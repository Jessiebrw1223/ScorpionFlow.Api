using System.Data;
using System.Data.Common;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Npgsql;

namespace ScorpionFlow.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private const int PasswordIterations = 120_000;
    private const int SaltSize = 16;
    private const int HashSize = 32;

    private readonly IConfiguration _configuration;

    public AuthController(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    // ================= LOGIN =================
    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login(AuthRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { message = "Email y contraseña son obligatorios." });

        await EnsureAuthSchema(ct);

        var user = await FindUserByEmail(request.Email, ct);

        if (user is null || !VerifyPassword(request.Password, user.PasswordHash))
            return Unauthorized(new { message = "Correo o contraseña incorrectos." });

        return Ok(CreateSession(user.Id, user.Email, new Dictionary<string, object>
        {
            ["full_name"] = user.FullName ?? user.Email.Split('@')[0]
        }));
    }

    // ================= REGISTER =================
    [AllowAnonymous]
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { message = "Email y contraseña son obligatorios." });

        var email = NormalizeEmail(request.Email);
        var fullName = ExtractFullName(request.Options?.Data) ?? email.Split('@')[0];

        await EnsureAuthSchema(ct);

        if (await FindUserByEmail(email, ct) is not null)
            return Conflict(new { message = "Este correo ya está registrado." });

        var id = Guid.NewGuid();
        var passwordHash = HashPassword(request.Password);

        await using var connection = await OpenConnection(ct);

        await using var cmd = connection.CreateCommand();
        cmd.CommandText = """
            insert into public.app_auth_users (id, email, password_hash, full_name)
            values (@id, @email, @password_hash, @full_name)
        """;

        AddParameter(cmd, "id", id);
        AddParameter(cmd, "email", email);
        AddParameter(cmd, "password_hash", passwordHash);
        AddParameter(cmd, "full_name", fullName);

        await cmd.ExecuteNonQueryAsync(ct);

        return Ok(CreateSession(id, email, new Dictionary<string, object>
        {
            ["full_name"] = fullName
        }));
    }

    // ================= DB CONNECTION =================
    private async Task<NpgsqlConnection> OpenConnection(CancellationToken ct)
    {
        var connString = _configuration.GetConnectionString("DefaultConnection");

        if (string.IsNullOrWhiteSpace(connString))
            throw new InvalidOperationException("DefaultConnection no está configurado.");

        var connection = new NpgsqlConnection(connString);
        await connection.OpenAsync(ct);
        return connection;
    }

    // ================= CREATE TABLE =================
    private async Task EnsureAuthSchema(CancellationToken ct)
    {
        await using var connection = await OpenConnection(ct);

        await using var cmd = connection.CreateCommand();
        cmd.CommandText = """
            create table if not exists public.app_auth_users (
                id uuid primary key,
                email text not null unique,
                password_hash text not null,
                full_name text,
                created_at timestamptz not null default now(),
                updated_at timestamptz not null default now()
            );

            create index if not exists idx_app_auth_users_email_lower
            on public.app_auth_users (lower(email));
        """;

        await cmd.ExecuteNonQueryAsync(ct);
    }

    // ================= FIND USER =================
    private async Task<AuthUserRow?> FindUserByEmail(string email, CancellationToken ct)
    {
        await using var connection = await OpenConnection(ct);

        await using var cmd = connection.CreateCommand();
        cmd.CommandText = """
            select id, email, password_hash, full_name
            from public.app_auth_users
            where lower(email) = lower(@email)
            limit 1
        """;

        AddParameter(cmd, "email", NormalizeEmail(email));

        await using var reader = await cmd.ExecuteReaderAsync(ct);

        if (!await reader.ReadAsync(ct))
            return null;

        return new AuthUserRow(
            reader.GetGuid(0),
            reader.GetString(1),
            reader.GetString(2),
            reader.IsDBNull(3) ? null : reader.GetString(3)
        );
    }

    // ================= JWT =================
    private object CreateSession(Guid userId, string email, IDictionary<string, object>? metadata)
    {
        var user = CreateUser(userId, email, metadata);
        var token = CreateJwt(userId, email);

        return new
        {
            access_token = token,
            token_type = "bearer",
            expires_in = 60 * 60 * 24 * 7,
            user
        };
    }

    private static object CreateUser(Guid userId, string email, IDictionary<string, object>? metadata)
    {
        return new
        {
            id = userId,
            email = NormalizeEmail(email),
            user_metadata = metadata ?? new Dictionary<string, object>(),
            app_metadata = new { provider = "scorpionflow-api" }
        };
    }

    private string CreateJwt(Guid userId, string email)
    {
        var secret = _configuration["Jwt:Secret"] ?? "dev-secret";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, NormalizeEmail(email)),
            new Claim(ClaimTypes.Email, NormalizeEmail(email))
        };

        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    // ================= PASSWORD =================
    private static string HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, PasswordIterations, HashAlgorithmName.SHA256, HashSize);

        return $"pbkdf2${PasswordIterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    private static bool VerifyPassword(string password, string storedHash)
    {
        var parts = storedHash.Split('$');
        if (parts.Length != 4) return false;

        var iterations = int.Parse(parts[1]);
        var salt = Convert.FromBase64String(parts[2]);
        var expected = Convert.FromBase64String(parts[3]);

        var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, expected.Length);

        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }

    // ================= UTILS =================
    private static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    private static string? ExtractFullName(IDictionary<string, object>? data)
    {
        if (data is null) return null;
        if (!data.TryGetValue("full_name", out var value)) return null;
        var text = value?.ToString()?.Trim();
        return string.IsNullOrWhiteSpace(text) ? null : text;
    }

    private static void AddParameter(DbCommand cmd, string name, object? value)
    {
        var p = cmd.CreateParameter();
        p.ParameterName = name;
        p.Value = value ?? DBNull.Value;
        cmd.Parameters.Add(p);
    }

    private sealed record AuthUserRow(Guid Id, string Email, string PasswordHash, string? FullName);
}

// ================= REQUEST MODELS =================

public record AuthRequest(string Email, string Password, IDictionary<string, object>? Metadata = null);

public record RegisterRequest(string Email, string Password, RegisterOptions? Options = null);

public record RegisterOptions(IDictionary<string, object>? Data = null);

public record ForgotPasswordRequest(string Email, string? RedirectTo = null);

public record UpdateUserRequest(string? Password = null, IDictionary<string, object>? Data = null);