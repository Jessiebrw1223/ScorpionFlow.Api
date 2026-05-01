import { ReactNode } from "react";
import { Flame } from "lucide-react";
import { FireBackground } from "@/components/FireBackground";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-background relative flex items-center justify-center p-4 overflow-hidden">
      <FireBackground emberCount={40} />

      {/* Diagonal scanlines */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, hsl(15 90% 55%) 0px, hsl(15 90% 55%) 1px, transparent 1px, transparent 12px)",
        }}
      />

      <div className="relative z-10 w-full max-w-md ignite-in">
        {/* Brand header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl scorpion-gradient flex items-center justify-center fire-glow shadow-2xl mb-3">
            <Flame className="w-7 h-7 text-primary-foreground fire-icon" />
          </div>
          <h1 className="text-2xl font-bold fire-text tracking-tight">ScorpionFlow</h1>
          <p className="text-[11px] text-muted-foreground tracking-[0.25em] uppercase mt-1">
            Project Control
          </p>
        </div>

        {/* Card */}
        <div className="surface-card fire-border p-6 space-y-5 backdrop-blur-sm">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-foreground">{title}</h2>
            <p className="text-[13px] text-muted-foreground">{subtitle}</p>
          </div>

          {children}
        </div>

        {footer && <div className="mt-5 text-center text-[13px] text-muted-foreground">{footer}</div>}

        <p className="mt-8 text-center text-[10px] text-muted-foreground/60 tracking-widest uppercase">
          🦂 Sistema de control empresarial
        </p>
      </div>
    </div>
  );
}
