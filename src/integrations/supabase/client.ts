/*
  ScorpionFlow frontend API bridge.
  Mantiene la interfaz que el frontend ya usa (`supabase.from(...)`, `supabase.auth...`),
  pero NO conecta el navegador directo a Supabase. Todo pasa por ScorpionFlow.API (.NET).
*/

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
const TOKEN_KEY = "scorpionflow_access_token";
const USER_KEY = "scorpionflow_user";

type ApiResult<T = any> = { data: T | null; error: any | null; count?: number | null };
type Filter = { column: string; op: string; value: any };

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function request<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = body?.message ?? body?.title ?? text ?? `API error ${res.status}`;
    throw new Error(message);
  }

  return body as T;
}

class ApiQueryBuilder {
  private filters: Filter[] = [];
  private selected = "*";
  private orderBy?: { column: string; ascending: boolean };
  private limitValue?: number;
  private singleMode: "none" | "single" | "maybeSingle" = "none";
  private countMode?: string;
  private headMode = false;
  private mutation?: { type: "insert" | "update" | "delete" | "upsert"; payload?: any };

  constructor(private readonly table: string) {}

  select(columns = "*", options?: { count?: string; head?: boolean }) {
    this.selected = columns;
    this.countMode = options?.count;
    this.headMode = Boolean(options?.head);
    return this;
  }

  eq(column: string, value: any) { this.filters.push({ column, op: "eq", value }); return this; }
  neq(column: string, value: any) { this.filters.push({ column, op: "neq", value }); return this; }
  gt(column: string, value: any) { this.filters.push({ column, op: "gt", value }); return this; }
  gte(column: string, value: any) { this.filters.push({ column, op: "gte", value }); return this; }
  lt(column: string, value: any) { this.filters.push({ column, op: "lt", value }); return this; }
  lte(column: string, value: any) { this.filters.push({ column, op: "lte", value }); return this; }
  is(column: string, value: any) { this.filters.push({ column, op: "is", value }); return this; }
  in(column: string, value: any[]) { this.filters.push({ column, op: "in", value }); return this; }
  contains(column: string, value: any) { this.filters.push({ column, op: "contains", value }); return this; }
  ilike(column: string, value: any) { this.filters.push({ column, op: "ilike", value }); return this; }
  or(_expression: string) { return this; }
  not(column: string, op: string, value: any) { this.filters.push({ column, op: `not_${op}`, value }); return this; }
  range(from: number, to: number) { this.limitValue = Math.max(1, to - from + 1); return this; }
  match(values: Record<string, any>) { Object.entries(values).forEach(([column, value]) => this.eq(column, value)); return this; }
  filter(column: string, op: string, value: any) { this.filters.push({ column, op, value }); return this; }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending ?? true };
    return this;
  }

  limit(value: number) { this.limitValue = value; return this; }
  single() { this.singleMode = "single"; return this.execute(); }
  maybeSingle() { this.singleMode = "maybeSingle"; return this.execute(); }

  insert(payload: any) { this.mutation = { type: "insert", payload }; return this; }
  update(payload: any) { this.mutation = { type: "update", payload }; return this; }
  upsert(payload: any) { this.mutation = { type: "upsert", payload }; return this; }
  delete() { this.mutation = { type: "delete" }; return this; }

  async execute(): Promise<ApiResult> {
    try {
      const body = {
        select: this.selected,
        filters: this.filters,
        orderBy: this.orderBy,
        limit: this.limitValue,
        single: this.singleMode,
        count: this.countMode,
        head: this.headMode,
        payload: this.mutation?.payload,
      };

      let result: any;
      if (!this.mutation) {
        result = await request(`/api/data/${this.table}/query`, { method: "POST", body: JSON.stringify(body) });
      } else {
        const path = `/api/data/${this.table}/${this.mutation.type}`;
        result = await request(path, { method: "POST", body: JSON.stringify(body) });
      }
      return { data: result?.data ?? null, error: null, count: result?.count ?? null };
    } catch (error) {
      return { data: null, error, count: null };
    }
  }

  then(resolve: any, reject: any) {
    return this.execute().then(resolve, reject);
  }
}

export const supabase = {
  from(table: string) {
    return new ApiQueryBuilder(table);
  },

  auth: {
    async signInWithPassword(credentials: { email: string; password: string }) {
      try {
        const data: any = await request("/api/auth/login", { method: "POST", body: JSON.stringify(credentials) });
        localStorage.setItem(TOKEN_KEY, data.access_token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        return { data: { session: data, user: data.user }, error: null };
      } catch (error) { return { data: null, error }; }
    },

    async signUp(input: { email: string; password: string; options?: any }) {
      try {
        const data: any = await request("/api/auth/register", { method: "POST", body: JSON.stringify(input) });
        localStorage.setItem(TOKEN_KEY, data.access_token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        return { data: { session: data, user: data.user }, error: null };
      } catch (error) { return { data: null, error }; }
    },

    async signOut() {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      return { error: null };
    },

    async getUser() {
      const user = getStoredUser();
      return { data: { user }, error: user ? null : new Error("No hay usuario autenticado") };
    },

    async getSession() {
      const token = getToken();
      const user = getStoredUser();
      return { data: { session: token ? { access_token: token, user } : null }, error: null };
    },

    onAuthStateChange(callback: any) {
      queueMicrotask(() => callback(getToken() ? "SIGNED_IN" : "SIGNED_OUT", getToken() ? { access_token: getToken(), user: getStoredUser() } : null));
      return { data: { subscription: { unsubscribe() {} } } };
    },

    async resetPasswordForEmail(email: string, options?: any) {
      try { await request("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email, redirectTo: options?.redirectTo }) }); return { data: {}, error: null }; }
      catch (error) { return { data: null, error }; }
    },

    async updateUser(input: { password?: string; data?: any }) {
      try { const data = await request("/api/auth/me", { method: "PUT", body: JSON.stringify(input) }); return { data, error: null }; }
      catch (error) { return { data: null, error }; }
    },

    async setSession(tokens: any) {
      if (tokens?.access_token) localStorage.setItem(TOKEN_KEY, tokens.access_token);
      if (tokens?.user) localStorage.setItem(USER_KEY, JSON.stringify(tokens.user));
      return { data: { session: tokens }, error: null };
    },
  },

  functions: {
    async invoke(name: string, options?: { body?: any }) {
      try {
        const data = await request(`/api/functions/${name}`, { method: "POST", body: JSON.stringify(options?.body ?? {}) });
        return { data, error: null };
      } catch (error) { return { data: null, error }; }
    },
  },

  channel(_name: string) {
    const channelApi: any = {
      on() { return channelApi; },
      subscribe(callback?: any) { if (callback) queueMicrotask(() => callback("SUBSCRIBED")); return channelApi; },
      unsubscribe() { return Promise.resolve("ok"); },
    };
    return channelApi;
  },

  removeChannel(_channel: any) { return Promise.resolve("ok"); },
};

export default supabase;
