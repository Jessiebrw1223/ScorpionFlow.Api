import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { Lock, Loader2, ShieldCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const schema = z
  .object({
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

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const parsed = schema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      const fld = parsed.error.flatten().fieldErrors;
      setErrors({ password: fld.password?.[0] || "", confirmPassword: fld.confirmPassword?.[0] || "" });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast.error("No se pudo actualizar", { description: error.message });
      return;
    }
    toast.success("Contraseña actualizada", { description: "Ya puedes acceder con tu nueva contraseña." });
    navigate("/auth/login");
  };

  return (
    <AuthLayout title="Nueva contraseña" subtitle="Crea una contraseña fuerte para proteger tu cuenta">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nueva contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-9 h-11 bg-secondary/50 border-border focus:border-primary"
            />
          </div>
          {errors.password && <p className="text-[12px] text-destructive">{errors.password}</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Confirmar</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-9 h-11 bg-secondary/50 border-border focus:border-primary"
            />
          </div>
          {errors.confirmPassword && <p className="text-[12px] text-destructive">{errors.confirmPassword}</p>}
        </div>

        <Button type="submit" disabled={loading} className="w-full h-11 fire-button font-semibold">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              Actualizar contraseña
            </>
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
