namespace ScorpionFlow.Application.DTOs;
public sealed record ClientDto(Guid Id, string Name, string? Company, string? Email, string? Phone, string? ClientType, string? CommercialStatus, string? Priority, string? Location);
public sealed record CreateClientRequest(string Name, string? Company, string? Email, string? Phone, string? ClientType, string? Priority, string? Location);
