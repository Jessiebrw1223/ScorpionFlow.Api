using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ScorpionFlow.API.Controllers;

[AllowAnonymous]
[ApiController]
[Route("api/email-unsubscribe")]
public class EmailUnsubscribeController : ControllerBase
{
    [HttpGet]
    public IActionResult Validate([FromQuery] string? token)
    {
        if (string.IsNullOrWhiteSpace(token)) return BadRequest(new { valid = false, reason = "missing_token" });
        return Ok(new { valid = true });
    }

    [HttpPost]
    public IActionResult Confirm(UnsubscribeRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Token)) return BadRequest(new { success = false, reason = "missing_token" });
        return Ok(new { success = true });
    }
}

public record UnsubscribeRequest(string Token);
