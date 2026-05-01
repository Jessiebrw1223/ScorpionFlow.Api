using ScorpionFlow.Domain.Common;
using ScorpionFlow.Domain.Enums;

namespace ScorpionFlow.Domain.Entities;

public class TeamInvitation : AuditableEntity
{
    public Guid OwnerId { get; set; }
    public string Email { get; set; } = string.Empty;
    public TeamRole Role { get; set; } = TeamRole.Collaborator;
    public InvitationStatus Status { get; set; } = InvitationStatus.Pending;
    public Guid Token { get; set; } = Guid.NewGuid();
    public string? InvitedByName { get; set; }
    public DateTimeOffset ExpiresAt { get; set; } = DateTimeOffset.UtcNow.AddDays(14);
    public DateTimeOffset? AcceptedAt { get; set; }
    public List<Guid> AssignedProjectIds { get; set; } = new();
}
