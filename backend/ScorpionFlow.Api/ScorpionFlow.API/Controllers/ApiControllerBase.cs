using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ScorpionFlow.Application.Interfaces;

namespace ScorpionFlow.API.Controllers;

[Authorize]
[ApiController]
public abstract class ApiControllerBase : ControllerBase
{
    protected readonly ICurrentUser CurrentUser;
    protected ApiControllerBase(ICurrentUser currentUser) => CurrentUser = currentUser;
    protected Guid OwnerId => CurrentUser.UserId;

    protected IActionResult EnsureAuthenticated()
    {
        if (!CurrentUser.IsAuthenticated || CurrentUser.UserId == Guid.Empty)
            return Unauthorized(new { message = "Token JWT inválido o ausente." });
        return Ok();
    }
}
