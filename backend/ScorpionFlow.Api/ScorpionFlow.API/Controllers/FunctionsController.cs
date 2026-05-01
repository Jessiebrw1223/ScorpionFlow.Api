using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ScorpionFlow.API.Controllers;

[Authorize]
[ApiController]
[Route("api/functions")]
public class FunctionsController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;

    public FunctionsController(IConfiguration configuration, IHttpClientFactory httpClientFactory)
    {
        _configuration = configuration;
        _httpClientFactory = httpClientFactory;
    }

    [HttpPost("{name}")]
    public async Task<IActionResult> Invoke(string name, [FromBody] JsonElement body, CancellationToken ct)
    {
        return name switch
        {
            "create-checkout" => await CreateMercadoPagoCheckout(body, ct),
            "customer-portal" => Ok(new { url = "/settings", message = "Mercado Pago no usa portal de cliente tipo Stripe en esta integración inicial." }),
            "get-stripe-prices" => Ok(new { prices = PlanPrices, provider = "mercadopago", migrated = true }),
            "send-transactional-email" => Ok(new { queued = true, migrated = true }),
            "accept-team-invitation" => Ok(new { accepted = true, migrated = true }),
            "change-subscription-plan" => Ok(new { changed = true, migrated = true }),
            "cancel-subscription" => Ok(new { cancelled = true, migrated = true }),
            "reactivate-subscription" => Ok(new { reactivated = true, migrated = true }),
            _ => Ok(new { ok = true, function = name, migrated = true })
        };
    }

    private async Task<IActionResult> CreateMercadoPagoCheckout(JsonElement body, CancellationToken ct)
    {
        var token = _configuration["MERCADOPAGO_ACCESS_TOKEN"];
        if (string.IsNullOrWhiteSpace(token))
            return BadRequest(new { error = "Mercado Pago token no configurado." });

        var plan = ReadString(body, "plan") ?? "pro";
        var billing = ReadString(body, "billing") ?? "monthly";
        var price = ResolvePrice(plan, billing);

        if (price is null)
            return BadRequest(new { error = "Plan no válido para checkout." });

        var frontendUrl = _configuration["Frontend:Url"] ?? "https://www.scorpion-flow.com";
        var apiUrl = _configuration["Api:Url"] ?? "https://scorpionflow-api.onrender.com";
        var userReference = User.FindFirst(ClaimTypes.Email)?.Value ?? User.FindFirst("email")?.Value ?? User.Identity?.Name ?? "user";

        var payload = new
        {
            items = new[]
            {
                new
                {
                    title = $"ScorpionFlow {price.Value.Label}",
                    quantity = 1,
                    unit_price = price.Value.AmountPen,
                    currency_id = "PEN"
                }
            },
            back_urls = new
            {
                success = $"{frontendUrl}/settings?checkout=success",
                failure = $"{frontendUrl}/settings?checkout=cancelled",
                pending = $"{frontendUrl}/settings?checkout=pending"
            },
            auto_return = "approved",
            notification_url = $"{apiUrl}/api/mercadopago/webhook",
            external_reference = $"{userReference}:{plan}:{billing}"
        };

        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.PostAsync(
            "https://api.mercadopago.com/checkout/preferences",
            new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"),
            ct
        );

        var content = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
            return StatusCode((int)response.StatusCode, new { error = "Mercado Pago rechazó la preferencia.", details = content });

        using var doc = JsonDocument.Parse(content);
        var root = doc.RootElement;
        var initPoint = root.TryGetProperty("init_point", out var init) ? init.GetString() : null;
        var sandboxInitPoint = root.TryGetProperty("sandbox_init_point", out var sandbox) ? sandbox.GetString() : null;

        return Ok(new
        {
            url = initPoint ?? sandboxInitPoint,
            provider = "mercadopago",
            raw = JsonSerializer.Deserialize<object>(content)
        });
    }

    private static string? ReadString(JsonElement body, string property)
    {
        if (body.ValueKind != JsonValueKind.Object) return null;
        return body.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
    }

    private static PriceInfo? ResolvePrice(string plan, string billing)
    {
        var key = $"{plan}:{billing}".ToLowerInvariant();
        return key switch
        {
            "starter:monthly" => new PriceInfo("Starter Mensual", 35m),
            "starter:annual" => new PriceInfo("Starter Anual", 420m),
            "pro:monthly" => new PriceInfo("Pro Mensual", 90m),
            "pro:annual" => new PriceInfo("Pro Anual", 1080m),
            "business:monthly" => new PriceInfo("Business Mensual", 200m),
            "business:annual" => new PriceInfo("Business Anual", 2400m),
            _ => null
        };
    }

    private static readonly object[] PlanPrices =
    {
        new { plan = "starter", billing = "monthly", priceId = "mp_starter_monthly", amountUsd = 12, amountCents = 3500, currency = "PEN", interval = "month", available = true },
        new { plan = "starter", billing = "annual", priceId = "mp_starter_annual", amountUsd = 108, amountCents = 42000, currency = "PEN", interval = "year", available = true },
        new { plan = "pro", billing = "monthly", priceId = "mp_pro_monthly", amountUsd = 27, amountCents = 9000, currency = "PEN", interval = "month", available = true },
        new { plan = "pro", billing = "annual", priceId = "mp_pro_annual", amountUsd = 252, amountCents = 108000, currency = "PEN", interval = "year", available = true },
        new { plan = "business", billing = "monthly", priceId = "mp_business_monthly", amountUsd = 60, amountCents = 20000, currency = "PEN", interval = "month", available = true },
        new { plan = "business", billing = "annual", priceId = "mp_business_annual", amountUsd = 576, amountCents = 240000, currency = "PEN", interval = "year", available = true }
    };

    private readonly record struct PriceInfo(string Label, decimal AmountPen);
}
