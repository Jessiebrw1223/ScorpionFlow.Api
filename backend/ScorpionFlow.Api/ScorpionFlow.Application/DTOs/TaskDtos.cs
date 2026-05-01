namespace ScorpionFlow.Application.DTOs;
public sealed record TaskDto(Guid Id, Guid ProjectId, string Title, string? Description, string Status, string Priority, Guid? AssigneeId, string? AssigneeName, DateOnly? DueDate, bool BlocksProject, int Position, int Weight, string? BlockedReason);
public sealed record CreateTaskRequest(Guid ProjectId, string Title, string? Description, string Priority, Guid? AssigneeId, string? AssigneeName, DateOnly? DueDate, int Weight);
public sealed record UpdateTaskRequest(string Title, string? Description, string Status, string Priority, Guid? AssigneeId, string? AssigneeName, DateOnly? DueDate, bool BlocksProject, int Position, int Weight, string? BlockedReason);
