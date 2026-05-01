using ScorpionFlow.Domain.Common;
using ScorpionFlow.Domain.Enums;

namespace ScorpionFlow.Domain.Entities;

public class TeamMember : AuditableEntity
{
    public Guid OwnerId { get; set; }
    public Guid UserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public TeamRole Role { get; set; } = TeamRole.Collaborator;
    public bool IsActive { get; set; } = true;
    public DateTimeOffset JoinedAt { get; set; } = DateTimeOffset.UtcNow;
}
