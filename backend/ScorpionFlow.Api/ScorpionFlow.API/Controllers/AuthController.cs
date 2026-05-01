using System.Data;
using System.Data.Common;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using ScorpionFlow.Infrastructure.Persistence;

namespace ScorpionFlow.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private const int PasswordIterations = 120_000;
    private const int SaltSize = 16;
    private const int HashSize = 32;

    private readonly IConfiguration _configuration;
    private readonly AppDbContext _db;

    public AuthController(IConfiguration configuration, AppDbContext db)
    {
        _configuration = configuration;
        _db = db;
    }

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

        await using var connection = _db.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open) await connection.OpenAsync(ct);

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

    [AllowAnonymous]
    [HttpGet("google")]
    public IActionResult GoogleOAuth()
    {
        return StatusCode(StatusCodes.Status501NotImplemented, new
        {
            message = "Google OAuth está deshabilitado temporalmente. Usa email y contraseña."
        });
    }

    [AllowAnonymous]
    [HttpPost("forgot-password")]
    public IActionResult ForgotPassword(ForgotPasswordRequest request)
    {
        return Ok(new
        {
            message = "Solicitud recibida. Configura proveedor transaccional para envío real."
        });
    }

    [Authorize]
    [HttpPut("me")]
    public IActionResult UpdateMe(UpdateUserRequest request)
    {
        var email =
            User.FindFirstValue(ClaimTypes.Email) ??
            User.FindFirstValue(JwtRegisteredClaimNames.Email) ??
            "user@scorpionflow.local";

        var userIdText = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        var userId = Guid.TryParse(userIdText, out var parsed) ? parsed : DeterministicGuid(email);

        return Ok(CreateUser(userId, email, request.Data));
    }

    private async Task EnsureAuthSchema(CancellationToken ct)
    {
        await using var connection = _db.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open) await connection.OpenAsync(ct);

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

    private async Task<AuthUserRow?> FindUserByEmail(string email, CancellationToken ct)
    {
        await using var connection = _db.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open) await connection.OpenAsync(ct);

        await using var cmd = connection.CreateCommand();
        cmd.CommandText = """
            select id, email, password_hash, full_name
            from public.app_auth_users
            where lower(email) = lower(@email)
            limit 1
        """;
        AddParameter(cmd, "email", NormalizeEmail(email));

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        return new AuthUserRow(
            reader.GetGuid(0),
            reader.GetString(1),
            reader.GetString(2),
            reader.IsDBNull(3) ? null : reader.GetString(3)
        );
    }

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
        var normalizedEmail = NormalizeEmail(email);

        return new
        {
            id = userId,
            email = normalizedEmail,
            user_metadata = metadata ?? new Dictionary<string, object>(),
            app_metadata = new { provider = "scorpionflow-api" }
        };
    }

    private string CreateJwt(Guid userId, string email)
    {
        var secret = _configuration["Jwt:Secret"] ?? "dev-only-change-this-secret-before-deploy";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

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
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var hash = Rfc2898DeriveBytes.Pbkdf2(
            password,
            salt,
            PasswordIterations,
            HashAlgorithmName.SHA256,
            HashSize
        );

        return $"pbkdf2${PasswordIterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    private static bool VerifyPassword(string password, string storedHash)
    {
        var parts = storedHash.Split('$');
        if (parts.Length != 4 || parts[0] != "pbkdf2") return false;
        if (!int.TryParse(parts[1], out var iterations)) return false;

        var salt = Convert.FromBase64String(parts[2]);
        var expectedHash = Convert.FromBase64String(parts[3]);
        var actualHash = Rfc2898DeriveBytes.Pbkdf2(
            password,
            salt,
            iterations,
            HashAlgorithmName.SHA256,
            expectedHash.Length
        );

        return CryptographicOperations.FixedTimeEquals(actualHash, expectedHash);
    }

    private static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    private static string? ExtractFullName(IDictionary<string, object>? data)
    {
        if (data is null) return null;
        if (!data.TryGetValue("full_name", out var value)) return null;
        var text = value?.ToString()?.Trim();
        return string.IsNullOrWhiteSpace(text) ? null : text;
    }

    private static Guid DeterministicGuid(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return new Guid(bytes.Take(16).ToArray());
    }

    private static void AddParameter(DbCommand cmd, string name, object? value)
    {
        var parameter = cmd.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value ?? DBNull.Value;
        cmd.Parameters.Add(parameter);
    }

    private sealed record AuthUserRow(Guid Id, string Email, string PasswordHash, string? FullName);
}

public record AuthRequest(string Email, string Password, IDictionary<string, object>? Metadata = null);

public record RegisterRequest(string Email, string Password, RegisterOptions? Options = null);

public record RegisterOptions(IDictionary<string, object>? Data = null);

public record ForgotPasswordRequest(string Email, string? RedirectTo = null);

public record UpdateUserRequest(string? Password = null, IDictionary<string, object>? Data = null);
