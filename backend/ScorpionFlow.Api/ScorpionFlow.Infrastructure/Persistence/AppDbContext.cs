using Microsoft.EntityFrameworkCore;
using ScorpionFlow.Application.Interfaces;
using ScorpionFlow.Domain.Entities;
using ScorpionFlow.Domain.Enums;
using DomainTaskStatus = ScorpionFlow.Domain.Enums.TaskStatus;

namespace ScorpionFlow.Infrastructure.Persistence;

public class AppDbContext : DbContext, IAppDbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Client> Clients => Set<Client>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<TaskItem> Tasks => Set<TaskItem>();
    public DbSet<Quotation> Quotations => Set<Quotation>();
    public DbSet<QuotationItem> QuotationItems => Set<QuotationItem>();
    public DbSet<TeamMember> TeamMembers => Set<TeamMember>();
    public DbSet<TeamInvitation> TeamInvitations => Set<TeamInvitation>();
    public DbSet<ProjectMember> ProjectMembers => Set<ProjectMember>();
    public DbSet<ProjectResource> ProjectResources => Set<ProjectResource>();
    public DbSet<AccountSubscription> AccountSubscriptions => Set<AccountSubscription>();

    private static string ToDbEnum<T>(T value) where T : struct, Enum
    {
        var text = value.ToString();
        return string.Concat(text.SelectMany((c, i) =>
            i > 0 && char.IsUpper(c)
                ? new[] { '_', char.ToLowerInvariant(c) }
                : new[] { char.ToLowerInvariant(c) }));
    }

    private static T FromDbEnum<T>(string value) where T : struct, Enum
    {
        var parts = value.Split(new[] { '_', '-', ' ' }, StringSplitOptions.RemoveEmptyEntries);
        var normalized = string.Concat(parts.Select(x => char.ToUpperInvariant(x[0]) + x[1..]));
        return Enum.TryParse<T>(normalized, true, out var parsed) ? parsed : default;
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresEnum<ProjectStatus>("project_status");
        modelBuilder.HasPostgresEnum<DomainTaskStatus>("task_status");
        modelBuilder.HasPostgresEnum<TaskPriority>("task_priority");
        modelBuilder.HasPostgresEnum<TeamRole>("team_role");
        modelBuilder.HasPostgresEnum<InvitationStatus>("invitation_status");
        modelBuilder.HasPostgresEnum<SubscriptionPlan>("subscription_plan");
        modelBuilder.HasPostgresEnum<QuotationStatus>("quotation_status");

        modelBuilder.Entity<Client>(entity =>
        {
            entity.ToTable("clients");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.OwnerId).HasColumnName("owner_id");
            entity.Property(x => x.Name).HasColumnName("name");
            entity.Property(x => x.Company).HasColumnName("company");
            entity.Property(x => x.Email).HasColumnName("email");
            entity.Property(x => x.Phone).HasColumnName("phone");
            entity.Property(x => x.ClientType).HasColumnName("client_type");
            entity.Property(x => x.CommercialStatus).HasColumnName("commercial_status");
            entity.Property(x => x.Priority).HasColumnName("priority");
            entity.Property(x => x.Location).HasColumnName("location");
            entity.Property(x => x.LastContactAt).HasColumnName("last_contact_at");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        });

        modelBuilder.Entity<Project>(entity =>
        {
            entity.ToTable("projects");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.OwnerId).HasColumnName("owner_id");
            entity.Property(x => x.ClientId).HasColumnName("client_id");
            entity.Property(x => x.QuotationId).HasColumnName("quotation_id");
            entity.Property(x => x.Name).HasColumnName("name");
            entity.Property(x => x.Description).HasColumnName("description");
            entity.Property(x => x.Status)
                .HasColumnName("status")
                .HasConversion(v => ToDbEnum(v), v => FromDbEnum<ProjectStatus>(v));
            entity.Property(x => x.Progress).HasColumnName("progress");
            entity.Property(x => x.Budget).HasColumnName("budget");
            entity.Property(x => x.ActualCost).HasColumnName("actual_cost");
            entity.Property(x => x.Currency).HasColumnName("currency");
            entity.Property(x => x.StartDate).HasColumnName("start_date");
            entity.Property(x => x.EndDate).HasColumnName("end_date");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasOne(x => x.Client).WithMany(x => x.Projects).HasForeignKey(x => x.ClientId);
        });

        modelBuilder.Entity<TaskItem>(entity =>
        {
            entity.ToTable("tasks");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.OwnerId).HasColumnName("owner_id");
            entity.Property(x => x.ProjectId).HasColumnName("project_id");
            entity.Property(x => x.Title).HasColumnName("title");
            entity.Property(x => x.Description).HasColumnName("description");
            entity.Property(x => x.Status)
                .HasColumnName("status")
                .HasConversion(v => ToDbEnum(v), v => FromDbEnum<DomainTaskStatus>(v));
            entity.Property(x => x.Priority)
                .HasColumnName("priority")
                .HasConversion(v => ToDbEnum(v), v => FromDbEnum<TaskPriority>(v));
            entity.Property(x => x.AssigneeId).HasColumnName("assignee_id");
            entity.Property(x => x.AssigneeName).HasColumnName("assignee_name");
            entity.Property(x => x.DueDate).HasColumnName("due_date");
            entity.Property(x => x.BlocksProject).HasColumnName("blocks_project");
            entity.Property(x => x.BlockedSince).HasColumnName("blocked_since");
            entity.Property(x => x.Position).HasColumnName("position");
            entity.Property(x => x.Weight).HasColumnName("weight");
            entity.Property(x => x.BlockedReason).HasColumnName("blocked_reason");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasOne(x => x.Project).WithMany(x => x.Tasks).HasForeignKey(x => x.ProjectId);
        });

        modelBuilder.Entity<Quotation>(entity =>
        {
            entity.ToTable("quotations");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.OwnerId).HasColumnName("owner_id");
            entity.Property(x => x.ClientId).HasColumnName("client_id");
            entity.Property(x => x.Code).HasColumnName("code");
            entity.Property(x => x.Title).HasColumnName("title");
            entity.Property(x => x.Status).HasColumnName("status").HasConversion(v => ToDbEnum(v), v => FromDbEnum<QuotationStatus>(v));
            entity.Property(x => x.Total).HasColumnName("total");
            entity.Property(x => x.Currency).HasColumnName("currency");
            entity.Property(x => x.ValidUntil).HasColumnName("valid_until");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasOne(x => x.Client).WithMany(x => x.Quotations).HasForeignKey(x => x.ClientId);
        });

        modelBuilder.Entity<QuotationItem>(entity =>
        {
            entity.ToTable("quotation_items");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.QuotationId).HasColumnName("quotation_id");
            entity.Property(x => x.Concept).HasColumnName("concept");
            entity.Property(x => x.Quantity).HasColumnName("quantity");
            entity.Property(x => x.UnitPrice).HasColumnName("unit_price");
            entity.Property(x => x.Total).HasColumnName("total");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasOne(x => x.Quotation).WithMany(x => x.Items).HasForeignKey(x => x.QuotationId);
        });

        modelBuilder.Entity<TeamMember>(entity =>
        {
            entity.ToTable("team_members");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.OwnerId).HasColumnName("owner_id");
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.Email).HasColumnName("email");
            entity.Property(x => x.FullName).HasColumnName("full_name");
            entity.Property(x => x.Role).HasColumnName("role").HasConversion(v => ToDbEnum(v), v => FromDbEnum<TeamRole>(v));
            entity.Property(x => x.IsActive).HasColumnName("is_active");
            entity.Property(x => x.JoinedAt).HasColumnName("joined_at");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => new { x.OwnerId, x.UserId }).IsUnique();
        });

        modelBuilder.Entity<TeamInvitation>(entity =>
        {
            entity.ToTable("team_invitations");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.OwnerId).HasColumnName("owner_id");
            entity.Property(x => x.Email).HasColumnName("email");
            entity.Property(x => x.Role).HasColumnName("role").HasConversion(v => ToDbEnum(v), v => FromDbEnum<TeamRole>(v));
            entity.Property(x => x.Status).HasColumnName("status").HasConversion(v => ToDbEnum(v), v => FromDbEnum<InvitationStatus>(v));
            entity.Property(x => x.Token).HasColumnName("token");
            entity.Property(x => x.InvitedByName).HasColumnName("invited_by_name");
            entity.Property(x => x.ExpiresAt).HasColumnName("expires_at");
            entity.Property(x => x.AcceptedAt).HasColumnName("accepted_at");
            entity.Property(x => x.AssignedProjectIds).HasColumnName("assigned_project_ids").HasColumnType("uuid[]");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
        });

        modelBuilder.Entity<ProjectMember>(entity =>
        {
            entity.ToTable("project_members");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.ProjectId).HasColumnName("project_id");
            entity.Property(x => x.UserId).HasColumnName("user_id");
            entity.Property(x => x.Role).HasColumnName("role").HasConversion(v => ToDbEnum(v), v => FromDbEnum<TeamRole>(v));
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => new { x.ProjectId, x.UserId }).IsUnique();
            entity.HasOne(x => x.Project).WithMany(x => x.ProjectMembers).HasForeignKey(x => x.ProjectId);
        });

        modelBuilder.Entity<ProjectResource>(entity =>
        {
            entity.ToTable("project_resources");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.OwnerId).HasColumnName("owner_id");
            entity.Property(x => x.ProjectId).HasColumnName("project_id");
            entity.Property(x => x.Name).HasColumnName("name");
            entity.Property(x => x.Type).HasColumnName("type");
            entity.Property(x => x.Cost).HasColumnName("cost");
            entity.Property(x => x.Currency).HasColumnName("currency");
            entity.Property(x => x.Description).HasColumnName("description");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasOne(x => x.Project).WithMany(x => x.Resources).HasForeignKey(x => x.ProjectId);
        });

        modelBuilder.Entity<AccountSubscription>(entity =>
        {
            entity.ToTable("account_subscriptions");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).HasColumnName("id");
            entity.Property(x => x.OwnerId).HasColumnName("owner_id");
            entity.Property(x => x.Plan).HasColumnName("plan").HasConversion(v => ToDbEnum(v), v => FromDbEnum<SubscriptionPlan>(v));
            entity.Property(x => x.Status).HasColumnName("status");
            entity.Property(x => x.BillingCycle).HasColumnName("billing_cycle");
            entity.Property(x => x.StripeCustomerId).HasColumnName("stripe_customer_id");
            entity.Property(x => x.StripeSubscriptionId).HasColumnName("stripe_subscription_id");
            entity.Property(x => x.CurrentPeriodEnd).HasColumnName("current_period_end");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(x => x.OwnerId).IsUnique();
        });
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;
        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.Entity is Domain.Common.AuditableEntity auditable)
            {
                if (entry.State == EntityState.Added) auditable.CreatedAt = now;
                if (entry.State == EntityState.Added || entry.State == EntityState.Modified) auditable.UpdatedAt = now;
            }
        }
        return base.SaveChangesAsync(cancellationToken);
    }
}