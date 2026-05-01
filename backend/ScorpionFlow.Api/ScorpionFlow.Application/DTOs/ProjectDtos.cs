namespace ScorpionFlow.Application.DTOs;
public sealed record ProjectDto(Guid Id, Guid ClientId, string Name, string? Description, string Status, int Progress, decimal Budget, decimal ActualCost, string Currency, DateOnly? StartDate, DateOnly? EndDate);
public sealed record CreateProjectRequest(Guid ClientId, Guid? QuotationId, string Name, string? Description, decimal Budget, string Currency, DateOnly? StartDate, DateOnly? EndDate);
public sealed record UpdateProjectRequest(string Name, string? Description, string Status, decimal Budget, decimal ActualCost, string Currency, DateOnly? StartDate, DateOnly? EndDate);
