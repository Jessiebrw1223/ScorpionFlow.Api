# Backend ScorpionFlow para Render

La lógica de negocio y conexión a Supabase/PostgreSQL vive aquí.

## Ruta principal

```txt
backend/ScorpionFlow.Api/ScorpionFlow.API
```

## Variables obligatorias en Render

```txt
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://0.0.0.0:$PORT
ConnectionStrings__DefaultConnection=Host=...supabase...;Port=6543;Database=postgres;Username=...;Password=...;SSL Mode=Require;Trust Server Certificate=true
Jwt__Secret=clave_larga_segura
Cors__AllowedOrigins__0=https://tu-frontend.vercel.app
```

## Build Command

```bash
dotnet restore && dotnet publish -c Release -o out
```

## Start Command

```bash
dotnet out/ScorpionFlow.API.dll
```

## Swagger

```txt
https://TU-BACKEND.onrender.com/swagger
```

> Nota: Supabase ya no debe ser consumido directamente por el frontend para lógica crítica. El frontend debe usar `VITE_API_URL` y llamar a esta API.
