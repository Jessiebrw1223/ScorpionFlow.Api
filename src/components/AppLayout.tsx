import { ReactNode } from "react";
import { FireBackground } from "@/components/FireBackground";
import { TopBar } from "@/components/TopBar";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background relative">
      <FireBackground emberCount={28} />
      <main className="ml-60 p-6 relative z-10">
        <TopBar />
        {children}
      </main>
    </div>
  );
}
