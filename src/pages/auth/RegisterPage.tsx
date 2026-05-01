import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, UserPlus, Mail, Lock, User, Loader2, Check, X } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const schema = z
  .object({
    fullName: z.string().trim().min(2, "Mínimo 2 caracteres").max(80),
    email: z.string().trim().email("Correo inválido").max(255),
    password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .max(72)
      .regex(/[A-Z]/, "Debe incluir mayúscula")
      .regex(/[0-9]/, "Debe incluir número")
      .regex(/[^A-Za-z0-9]/, "Debe incluir símbolo"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8+ caracteres", ok: password.length >= 8 },
    { label: "Mayúscula", ok: /[A-Z]/.test(password) },
    { label: "Número", ok: /[0-9]/.test(password) },
    { label: "Símbolo", ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.ok).length;

  return (
    <div className="space-y-2 pt-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-all",
              i < score
                ? score === 4
                  ? "bg-cost-positive shadow-[0_0_6px_hsl(142_71%_45%)]"
                  : score >= 2
                  ? "bg-primary shadow-[0_0_6px_hsl(15_90%_55%)]"
                  : "bg-cost-warning"
                : "bg-secondary"
            )}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center gap-1.5 text-[11px]">
            {c.ok ? (
              <Check className="w-3 h-3 text-cost-positive" />
            ) : (
              <X className="w-3 h-3 text-muted-foreground" />
            )}
            <span className={c.ok ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && user) {
      navigate(pendingRedirect ?? "/", { replace: true });
    }
  }, [authLoading, user, pendingRedirect, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const parsed = schema.safeParse({ fullName, email, password, confirmPassword });
    if (!parsed.success) {
      const fld = parsed.error.flatten().fieldErrors;
      setErrors({
        fullName: fld.fullName?.[0] || "",
        email: fld.email?.[0] || "",
        password: fld.password?.[0] || "",
        confirmPassword: fld.confirmPassword?.[0] || "",
      });
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName },
      },
    });
    setLoading(false);

    if (error) {
      if (error.message.toLowerCase().includes("already")) {
        toast.error("Correo ya registrado", { description: "Inicia sesión en su lugar." });
      } else {
        toast.error("No se pudo crear la cuenta", { description: error.message });
      }
      return;
    }

    toast.success("¡Cuenta creada!", { description: "Ya puedes acceder al sistema." });

    if (data.session) {
      setPendingRedirect("/");
      return;
    }

    navigate("/auth/login", { replace: true });
  };

  const handleGoogle = () => {
    toast.info("Google estará disponible después de estabilizar el registro base.");
  };

  return (
    <AuthLayout
      title="Crea tu cuenta"
      subtitle="Únete al sistema de control empresarial"
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link to="/auth/login" className="fire-link text-primary font-medium">
            Inicia sesión
          </Link>
        </>
      }
    >
      <Button
        type="button"
        variant="outline"
        onClick={handleGoogle}
        disabled={loading}
        className="w-full h-11 gap-3 border-border hover:border-primary/50 hover:bg-secondary fire-glow-hover"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Google próximamente
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
          <span className="bg-card px-2 text-muted-foreground">O con correo</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nombre completo</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Juan Pérez"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="pl-9 h-11 bg-secondary/50 border-border focus:border-primary"
            />
          </div>
          {errors.fullName && <p className="text-[12px] text-destructive">{errors.fullName}</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Correo electrónico</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="email"
              placeholder="tu@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-9 h-11 bg-secondary/50 border-border focus:border-primary"
            />
          </div>
          {errors.email && <p className="text-[12px] text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type={showPwd ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-9 pr-10 h-11 bg-secondary/50 border-border focus:border-primary"
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-sf"
              tabIndex={-1}
            >
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {password && <PasswordStrength password={password} />}
          {errors.password && <p className="text-[12px] text-destructive">{errors.password}</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Confirmar contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type={showPwd ? "text" : "password"}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-9 h-11 bg-secondary/50 border-border focus:border-primary"
            />
          </div>
          {errors.confirmPassword && <p className="text-[12px] text-destructive">{errors.confirmPassword}</p>}
        </div>

        <Button type="submit" disabled={loading} className="w-full h-11 fire-button font-semibold mt-2">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <UserPlus className="w-4 h-4" />
              Crear cuenta
            </>
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
