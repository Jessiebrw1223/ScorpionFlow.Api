namespace ScorpionFlow.Application.DTOs;
public sealed record TeamMemberDto(Guid Id, Guid UserId, string Email, string? FullName, string Role, bool IsActive);
public sealed record InviteMemberRequest(string Email, string Role, List<Guid> AssignedProjectIds, string? InvitedByName);
public sealed record InvitationDto(Guid Id, string Email, string Role, string Status, Guid Token, DateTimeOffset ExpiresAt, List<Guid> AssignedProjectIds);
public sealed record AcceptInvitationRequest(Guid Token);
