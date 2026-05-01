# ScorpionFlow - Limpieza de arquitectura aplicada

## Decisión actual del MVP

La arquitectura queda alineada así:

```txt
Frontend Vercel
  -> ScorpionFlow.API en Render (.NET)
      -> Supabase PostgreSQL
```

Supabase queda como base de datos PostgreSQL. El frontend ya no debe usar Lovable Auth ni Supabase Auth directo para el login base.

## Cambios aplicados

1. Se retiró el uso de Lovable OAuth desde las pantallas de login y registro.
2. El botón de Google conserva la estética, pero queda temporalmente deshabilitado a nivel funcional mediante aviso informativo.
3. `AuthContext` ya no depende de tipos reales de `@supabase/supabase-js`; usa sesión propia del backend.
4. Se agregaron rutas frontend para `/dashboard`, `/auth/callback` y `/auth/success`.
5. `success.tsx` ahora es un componente React válido.
6. El backend `/api/auth/google` devuelve `501` de forma controlada, evitando redirecciones rotas a `~oauth` o Supabase Auth.
7. `AuthController` ahora registra usuarios con hash PBKDF2 en `public.app_auth_users` y valida contraseña en login.
8. Se eliminó `@lovable.dev/cloud-auth-js` de `package.json`.

## Variables necesarias

### Vercel

```txt
VITE_API_URL=https://scorpionflow-api.onrender.com
```

### Render

```txt
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://0.0.0.0:$PORT
ConnectionStrings__DefaultConnection=<connection string de Supabase PostgreSQL>
Jwt__Secret=<clave larga y segura>
Cors__AllowedOrigins__0=https://www.scorpion-flow.com
MERCADOPAGO_ACCESS_TOKEN=<token de Mercado Pago>
```

## Estado de Google OAuth

Google OAuth queda pospuesto. Para activarlo después se recomienda hacerlo completo desde el backend o migrar formalmente todo a Supabase Auth, pero no mezclar ambos modelos.
