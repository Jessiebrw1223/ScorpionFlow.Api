using ScorpionFlow.Domain.Common;
using ScorpionFlow.Domain.Enums;

namespace ScorpionFlow.Domain.Entities;

public class Quotation : AuditableEntity
{
    public Guid OwnerId { get; set; }
    public Guid? ClientId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string? Title { get; set; }
    public QuotationStatus Status { get; set; } = QuotationStatus.Draft;
    public decimal Total { get; set; }
    public string Currency { get; set; } = "PEN";
    public DateOnly? ValidUntil { get; set; }
    public Client? Client { get; set; }
    public ICollection<QuotationItem> Items { get; set; } = new List<QuotationItem>();
}
