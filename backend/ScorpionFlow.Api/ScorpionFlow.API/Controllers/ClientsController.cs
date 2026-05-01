using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ScorpionFlow.Application.DTOs;
using ScorpionFlow.Application.Interfaces;
using ScorpionFlow.Domain.Entities;
using ScorpionFlow.Infrastructure.Persistence;

namespace ScorpionFlow.API.Controllers;

[Route("api/clients")]
public class ClientsController : ApiControllerBase
{
    private readonly AppDbContext _db;
    public ClientsController(AppDbContext db, ICurrentUser currentUser) : base(currentUser) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ClientDto>>> Get(CancellationToken ct)
    {
        if (EnsureAuthenticated() is UnauthorizedObjectResult unauth) return unauth;
        var clients = await _db.Clients.Where(c => c.OwnerId == OwnerId)
            .OrderBy(c => c.Name)
            .Select(c => new ClientDto(c.Id, c.Name, c.Company, c.Email, c.Phone, c.ClientType, c.CommercialStatus, c.Priority, c.Location))
            .ToListAsync(ct);
        return Ok(clients);
    }

    [HttpPost]
    public async Task<ActionResult<ClientDto>> Create(CreateClientRequest request, CancellationToken ct)
    {
        if (EnsureAuthenticated() is UnauthorizedObjectResult unauth) return unauth;
        var client = new Client
        {
            OwnerId = OwnerId,
            Name = request.Name.Trim(),
            Company = request.Company,
            Email = request.Email,
            Phone = request.Phone,
            ClientType = request.ClientType,
            Priority = request.Priority,
            Location = request.Location,
            CommercialStatus = "pending"
        };
        _db.Clients.Add(client);
        await _db.SaveChangesAsync(ct);
        return Ok(new ClientDto(client.Id, client.Name, client.Company, client.Email, client.Phone, client.ClientType, client.CommercialStatus, client.Priority, client.Location));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, CreateClientRequest request, CancellationToken ct)
    {
        if (EnsureAuthenticated() is UnauthorizedObjectResult unauth) return unauth;
        var client = await _db.Clients.FirstOrDefaultAsync(c => c.Id == id && c.OwnerId == OwnerId, ct);
        if (client is null) return NotFound();
        client.Name = request.Name.Trim();
        client.Company = request.Company;
        client.Email = request.Email;
        client.Phone = request.Phone;
        client.ClientType = request.ClientType;
        client.Priority = request.Priority;
        client.Location = request.Location;
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        if (EnsureAuthenticated() is UnauthorizedObjectResult unauth) return unauth;
        var client = await _db.Clients.FirstOrDefaultAsync(c => c.Id == id && c.OwnerId == OwnerId, ct);
        if (client is null) return NotFound();
        _db.Clients.Remove(client);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
