using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ScorpionFlow.Application.DTOs;
using ScorpionFlow.Application.Interfaces;
using ScorpionFlow.Domain.Entities;
using ScorpionFlow.Infrastructure.Persistence;

namespace ScorpionFlow.API.Controllers;

[Route("api/quotations")]
public class QuotationsController : ApiControllerBase
{
    private readonly AppDbContext _db;
    public QuotationsController(AppDbContext db, ICurrentUser currentUser) : base(currentUser) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<QuotationDto>>> Get(CancellationToken ct)
    {
        if (EnsureAuthenticated() is UnauthorizedObjectResult unauth) return unauth;
        var data = await _db.Quotations.Include(q => q.Items).Where(q => q.OwnerId == OwnerId)
            .OrderByDescending(q => q.CreatedAt)
            .Select(q => new QuotationDto(q.Id, q.ClientId, q.Code, q.Title, q.Status.ToString().ToLower(), q.Total, q.Currency, q.ValidUntil,
                q.Items.Select(i => new QuotationItemDto(i.Id, i.Concept, i.Quantity, i.UnitPrice, i.Total)).ToList()))
            .ToListAsync(ct);
        return Ok(data);
    }

    [HttpPost]
    public async Task<ActionResult<QuotationDto>> Create(CreateQuotationRequest request, CancellationToken ct)
    {
        if (EnsureAuthenticated() is UnauthorizedObjectResult unauth) return unauth;
        var quotation = new Quotation
        {
            OwnerId = OwnerId,
            ClientId = request.ClientId,
            Code = request.Code,
            Title = request.Title,
            Currency = string.IsNullOrWhiteSpace(request.Currency) ? "PEN" : request.Currency,
            ValidUntil = request.ValidUntil
        };
        foreach (var item in request.Items)
        {
            var total = item.Quantity * item.UnitPrice;
            quotation.Items.Add(new QuotationItem { Concept = item.Concept, Quantity = item.Quantity, UnitPrice = item.UnitPrice, Total = total });
            quotation.Total += total;
        }
        _db.Quotations.Add(quotation);
        await _db.SaveChangesAsync(ct);
        return Ok(new QuotationDto(quotation.Id, quotation.ClientId, quotation.Code, quotation.Title, quotation.Status.ToString().ToLower(), quotation.Total, quotation.Currency, quotation.ValidUntil,
            quotation.Items.Select(i => new QuotationItemDto(i.Id, i.Concept, i.Quantity, i.UnitPrice, i.Total)).ToList()));
    }

    [HttpPost("{id:guid}/convert-to-project")]
    public async Task<IActionResult> ConvertToProject(Guid id, CancellationToken ct)
    {
        if (EnsureAuthenticated() is UnauthorizedObjectResult unauth) return unauth;
        var quotation = await _db.Quotations.FirstOrDefaultAsync(q => q.Id == id && q.OwnerId == OwnerId, ct);
        if (quotation is null) return NotFound();
        if (quotation.ClientId is null) return BadRequest(new { message = "La cotización necesita cliente para crear proyecto." });
        var project = new Project
        {
            OwnerId = OwnerId,
            ClientId = quotation.ClientId.Value,
            QuotationId = quotation.Id,
            Name = quotation.Title ?? quotation.Code,
            Budget = quotation.Total,
            Currency = quotation.Currency
        };
        _db.Projects.Add(project);
        await _db.SaveChangesAsync(ct);
        return Ok(new { projectId = project.Id });
    }
}
