-- Auth propia del backend .NET para estabilizar el MVP sin Lovable Auth ni Supabase Auth directo.
CREATE TABLE IF NOT EXISTS public.app_auth_users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_auth_users_email_lower
  ON public.app_auth_users (lower(email));
