using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ScorpionFlow.API.Extensions;
using ScorpionFlow.Application.DTOs;
using ScorpionFlow.Application.Interfaces;
using ScorpionFlow.Domain.Entities;
using ScorpionFlow.Domain.Enums;
using ScorpionFlow.Infrastructure.Persistence;

namespace ScorpionFlow.API.Controllers;

[Route("api/team")]
public class TeamController : ApiControllerBase
{
    private readonly AppDbContext _db;
    public TeamController(AppDbContext db, ICurrentUser currentUser) : base(currentUser) => _db = db;

    [HttpGet("members")]
    public async Task<ActionResult<IReadOnlyList<TeamMemberDto>>> Members(CancellationToken ct)
    {
        if (EnsureAuthenticated() is UnauthorizedObjectResult unauth) return unauth;
        var members = await _db.TeamMembers.Where(m => m.OwnerId == OwnerId)
            .OrderBy(m => m.Email)
            .Select(m => new TeamMemberDto(m.Id, m.UserId, m.Email, m.FullName, m.Role.ToApiString(), m.IsActive))
            .ToListAsync(ct);
        return Ok(members);
    }

    [HttpGet("invitations")]
    public async Task<ActionResult<IReadOnlyList<InvitationDto>>> Invitations(CancellationToken ct)
    {
        if (EnsureAuthenticated() is UnauthorizedObjectResult unauth) return unauth;
        var invitations = await _db.TeamInvitations.Where(i => i.OwnerId == OwnerId)
            .OrderByDescending(i => i.CreatedAt)
            .Select(i => new InvitationDto(i.Id, i.Email, i.Role.ToApiString(), i.Status.ToApiString(), i.Token, i.ExpiresAt, i.AssignedProjectIds))
            .ToListAsync(ct);
        return Ok(invitations);
    }

    [HttpPost("invitations")]
    public async Task<ActionResult<InvitationDto>> Invite(InviteMemberRequest request, CancellationToken ct)
    {
        if (EnsureAuthenticated() is UnauthorizedObjectResult unauth) return unauth;
        var email = request.Email.Trim().ToLowerInvariant();
        var invitation = new TeamInvitation
        {
            OwnerId = OwnerId,
            Email = email,
            Role = EnumExtensions.ParseApiEnum<TeamRole>(request.Role),
            InvitedByName = request.InvitedByName,
            AssignedProjectIds = request.AssignedProjectIds.Distinct().ToList()
        };
        _db.TeamInvitations.Add(invitation);
        await _db.SaveChangesAsync(ct);
        return Ok(new InvitationDto(invitation.Id, invitation.Email, invitation.Role.ToApiString(), invitation.Status.ToApiString(), invitation.Token, invitation.ExpiresAt, invitation.AssignedProjectIds));
    }

    [HttpPost("invitations/accept")]
    public async Task<IActionResult> Accept(AcceptInvitationRequest request, CancellationToken ct)
    {
        if (EnsureAuthenticated() is UnauthorizedObjectResult unauth) return unauth;
        var invitation = await _db.TeamInvitations.FirstOrDefaultAsync(i => i.Token == request.Token && i.Status == InvitationStatus.Pending, ct);
        if (invitation is null) return NotFound(new { message = "Invitación no encontrada o ya usada." });
        if (invitation.ExpiresAt < DateTimeOffset.UtcNow) return BadRequest(new { message = "La invitación expiró." });
        if (!string.Equals(invitation.Email, CurrentUser.Email, StringComparison.OrdinalIgnoreCase)) return Forbid();

        var memberExists = await _db.TeamMembers.AnyAsync(m => m.OwnerId == invitation.OwnerId && m.UserId == OwnerId, ct);
        if (!memberExists)
        {
            _db.TeamMembers.Add(new TeamMember
            {
                OwnerId = invitation.OwnerId,
                UserId = OwnerId,
                Email = invitation.Email,
                FullName = CurrentUser.Email,
                Role = invitation.Role,
                IsActive = true
            });
        }

        foreach (var projectId in invitation.AssignedProjectIds.Distinct())
        {
            var hasMembership = await _db.ProjectMembers.AnyAsync(pm => pm.ProjectId == projectId && pm.UserId == OwnerId, ct);
            if (!hasMembership)
            {
                _db.ProjectMembers.Add(new ProjectMember { ProjectId = projectId, UserId = OwnerId, Role = invitation.Role });
            }
        }

        invitation.Status = InvitationStatus.Accepted;
        invitation.AcceptedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Ok(new { message = "Invitación aceptada", assignedProjects = invitation.AssignedProjectIds.Count });
    }
}
