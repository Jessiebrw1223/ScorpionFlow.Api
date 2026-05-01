// Reemplazo manual: usamos Supabase Auth directo, no Lovable Cloud Auth.

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (
      provider: "google" | "apple" | "microsoft",
      opts?: SignInOptions
    ) => {
      if (provider !== "google") {
        return { error: new Error("Solo Google está habilitado por ahora.") };
      }

      window.location.href = `${API_URL}/api/auth/google`;

      return {
        redirected: true,
        error: null,
      };
    },
  },
};