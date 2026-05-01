using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ScorpionFlow.API.Extensions;
using ScorpionFlow.Application.DTOs;
using ScorpionFlow.Application.Interfaces;
using ScorpionFlow.Domain.Entities;
using ScorpionFlow.Domain.Enums;
using ScorpionFlow.Infrastructure.Persistence;
using DomainTaskStatus = ScorpionFlow.Domain.Enums.TaskStatus;
namespace ScorpionFlow.API.Controllers;

[Route("api/tasks")]
public class TasksController : ApiControllerBase
{
    private readonly AppDbContext _db;
    public TasksController(AppDbContext db, ICurrentUser currentUser) : base(currentUser) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TaskDto>>> Get([FromQuery] Guid? projectId, CancellationToken ct)
    {
        if (EnsureAuthenticated() is UnauthorizedObjectResult unauth) return unauth;
        var query = _db.Tasks.Where(t => t.OwnerId == OwnerId || t.Project!.ProjectMembers.Any(pm => pm.UserId == OwnerId));
        if (projectId.HasValue) query = query.Where(t => t.ProjectId == projectId.Value);
        var tasks = await query.OrderBy(t => t.Position).ThenByDescending(t => t.CreatedAt)
            .Select(t => new TaskDto(t.Id, t.ProjectId, t.Title, t.Description, t.Status.ToApiString(), t.Priority.ToApiString(), t.AssigneeId, t.AssigneeName, t.DueDate, t.BlocksProject, t.Position, t.Weight, t.BlockedReason))
            .ToListAsync(ct);
        return Ok(tasks);
    }

    [HttpPost]
    public async Task<ActionResult<TaskDto>> Create(CreateTaskRequest request, CancellationToken ct)
    {
        if (EnsureAuthenticated() is UnauthorizedObjectResult unauth) return unauth;
        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == request.ProjectId && p.OwnerId == OwnerId, ct);
        if (project is null) return BadRequest(new { message = "Proyecto no existe o no tienes permisos de escritura." });
        var task = new TaskItem
        {
            OwnerId = OwnerId,
            ProjectId = request.ProjectId,
            Title = request.Title.Trim(),
            Description = request.Description,
            Priority = EnumExtensions.ParseApiEnum<TaskPriority>(request.Priority),
            AssigneeId = request.AssigneeId,
            AssigneeName = request.AssigneeName,
            DueDate = request.DueDate,
            Weight = request.Weight <= 0 ? 1 : request.Weight
        };
        _db.Tasks.Add(task);
        await _db.SaveChangesAsync(ct);
        return Ok(new TaskDto(task.Id, task.ProjectId, task.Title, task.Description, task.Status.ToApiString(), task.Priority.ToApiString(), task.AssigneeId, task.AssigneeName, task.DueDate, task.BlocksProject, task.Position, task.Weight, task.BlockedReason));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateTaskRequest request, CancellationToken ct)
    {
        if (EnsureAuthenticated() is UnauthorizedObjectResult unauth) return unauth;
        var task = await _db.Tasks.FirstOrDefaultAsync(t => t.Id == id && t.OwnerId == OwnerId, ct);
        if (task is null) return NotFound();
        task.Title = request.Title.Trim();
        task.Description = request.Description;
        task.Status = EnumExtensions.ParseApiEnum<DomainTaskStatus>(request.Status);
        task.Priority = EnumExtensions.ParseApiEnum<TaskPriority>(request.Priority);
        task.AssigneeId = request.AssigneeId;
        task.AssigneeName = request.AssigneeName;
        task.DueDate = request.DueDate;
        task.BlocksProject = request.BlocksProject;
        task.Position = request.Position;
        task.Weight = request.Weight <= 0 ? 1 : request.Weight;
        task.BlockedReason = request.BlockedReason;
        if (task.Status == DomainTaskStatus.Blocked && task.BlockedSince is null) task.BlockedSince = DateTimeOffset.UtcNow;
        if (task.Status != DomainTaskStatus.Blocked) { task.BlockedSince = null; task.BlocksProject = false; }
        await _db.SaveChangesAsync(ct);
        await RecalculateProgress(task.ProjectId, ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        if (EnsureAuthenticated() is UnauthorizedObjectResult unauth) return unauth;
        var task = await _db.Tasks.FirstOrDefaultAsync(t => t.Id == id && t.OwnerId == OwnerId, ct);
        if (task is null) return NotFound();
        var projectId = task.ProjectId;
        _db.Tasks.Remove(task);
        await _db.SaveChangesAsync(ct);
        await RecalculateProgress(projectId, ct);
        return NoContent();
    }

    private async Task RecalculateProgress(Guid projectId, CancellationToken ct)
    {
        var project = await _db.Projects.Include(p => p.Tasks).FirstOrDefaultAsync(p => p.Id == projectId, ct);
        if (project is null || project.Tasks.Count == 0) return;
        var total = project.Tasks.Sum(t => Math.Max(1, t.Weight));
        var done = project.Tasks.Where(t => t.Status == DomainTaskStatus.Done).Sum(t => Math.Max(1, t.Weight));
        project.Progress = total == 0 ? 0 : (int)Math.Round(done * 100m / total);
        await _db.SaveChangesAsync(ct);
    }
}
