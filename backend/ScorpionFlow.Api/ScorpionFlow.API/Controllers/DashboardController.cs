using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ScorpionFlow.Application.DTOs;
using ScorpionFlow.Application.Interfaces;
using ScorpionFlow.Infrastructure.Persistence;

namespace ScorpionFlow.API.Controllers;

[Route("api/dashboard")]
public class DashboardController : ApiControllerBase
{
    private readonly AppDbContext _db;
    public DashboardController(AppDbContext db, ICurrentUser currentUser) : base(currentUser) => _db = db;

    [HttpGet("summary")]
    public async Task<ActionResult<DashboardSummaryDto>> Summary(CancellationToken ct)
    {
        if (EnsureAuthenticated() is UnauthorizedObjectResult unauth) return unauth;
        var clients = await _db.Clients.CountAsync(c => c.OwnerId == OwnerId, ct);
        var projects = await _db.Projects.Where(p => p.OwnerId == OwnerId).ToListAsync(ct);
        var tasks = await _db.Tasks.Where(t => t.OwnerId == OwnerId).ToListAsync(ct);
        var totalBudget = projects.Sum(p => p.Budget);
        var actualCost = projects.Sum(p => p.ActualCost);
        var profitability = totalBudget - actualCost;
        return Ok(new DashboardSummaryDto(
            clients,
            projects.Count,
            tasks.Count,
            tasks.Count(t => t.Status == Domain.Enums.TaskStatus.Done),
            tasks.Count(t => t.Status == Domain.Enums.TaskStatus.Blocked),
            totalBudget,
            actualCost,
            profitability));
    }
}
