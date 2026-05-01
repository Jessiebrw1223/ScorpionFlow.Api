-- 1) Función que crea user_settings por defecto al registrarse un nuevo usuario
CREATE OR REPLACE FUNCTION public.handle_new_user_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- 2) Trigger que dispara la creación automáticamente
DROP TRIGGER IF EXISTS on_auth_user_created_settings ON auth.users;
CREATE TRIGGER on_auth_user_created_settings
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_settings();

-- 3) Asegurar que user_settings.user_id tenga índice único (para el ON CONFLICT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'user_settings' 
    AND indexname = 'user_settings_user_id_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX user_settings_user_id_unique_idx ON public.user_settings(user_id);
  END IF;
END $$;

-- 4) Backfill: crear settings para usuarios existentes que no las tienen
INSERT INTO public.user_settings (user_id)
SELECT u.id FROM auth.users u
LEFT JOIN public.user_settings s ON s.user_id = u.id
WHERE s.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;