using ScorpionFlow.Domain.Common;
using ScorpionFlow.Domain.Enums;

namespace ScorpionFlow.Domain.Entities;

public class Project : AuditableEntity
{
    public Guid OwnerId { get; set; }
    public Guid ClientId { get; set; }
    public Guid? QuotationId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public ProjectStatus Status { get; set; } = ProjectStatus.OnTrack;
    public int Progress { get; set; }
    public decimal Budget { get; set; }
    public decimal ActualCost { get; set; }
    public string Currency { get; set; } = "PEN";
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public Client? Client { get; set; }
    public ICollection<TaskItem> Tasks { get; set; } = new List<TaskItem>();
    public ICollection<ProjectMember> ProjectMembers { get; set; } = new List<ProjectMember>();
    public ICollection<ProjectResource> Resources { get; set; } = new List<ProjectResource>();
}
