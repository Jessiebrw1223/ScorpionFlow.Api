using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ScorpionFlow.API.Extensions;
using ScorpionFlow.Application.DTOs;
using ScorpionFlow.Application.Interfaces;
using ScorpionFlow.Domain.Entities;
using ScorpionFlow.Domain.Enums;
using ScorpionFlow.Infrastructure.Persistence;

namespace ScorpionFlow.API.Controllers;

[Route("api/projects")]
public class ProjectsController : ApiControllerBase
{
    private readonly AppDbContext _db;
    public ProjectsController(AppDbContext db, ICurrentUser currentUser) : base(currentUser) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProjectDto>>> Get(CancellationToken ct)
    {
        if (EnsureAuthenticated() is UnauthorizedObjectResult unauth) return unauth;
        var projects = await _db.Projects
            .Where(p => p.OwnerId == OwnerId || p.ProjectMembers.Any(pm => pm.UserId == OwnerId))
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new ProjectDto(p.Id, p.ClientId, p.Name, p.Description, p.Status.ToApiString(), p.Progress, p.Budget, p.ActualCost, p.Currency, p.StartDate, p.EndDate))
            .ToListAsync(ct);
        return Ok(projects);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProjectDto>> GetById(Guid id, CancellationToken ct)
    {
        if (EnsureAuthenticated() is UnauthorizedObjectResult unauth) return unauth;
        var p = await _db.Projects.FirstOrDefaultAsync(x => x.Id == id && (x.OwnerId == OwnerId || x.ProjectMembers.Any(pm => pm.UserId == OwnerId)), ct);
        if (p is null) return NotFound();
        return new ProjectDto(p.Id, p.ClientId, p.Name, p.Description, p.Status.ToApiString(), p.Progress, p.Budget, p.ActualCost, p.Currency, p.StartDate, p.EndDate);
    }

    [HttpPost]
    public async Task<ActionResult<ProjectDto>> Create(CreateProjectRequest request, CancellationToken ct)
    {
        if (EnsureAuthenticated() is UnauthorizedObjectResult unauth) return unauth;
        var project = new Project
        {
            OwnerId = OwnerId,
            ClientId = request.ClientId,
            QuotationId = request.QuotationId,
            Name = request.Name.Trim(),
            Description = request.Description,
            Budget = request.Budget,
            Currency = string.IsNullOrWhiteSpace(request.Currency) ? "PEN" : request.Currency,
            StartDate = request.StartDate,
            EndDate = request.EndDate
        };
        _db.Projects.Add(project);
        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetById), new { id = project.Id }, new ProjectDto(project.Id, project.ClientId, project.Name, project.Description, project.Status.ToApiString(), project.Progress, project.Budget, project.ActualCost, project.Currency, project.StartDate, project.EndDate));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateProjectRequest request, CancellationToken ct)
    {
        if (EnsureAuthenticated() is UnauthorizedObjectResult unauth) return unauth;
        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id && p.OwnerId == OwnerId, ct);
        if (project is null) return NotFound();
        project.Name = request.Name.Trim();
        project.Description = request.Description;
        project.Status = EnumExtensions.ParseApiEnum<ProjectStatus>(request.Status);
        project.Budget = request.Budget;
        project.ActualCost = request.ActualCost;
        project.Currency = request.Currency;
        project.StartDate = request.StartDate;
        project.EndDate = request.EndDate;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        if (EnsureAuthenticated() is UnauthorizedObjectResult unauth) return unauth;
        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id && p.OwnerId == OwnerId, ct);
        if (project is null) return NotFound();
        _db.Projects.Remove(project);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
