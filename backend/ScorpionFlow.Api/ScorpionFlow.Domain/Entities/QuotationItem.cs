using ScorpionFlow.Domain.Common;

namespace ScorpionFlow.Domain.Entities;

public class QuotationItem : AuditableEntity
{
    public Guid QuotationId { get; set; }
    public string Concept { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Total { get; set; }
    public Quotation? Quotation { get; set; }
}
