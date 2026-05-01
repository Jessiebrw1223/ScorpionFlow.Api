# ScorpionFlow API - avance de migración .NET

## Objetivo
Separar ScorpionFlow en:

- Frontend React/Vite: conserva diseño, rutas, componentes y UX.
- Backend ASP.NET Core Web API: concentra lógica, permisos, CRUD, dashboard y colaboración.
- Supabase: queda como PostgreSQL/Storage, ya no como acceso directo principal desde React.

## Avance implementado

### Backend
- `ScorpionFlow.API` en .NET 8.
- Clean Architecture con `Domain`, `Application`, `Infrastructure`, `API`.
- `AppDbContext` preparado para PostgreSQL/Supabase con tablas principales.
- Entidades base: clientes, proyectos, tareas, cotizaciones, equipo, invitaciones, miembros por proyecto, recursos y suscripciones.
- JWT Bearer preparado para proteger endpoints.
- CORS preparado para Vercel/local.
- Swagger habilitado.
- Healthcheck: `GET /api/health`.

### Endpoints creados
- `GET/POST/PUT/DELETE /api/clients`
- `GET/POST/PUT/DELETE /api/projects`
- `GET/POST/PUT/DELETE /api/tasks`
- `GET /api/team/members`
- `GET/POST /api/team/invitations`
- `POST /api/team/invitations/accept`
- `GET/POST /api/quotations`
- `POST /api/quotations/{id}/convert-to-project`
- `GET /api/dashboard/summary`

### Frontend
- Se agregó `src/lib/api-client.ts` como puente para reemplazar progresivamente llamadas Supabase por llamadas a `.NET API`.
- No se cambió diseño, páginas ni componentes visuales.

## Pendiente crítico
- Validar compilación local con SDK .NET 8.
- Ajustar nombres exactos de columnas si alguna migración cambió esquema posterior.
- Implementar Auth real completo: login/register/refresh o integración JWT con Supabase Auth.
- Migrar páginas React una por una para usar `scorpionApi`.
- Billing Stripe en .NET.
- Emails transaccionales en .NET.
