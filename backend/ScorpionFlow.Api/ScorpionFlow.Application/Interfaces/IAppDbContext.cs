using Microsoft.EntityFrameworkCore;
using ScorpionFlow.Domain.Entities;

namespace ScorpionFlow.Application.Interfaces;
public interface IAppDbContext
{
    DbSet<Client> Clients { get; }
    DbSet<Project> Projects { get; }
    DbSet<TaskItem> Tasks { get; }
    DbSet<Quotation> Quotations { get; }
    DbSet<QuotationItem> QuotationItems { get; }
    DbSet<TeamMember> TeamMembers { get; }
    DbSet<TeamInvitation> TeamInvitations { get; }
    DbSet<ProjectMember> ProjectMembers { get; }
    DbSet<ProjectResource> ProjectResources { get; }
    DbSet<AccountSubscription> AccountSubscriptions { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
