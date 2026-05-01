// Centraliza llamadas HTTP al backend .NET.
// Objetivo: reemplazar gradualmente src/integrations/supabase/client.ts sin tocar diseño/UX.

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("scorpionflow_access_token");
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `API error ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const scorpionApi = {
  health: () => apiFetch<{ status: string; service: string }>("/api/health"),
  clients: {
    list: () => apiFetch("/api/clients"),
    create: (body: unknown) => apiFetch("/api/clients", { method: "POST", body: JSON.stringify(body) }),
  },
  projects: {
    list: () => apiFetch("/api/projects"),
    create: (body: unknown) => apiFetch("/api/projects", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: unknown) => apiFetch(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (id: string) => apiFetch(`/api/projects/${id}`, { method: "DELETE" }),
  },
  tasks: {
    list: (projectId?: string) => apiFetch(`/api/tasks${projectId ? `?projectId=${projectId}` : ""}`),
    create: (body: unknown) => apiFetch("/api/tasks", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: unknown) => apiFetch(`/api/tasks/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (id: string) => apiFetch(`/api/tasks/${id}`, { method: "DELETE" }),
  },
  team: {
    members: () => apiFetch("/api/team/members"),
    invitations: () => apiFetch("/api/team/invitations"),
    invite: (body: unknown) => apiFetch("/api/team/invitations", { method: "POST", body: JSON.stringify(body) }),
    accept: (token: string) => apiFetch("/api/team/invitations/accept", { method: "POST", body: JSON.stringify({ token }) }),
  },
  quotations: {
    list: () => apiFetch("/api/quotations"),
    create: (body: unknown) => apiFetch("/api/quotations", { method: "POST", body: JSON.stringify(body) }),
    convertToProject: (id: string) => apiFetch(`/api/quotations/${id}/convert-to-project`, { method: "POST" }),
  },
  dashboard: {
    summary: () => apiFetch("/api/dashboard/summary"),
  },
};
