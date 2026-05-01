-- =========================================================
-- FASE 3: Seguridad comercial — Clients y Quotations
-- Colaboradores solo ven datos de proyectos a los que tienen acceso.
-- Owner / Admin / Viewer siguen viendo todo el workspace.
-- =========================================================

-- CLIENTS: reemplazar política SELECT
DROP POLICY IF EXISTS "workspace members view clients" ON public.clients;

CREATE POLICY "workspace members view clients"
ON public.clients
FOR SELECT
USING (
  is_workspace_member(auth.uid(), owner_id)
  AND (
    get_workspace_role(auth.uid(), owner_id) IN ('owner','admin','viewer')
    OR (
      get_workspace_role(auth.uid(), owner_id) = 'collaborator'
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.client_id = clients.id
          AND has_project_access(auth.uid(), p.id)
      )
    )
  )
);

-- QUOTATIONS: reemplazar política SELECT
DROP POLICY IF EXISTS "workspace members view quotations" ON public.quotations;

CREATE POLICY "workspace members view quotations"
ON public.quotations
FOR SELECT
USING (
  is_workspace_member(auth.uid(), owner_id)
  AND (
    get_workspace_role(auth.uid(), owner_id) IN ('owner','admin','viewer')
    OR (
      get_workspace_role(auth.uid(), owner_id) = 'collaborator'
      AND (
        -- Cotización ya convertida en un proyecto accesible
        EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.quotation_id = quotations.id
            AND has_project_access(auth.uid(), p.id)
        )
        -- O cliente con al menos un proyecto accesible
        OR EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.client_id = quotations.client_id
            AND has_project_access(auth.uid(), p.id)
        )
      )
    )
  )
);

-- QUOTATION_ITEMS: heredan de la cotización (ya filtrada por su política);
-- mantenemos la regla actual basada en is_workspace_member + EXISTS quotations.
-- No requiere cambios porque la subconsulta a quotations queda filtrada por su nueva RLS.