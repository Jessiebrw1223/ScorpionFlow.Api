import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, LogIn, Mail, Lock, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const schema = z.object({
  email: z.string().trim().email("Correo inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
});

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const from = (location.state as { from?: Location })?.from?.pathname || "/";

  useEffect(() => {
    if (!authLoading && user) {
      navigate(pendingRedirect ?? from, { replace: true });
    }
  }, [authLoading, user, pendingRedirect, from, navigate]);
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setErrors({});

  const parsed = schema.safeParse({ email, password });
  if (!parsed.success) {
    const fld = parsed.error.flatten().fieldErrors;
    setErrors({ email: fld.email?.[0], password: fld.password?.[0] });
    return;
  }

  setLoading(true);

  try {
    const apiUrl = import.meta.env.VITE_API_URL ?? "https://scorpionflow-api.onrender.com";

    const res = await fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.message ?? "Credenciales incorrectas");
    }

    localStorage.setItem("scorpionflow_access_token", data.access_token);
    localStorage.setItem("scorpionflow_user", JSON.stringify(data.user));

    toast.success("¡Bienvenido de vuelta!", {
      description: "Acceso autorizado al sistema.",
    });

    navigate(from === "/" ? "/dashboard" : from, { replace: true });
  } catch (error) {
    toast.error("Credenciales incorrectas", {
      description: error instanceof Error ? error.message : "Verifica tu correo o contraseña.",
    });
  } finally {
    setLoading(false);
  }
};
}
