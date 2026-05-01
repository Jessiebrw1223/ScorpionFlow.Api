namespace ScorpionFlow.Application.DTOs;
public sealed record DashboardSummaryDto(int Clients, int Projects, int Tasks, int CompletedTasks, int BlockedTasks, decimal TotalBudget, decimal ActualCost, decimal Profitability);
