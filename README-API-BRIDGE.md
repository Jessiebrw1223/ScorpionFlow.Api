# ScorpionFlow API Bridge (.NET + Vercel + Render)

Este paquete ya está reorganizado para el despliegue separado:

- Frontend React/Vite en la raíz del proyecto → Vercel.
- Backend .NET en `backend/ScorpionFlow.Api` → Render.
- Supabase queda como PostgreSQL/Storage detrás del backend.

## Cambio clave realizado

Se agregó `src/integrations/supabase/client.ts` como capa puente. El frontend puede seguir usando temporalmente:

```ts
supabase.from("projects").select("*")
```

pero internamente ahora llama a:

```txt
VITE_API_URL/api/data/{table}/query
```

También se agregaron endpoints backend:

- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/data/{table}/query`
- `POST /api/data/{table}/insert`
- `POST /api/data/{table}/update`
- `POST /api/data/{table}/delete`
- `POST /api/data/{table}/upsert`
- `POST /api/functions/{name}`
- `GET/POST /api/email-unsubscribe`

## Variables para Vercel

```env
VITE_API_URL=https://TU-BACKEND-RENDER.onrender.com
```

Ya no necesitas exponer `VITE_SUPABASE_URL` ni `VITE_SUPABASE_PUBLISHABLE_KEY` para las operaciones principales.

## Variables para Render

```env
ASPNETCORE_ENVIRONMENT=Production
ConnectionStrings__DefaultConnection=Host=...;Port=5432;Database=postgres;Username=postgres;Password=...;SSL Mode=Require;Trust Server Certificate=true
Jwt__Secret=CAMBIA_ESTA_CLAVE_LARGA
Cors__AllowedOrigins__0=https://TU-FRONTEND.vercel.app
```

## Nota honesta

Esto deja el proyecto listo como transición segura para subir a GitHub y desplegar separado. La capa puente evita reescribir todo el frontend de golpe y centraliza el acceso a datos en .NET. El siguiente paso profesional es ir reemplazando esa capa genérica por servicios/endpoints específicos por módulo.
