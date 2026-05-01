import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthSuccessPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      navigate("/auth/login", { replace: true });
      return;
    }

    localStorage.setItem("scorpionflow_access_token", token);
    navigate("/dashboard", { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen grid place-items-center bg-background text-foreground">
      <p className="text-sm text-muted-foreground">Validando sesión...</p>
    </div>
  );
}
