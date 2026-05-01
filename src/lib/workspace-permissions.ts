export type WorkspaceRole = "owner" | "admin" | "collaborator" | "viewer" | null;

export function canAdminWorkspace(role: WorkspaceRole): boolean {
  return role === "owner" || role === "admin";
}

export function canCreateProjectWork(role: WorkspaceRole): boolean {
  return canAdminWorkspace(role);
}

export function canEditProjectFinancials(role: WorkspaceRole): boolean {
  return canAdminWorkspace(role);
}

export function canEditAssignedTask(
  role: WorkspaceRole,
  task: { assignee_id?: string | null } | null | undefined,
  userId?: string | null,
): boolean {
  if (canAdminWorkspace(role)) return true;
  return role === "collaborator" && !!userId && task?.assignee_id === userId;
}

export const NO_EDIT_PERMISSION_MESSAGE = "No tienes permiso para editar esta sección.";