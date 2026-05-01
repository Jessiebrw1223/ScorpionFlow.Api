namespace ScorpionFlow.Application.DTOs;
public sealed record QuotationItemDto(Guid Id, string Concept, decimal Quantity, decimal UnitPrice, decimal Total);
public sealed record QuotationDto(Guid Id, Guid? ClientId, string Code, string? Title, string Status, decimal Total, string Currency, DateOnly? ValidUntil, List<QuotationItemDto> Items);
public sealed record UpsertQuotationItemRequest(string Concept, decimal Quantity, decimal UnitPrice);
public sealed record CreateQuotationRequest(Guid? ClientId, string Code, string? Title, string Currency, DateOnly? ValidUntil, List<UpsertQuotationItemRequest> Items);
