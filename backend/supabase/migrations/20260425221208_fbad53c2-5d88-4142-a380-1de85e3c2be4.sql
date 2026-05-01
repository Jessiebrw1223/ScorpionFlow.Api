-- =====================================================
-- FASE 2: Acceso granular a proyectos (project_members)
-- Modelo ADITIVO: owner/admin/viewer del workspace mantienen visibilidad global.
-- Solo el rol "collaborator" se restringe a proyectos donde tenga membership.
-- =====================================================

-- 1. Tabla project_members
CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role public.team_role NOT NULL DEFAULT 'collaborator',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON public.project_members(user_id);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_project_members_updated_at ON public.project_members;
CREATE TRIGGER trg_project_members_updated_at
  BEFORE UPDATE ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Helper SECURITY DEFINER: ¿el usuario tiene acceso a este proyecto?
-- Reglas:
--   - Owner del workspace: SIEMPRE
--   - Admin del workspace: SIEMPRE
--   - Viewer del workspace: SIEMPRE (solo lectura, ya cubierto en políticas de write)
--   - Collaborator del workspace: SOLO si está en project_members
--                                  O si tiene tareas asignadas en ese proyecto (compatibilidad con datos previos)
CREATE OR REPLACE FUNCTION public.has_project_access(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH proj AS (
    SELECT owner_id FROM public.projects WHERE id = _project_id
  ),
  ws_role AS (
    SELECT public.get_workspace_role(_user_id, (SELECT owner_id FROM proj)) AS role
  )
  SELECT
    -- Sin proyecto, sin acceso
    (SELECT owner_id FROM proj) IS NOT NULL
    AND (
      -- Owner/Admin/Viewer del workspace ven todo
      (SELECT role FROM ws_role) IN ('owner','admin','viewer')
      -- Collaborator: requiere membresía explícita o tareas asignadas
      OR (
        (SELECT role FROM ws_role) = 'collaborator'
        AND (
          EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = _project_id AND pm.user_id = _user_id
          )
          OR EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.project_id = _project_id AND t.assignee_id = _user_id
          )
        )
      )
    );
$$;

-- 3. Helper: ¿puede administrar este proyecto? (admin del workspace o admin en project_members)
CREATE OR REPLACE FUNCTION public.can_admin_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH proj AS (
    SELECT owner_id FROM public.projects WHERE id = _project_id
  )
  SELECT
    (SELECT owner_id FROM proj) IS NOT NULL
    AND (
      public.can_admin_workspace(_user_id, (SELECT owner_id FROM proj))
      OR EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = _project_id
          AND pm.user_id = _user_id
          AND pm.role IN ('admin')
      )
    );
$$;

-- 4. RLS de project_members
DROP POLICY IF EXISTS "workspace members view project memberships" ON public.project_members;
CREATE POLICY "workspace members view project memberships"
  ON public.project_members FOR SELECT
  USING (
    -- Cualquier miembro del workspace dueño del proyecto puede ver memberships
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND public.is_workspace_member(auth.uid(), p.owner_id)
    )
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "workspace admins manage project memberships insert" ON public.project_members;
CREATE POLICY "workspace admins manage project memberships insert"
  ON public.project_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND public.can_admin_workspace(auth.uid(), p.owner_id)
    )
  );

DROP POLICY IF EXISTS "workspace admins manage project memberships update" ON public.project_members;
CREATE POLICY "workspace admins manage project memberships update"
  ON public.project_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND public.can_admin_workspace(auth.uid(), p.owner_id)
    )
  );

DROP POLICY IF EXISTS "workspace admins manage project memberships delete" ON public.project_members;
CREATE POLICY "workspace admins manage project memberships delete"
  ON public.project_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
        AND public.can_admin_workspace(auth.uid(), p.owner_id)
    )
  );

-- 5. Endurecer SELECT en projects: collaborator solo ve los que tiene asignados
DROP POLICY IF EXISTS "workspace members view projects" ON public.projects;
CREATE POLICY "workspace members view projects"
  ON public.projects FOR SELECT
  USING (
    public.is_workspace_member(auth.uid(), owner_id)
    AND (
      public.get_workspace_role(auth.uid(), owner_id) IN ('owner','admin','viewer')
      OR (
        public.get_workspace_role(auth.uid(), owner_id) = 'collaborator'
        AND public.has_project_access(auth.uid(), id)
      )
    )
  );

-- 6. Endurecer SELECT en tasks
DROP POLICY IF EXISTS "workspace members view tasks" ON public.tasks;
CREATE POLICY "workspace members view tasks"
  ON public.tasks FOR SELECT
  USING (
    public.is_workspace_member(auth.uid(), owner_id)
    AND (
      public.get_workspace_role(auth.uid(), owner_id) IN ('owner','admin','viewer')
      OR (
        public.get_workspace_role(auth.uid(), owner_id) = 'collaborator'
        AND public.has_project_access(auth.uid(), project_id)
      )
    )
  );

-- 7. project_resources SELECT
DROP POLICY IF EXISTS "workspace members view project resources" ON public.project_resources;
CREATE POLICY "workspace members view project resources"
  ON public.project_resources FOR SELECT
  USING (
    public.is_workspace_member(auth.uid(), owner_id)
    AND (
      public.get_workspace_role(auth.uid(), owner_id) IN ('owner','admin','viewer')
      OR (
        public.get_workspace_role(auth.uid(), owner_id) = 'collaborator'
        AND public.has_project_access(auth.uid(), project_id)
      )
    )
  );

-- 8. project_contributions SELECT
DROP POLICY IF EXISTS "workspace members view contributions" ON public.project_contributions;
CREATE POLICY "workspace members view contributions"
  ON public.project_contributions FOR SELECT
  USING (
    public.is_workspace_member(auth.uid(), owner_id)
    AND (
      public.get_workspace_role(auth.uid(), owner_id) IN ('owner','admin','viewer')
      OR (
        public.get_workspace_role(auth.uid(), owner_id) = 'collaborator'
        AND public.has_project_access(auth.uid(), project_id)
      )
    )
  );

-- NOTA: clients y quotations conservan la política existente (visible para
-- todos los miembros del workspace) porque no están atadas a un proyecto
-- único. La fase de UI puede filtrarlas por proyectos accesibles si se
-- requiere ocultarlas a colaboradores específicos.
