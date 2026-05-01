-- =========================================================
-- Fase 1: Workspace compartido (RLS basadas en team_members)
-- =========================================================

-- 1) Funciones SECURITY DEFINER (evitan recursión en RLS)
CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id uuid, _owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    _user_id = _owner_id
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.owner_id = _owner_id
        AND tm.user_id = _user_id
        AND tm.is_active = true
    );
$$;

CREATE OR REPLACE FUNCTION public.get_workspace_role(_user_id uuid, _owner_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _user_id = _owner_id THEN 'owner'
    ELSE (
      SELECT tm.role::text FROM public.team_members tm
      WHERE tm.owner_id = _owner_id
        AND tm.user_id = _user_id
        AND tm.is_active = true
      LIMIT 1
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_write_workspace(_user_id uuid, _owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.get_workspace_role(_user_id, _owner_id) IN ('owner','admin','collaborator');
$$;

CREATE OR REPLACE FUNCTION public.can_admin_workspace(_user_id uuid, _owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.get_workspace_role(_user_id, _owner_id) IN ('owner','admin');
$$;

-- 2) PROJECTS
DROP POLICY IF EXISTS "owners view projects" ON public.projects;
DROP POLICY IF EXISTS "owners insert projects" ON public.projects;
DROP POLICY IF EXISTS "owners update projects" ON public.projects;
DROP POLICY IF EXISTS "owners delete projects" ON public.projects;

CREATE POLICY "workspace members view projects" ON public.projects
  FOR SELECT USING (public.is_workspace_member(auth.uid(), owner_id));
CREATE POLICY "workspace admins insert projects" ON public.projects
  FOR INSERT WITH CHECK (public.can_admin_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins update projects" ON public.projects
  FOR UPDATE USING (public.can_admin_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins delete projects" ON public.projects
  FOR DELETE USING (public.can_admin_workspace(auth.uid(), owner_id));

-- 3) CLIENTS
DROP POLICY IF EXISTS "owners view clients" ON public.clients;
DROP POLICY IF EXISTS "owners insert clients" ON public.clients;
DROP POLICY IF EXISTS "owners update clients" ON public.clients;
DROP POLICY IF EXISTS "owners delete clients" ON public.clients;

CREATE POLICY "workspace members view clients" ON public.clients
  FOR SELECT USING (public.is_workspace_member(auth.uid(), owner_id));
CREATE POLICY "workspace admins insert clients" ON public.clients
  FOR INSERT WITH CHECK (public.can_admin_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins update clients" ON public.clients
  FOR UPDATE USING (public.can_admin_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins delete clients" ON public.clients
  FOR DELETE USING (public.can_admin_workspace(auth.uid(), owner_id));

-- 4) CLIENT INTERACTIONS
DROP POLICY IF EXISTS "owners view interactions" ON public.client_interactions;
DROP POLICY IF EXISTS "owners insert interactions" ON public.client_interactions;
DROP POLICY IF EXISTS "owners update interactions" ON public.client_interactions;
DROP POLICY IF EXISTS "owners delete interactions" ON public.client_interactions;

CREATE POLICY "workspace members view interactions" ON public.client_interactions
  FOR SELECT USING (public.is_workspace_member(auth.uid(), owner_id));
CREATE POLICY "workspace writers insert interactions" ON public.client_interactions
  FOR INSERT WITH CHECK (public.can_write_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins update interactions" ON public.client_interactions
  FOR UPDATE USING (public.can_admin_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins delete interactions" ON public.client_interactions
  FOR DELETE USING (public.can_admin_workspace(auth.uid(), owner_id));

-- 5) QUOTATIONS
DROP POLICY IF EXISTS "owners view quotations" ON public.quotations;
DROP POLICY IF EXISTS "owners insert quotations" ON public.quotations;
DROP POLICY IF EXISTS "owners update quotations" ON public.quotations;
DROP POLICY IF EXISTS "owners delete quotations" ON public.quotations;

CREATE POLICY "workspace members view quotations" ON public.quotations
  FOR SELECT USING (public.is_workspace_member(auth.uid(), owner_id));
CREATE POLICY "workspace admins insert quotations" ON public.quotations
  FOR INSERT WITH CHECK (public.can_admin_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins update quotations" ON public.quotations
  FOR UPDATE USING (public.can_admin_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins delete quotations" ON public.quotations
  FOR DELETE USING (public.can_admin_workspace(auth.uid(), owner_id));

-- 6) QUOTATION ITEMS (siguen al owner de la cotización)
DROP POLICY IF EXISTS "items follow quotation owner" ON public.quotation_items;
DROP POLICY IF EXISTS "items insert by owner" ON public.quotation_items;
DROP POLICY IF EXISTS "items update by owner" ON public.quotation_items;
DROP POLICY IF EXISTS "items delete by owner" ON public.quotation_items;

CREATE POLICY "workspace members view quotation items" ON public.quotation_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.quotations q
            WHERE q.id = quotation_items.quotation_id
              AND public.is_workspace_member(auth.uid(), q.owner_id))
  );
CREATE POLICY "workspace admins insert quotation items" ON public.quotation_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.quotations q
            WHERE q.id = quotation_items.quotation_id
              AND public.can_admin_workspace(auth.uid(), q.owner_id))
  );
CREATE POLICY "workspace admins update quotation items" ON public.quotation_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.quotations q
            WHERE q.id = quotation_items.quotation_id
              AND public.can_admin_workspace(auth.uid(), q.owner_id))
  );
CREATE POLICY "workspace admins delete quotation items" ON public.quotation_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.quotations q
            WHERE q.id = quotation_items.quotation_id
              AND public.can_admin_workspace(auth.uid(), q.owner_id))
  );

