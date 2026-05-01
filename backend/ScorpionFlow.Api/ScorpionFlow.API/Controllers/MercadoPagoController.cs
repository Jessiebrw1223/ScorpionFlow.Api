using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

namespace ScorpionFlow.API.Controllers;

[ApiController]
[Route("api/mercadopago")]
public class MercadoPagoController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _httpClientFactory;

    public MercadoPagoController(IConfiguration config, IHttpClientFactory httpClientFactory)
    {
        _config = config;
        _httpClientFactory = httpClientFactory;
    }

    [HttpPost("create-preference")]
    public async Task<IActionResult> CreatePreference()
    {
        var token = _config["MERCADOPAGO_ACCESS_TOKEN"];
        if (string.IsNullOrWhiteSpace(token))
            return BadRequest(new { message = "Mercado Pago token no configurado." });

        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var body = new
        {
            items = new[]
            {
                new
                {
                    title = "ScorpionFlow Pro Mensual",
                    quantity = 1,
                    unit_price = 27.00m,
                    currency_id = "PEN"
                }
            },
            back_urls = new
            {
                success = "https://scorpion-flow.com/billing/success",
                failure = "https://scorpion-flow.com/billing/failure",
                pending = "https://scorpion-flow.com/billing/pending"
            },
            auto_return = "approved",
            notification_url = "https://scorpionflow-api.onrender.com/api/mercadopago/webhook"
        };

        var json = JsonSerializer.Serialize(body);
        var response = await client.PostAsync(
            "https://api.mercadopago.com/checkout/preferences",
            new StringContent(json, Encoding.UTF8, "application/json")
        );

        var content = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
            return StatusCode((int)response.StatusCode, content);

        return Content(content, "application/json");
    }

    [HttpPost("webhook")]
    public async Task<IActionResult> Webhook([FromBody] JsonElement payload)
    {
        Console.WriteLine(payload.ToString());
        return Ok();
    }
}