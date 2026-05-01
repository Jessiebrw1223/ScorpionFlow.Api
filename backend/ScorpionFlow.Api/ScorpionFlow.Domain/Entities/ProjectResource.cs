using ScorpionFlow.Domain.Common;

namespace ScorpionFlow.Domain.Entities;

public class ProjectResource : AuditableEntity
{
    public Guid OwnerId { get; set; }
    public Guid ProjectId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = "human";
    public decimal Cost { get; set; }
    public string Currency { get; set; } = "PEN";
    public string? Description { get; set; }
    public Project? Project { get; set; }
}