-- 7) TASKS (colaborador puede escribir; visualizador no)
DROP POLICY IF EXISTS "owners view tasks" ON public.tasks;
DROP POLICY IF EXISTS "owners insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "owners update tasks" ON public.tasks;
DROP POLICY IF EXISTS "owners delete tasks" ON public.tasks;

CREATE POLICY "workspace members view tasks" ON public.tasks
  FOR SELECT USING (public.is_workspace_member(auth.uid(), owner_id));
CREATE POLICY "workspace writers insert tasks" ON public.tasks
  FOR INSERT WITH CHECK (public.can_write_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace writers update tasks" ON public.tasks
  FOR UPDATE USING (public.can_write_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace writers delete tasks" ON public.tasks
  FOR DELETE USING (public.can_write_workspace(auth.uid(), owner_id));

-- 8) PROJECT RESOURCES
DROP POLICY IF EXISTS "owners view project resources" ON public.project_resources;
DROP POLICY IF EXISTS "owners insert project resources" ON public.project_resources;
DROP POLICY IF EXISTS "owners update project resources" ON public.project_resources;
DROP POLICY IF EXISTS "owners delete project resources" ON public.project_resources;

CREATE POLICY "workspace members view project resources" ON public.project_resources
  FOR SELECT USING (public.is_workspace_member(auth.uid(), owner_id));
CREATE POLICY "workspace admins insert project resources" ON public.project_resources
  FOR INSERT WITH CHECK (public.can_admin_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins update project resources" ON public.project_resources
  FOR UPDATE USING (public.can_admin_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins delete project resources" ON public.project_resources
  FOR DELETE USING (public.can_admin_workspace(auth.uid(), owner_id));

-- 9) PROJECT CONTRIBUTIONS
DROP POLICY IF EXISTS "owners view contributions" ON public.project_contributions;
DROP POLICY IF EXISTS "owners insert contributions" ON public.project_contributions;
DROP POLICY IF EXISTS "owners update contributions" ON public.project_contributions;
DROP POLICY IF EXISTS "owners delete contributions" ON public.project_contributions;

CREATE POLICY "workspace members view contributions" ON public.project_contributions
  FOR SELECT USING (public.is_workspace_member(auth.uid(), owner_id));
CREATE POLICY "workspace admins insert contributions" ON public.project_contributions
  FOR INSERT WITH CHECK (public.can_admin_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins update contributions" ON public.project_contributions
  FOR UPDATE USING (public.can_admin_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins delete contributions" ON public.project_contributions
  FOR DELETE USING (public.can_admin_workspace(auth.uid(), owner_id));

-- 10) TEAM MEMBERS — los miembros pueden ver el equipo; solo admin gestiona
DROP POLICY IF EXISTS "owners view team members" ON public.team_members;
DROP POLICY IF EXISTS "owners insert team members" ON public.team_members;
DROP POLICY IF EXISTS "owners update team members" ON public.team_members;
DROP POLICY IF EXISTS "owners delete team members" ON public.team_members;

CREATE POLICY "workspace members view team members" ON public.team_members
  FOR SELECT USING (
    public.is_workspace_member(auth.uid(), owner_id)
    OR auth.uid() = user_id
  );
CREATE POLICY "workspace admins insert team members" ON public.team_members
  FOR INSERT WITH CHECK (public.can_admin_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins update team members" ON public.team_members
  FOR UPDATE USING (public.can_admin_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins delete team members" ON public.team_members
  FOR DELETE USING (public.can_admin_workspace(auth.uid(), owner_id));

-- 11) TEAM INVITATIONS — admin puede invitar; miembros ven invitaciones del workspace
DROP POLICY IF EXISTS "owners view own invitations" ON public.team_invitations;
DROP POLICY IF EXISTS "owners insert invitations" ON public.team_invitations;
DROP POLICY IF EXISTS "owners update invitations" ON public.team_invitations;
DROP POLICY IF EXISTS "owners delete invitations" ON public.team_invitations;

CREATE POLICY "workspace members view invitations" ON public.team_invitations
  FOR SELECT USING (public.is_workspace_member(auth.uid(), owner_id));
CREATE POLICY "workspace admins insert invitations" ON public.team_invitations
  FOR INSERT WITH CHECK (public.can_admin_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins update invitations" ON public.team_invitations
  FOR UPDATE USING (public.can_admin_workspace(auth.uid(), owner_id));
CREATE POLICY "workspace admins delete invitations" ON public.team_invitations
  FOR DELETE USING (public.can_admin_workspace(auth.uid(), owner_id));