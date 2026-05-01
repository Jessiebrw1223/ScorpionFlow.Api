-- Tighten task editing for shared workspaces and role management safety.

DROP POLICY IF EXISTS "workspace writers insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "workspace writers update tasks" ON public.tasks;
DROP POLICY IF EXISTS "workspace writers delete tasks" ON public.tasks;

CREATE POLICY "workspace admins insert tasks"
ON public.tasks
FOR INSERT
WITH CHECK (public.can_admin_workspace(auth.uid(), owner_id));

CREATE POLICY "workspace admins or assigned collaborators update tasks"
ON public.tasks
FOR UPDATE
USING (
  public.can_admin_workspace(auth.uid(), owner_id)
  OR (
    public.get_workspace_role(auth.uid(), owner_id) = 'collaborator'
    AND assignee_id = auth.uid()
  )
)
WITH CHECK (
  public.can_admin_workspace(auth.uid(), owner_id)
  OR (
    public.get_workspace_role(auth.uid(), owner_id) = 'collaborator'
    AND assignee_id = auth.uid()
  )
);

CREATE POLICY "workspace admins delete tasks"
ON public.tasks
FOR DELETE
USING (public.can_admin_workspace(auth.uid(), owner_id));

DROP POLICY IF EXISTS "workspace admins update team members" ON public.team_members;
DROP POLICY IF EXISTS "workspace admins delete team members" ON public.team_members;

CREATE POLICY "workspace owner updates team members"
ON public.team_members
FOR UPDATE
USING (auth.uid() = owner_id AND user_id <> owner_id)
WITH CHECK (auth.uid() = owner_id AND user_id <> owner_id);

CREATE POLICY "workspace owner deletes team members"
ON public.team_members
FOR DELETE
USING (auth.uid() = owner_id AND user_id <> owner_id);

-- Keep invitations admin-capable so admins can invite, while member role changes remain owner-only.
