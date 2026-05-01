using ScorpionFlow.Domain.Common;
using ScorpionFlow.Domain.Enums;

namespace ScorpionFlow.Domain.Entities;

public class ProjectMember : AuditableEntity
{
    public Guid ProjectId { get; set; }
    public Guid UserId { get; set; }
    public TeamRole Role { get; set; } = TeamRole.Collaborator;
    public Project? Project { get; set; }
}
