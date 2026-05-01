-- Agregar metadata a team_invitations para guardar scope y proyectos asignados
ALTER TABLE public.team_invitations
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'workspace',
  ADD COLUMN IF NOT EXISTS assigned_project_ids uuid[] NOT NULL DEFAULT '{}';

-- Trigger: cuando se acepta una invitación, materializar project_members
-- a partir de assigned_project_ids del invitado.
CREATE OR REPLACE FUNCTION public.materialize_invitation_project_members()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_project_id uuid;
BEGIN
  -- Solo cuando pasa de pending -> accepted
  IF (NEW.status = 'accepted' AND COALESCE(OLD.status, 'pending') <> 'accepted') THEN
    -- Buscar user_id del invitado por email
    SELECT user_id INTO v_user_id
    FROM public.team_members
    WHERE owner_id = NEW.owner_id
      AND lower(email) = lower(NEW.email)
    LIMIT 1;

    IF v_user_id IS NOT NULL AND array_length(NEW.assigned_project_ids, 1) > 0 THEN
      FOREACH v_project_id IN ARRAY NEW.assigned_project_ids LOOP
        INSERT INTO public.project_members (project_id, user_id, role)
        VALUES (v_project_id, v_user_id, NEW.role)
        ON CONFLICT (project_id, user_id) DO NOTHING;
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_materialize_invitation_project_members ON public.team_invitations;
CREATE TRIGGER trg_materialize_invitation_project_members
  AFTER UPDATE ON public.team_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.materialize_invitation_project_members();

-- Asegurar índice único para evitar duplicados en project_members
CREATE UNIQUE INDEX IF NOT EXISTS project_members_project_user_unique
  ON public.project_members (project_id, user_id);