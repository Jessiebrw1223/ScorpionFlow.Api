using ScorpionFlow.Domain.Common;

namespace ScorpionFlow.Domain.Entities;

public class Client : AuditableEntity
{
    public Guid OwnerId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Company { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? ClientType { get; set; }
    public string? CommercialStatus { get; set; }
    public string? Priority { get; set; }
    public string? Location { get; set; }
    public DateTimeOffset? LastContactAt { get; set; }
    public ICollection<Project> Projects { get; set; } = new List<Project>();
    public ICollection<Quotation> Quotations { get; set; } = new List<Quotation>();
}
