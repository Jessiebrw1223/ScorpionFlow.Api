# ScorpionFlow - estructura Render + Vercel

Esta versión queda organizada para despliegue separado:

```txt
scorpionflow/
├── src/                         # Frontend React/Vite para Vercel
├── public/
├── package.json
├── vercel.json
├── .env.example                 # Solo VITE_API_URL
├── backend/
│   ├── ScorpionFlow.Api/        # Backend .NET Clean Architecture para Render
│   │   ├── ScorpionFlow.API/
│   │   ├── ScorpionFlow.Application/
│   │   ├── ScorpionFlow.Domain/
│   │   └── ScorpionFlow.Infrastructure/
│   └── supabase/                # Migraciones/funciones existentes movidas al backend
└── render.yaml
```

## Vercel frontend

- Root Directory: raíz del repo
- Build Command: `npm run build`
- Output Directory: `dist`
- Variable:

```txt
VITE_API_URL=https://TU-BACKEND-RENDER.onrender.com
```

## Render backend

- Puedes usar `render.yaml`, o configurar manual:
- Root Directory: `backend/ScorpionFlow.Api/ScorpionFlow.API`
- Build Command: `dotnet restore && dotnet publish -c Release -o out`
- Start Command: `dotnet out/ScorpionFlow.API.dll`

Variables en Render:

```txt
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://0.0.0.0:$PORT
ConnectionStrings__DefaultConnection=TU_CADENA_SUPABASE_POSTGRES
Jwt__Secret=TU_SECRETO_LARGO
Cors__AllowedOrigins__0=https://TU-FRONTEND.vercel.app
```

## Estado honesto

- Ya se separó físicamente frontend/backend.
- Ya existe backend .NET con controllers, entidades, DbContext y estructura Clean Architecture.
- El frontend conserva diseño y archivos visuales.
- Falta completar la sustitución total de llamadas `supabase.from(...)` por llamadas a `src/lib/api-client.ts` módulo por módulo.
