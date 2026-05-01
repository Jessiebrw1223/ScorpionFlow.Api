using ScorpionFlow.Domain.Common;
using ScorpionFlow.Domain.Enums;
using DomainTaskStatus = ScorpionFlow.Domain.Enums.TaskStatus;

namespace ScorpionFlow.Domain.Entities;

public class TaskItem : AuditableEntity
{
    public Guid OwnerId { get; set; }
    public Guid ProjectId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }

    public DomainTaskStatus Status { get; set; } = DomainTaskStatus.Todo;

    public TaskPriority Priority { get; set; } = TaskPriority.Medium;
    public Guid? AssigneeId { get; set; }
    public string? AssigneeName { get; set; }
    public DateOnly? DueDate { get; set; }
    public bool BlocksProject { get; set; }
    public DateTimeOffset? BlockedSince { get; set; }
    public int Position { get; set; }
    public int Weight { get; set; } = 1;
    public string? BlockedReason { get; set; }
    public Project? Project { get; set; }
}