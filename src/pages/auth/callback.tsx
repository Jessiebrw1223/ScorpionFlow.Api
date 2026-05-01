import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function Callback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuth = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data?.session) {
        console.error(error);
        navigate("/auth/login");
        return;
      }

      navigate("/dashboard");
    };

    handleAuth();
  }, [navigate]);

  return <p>Iniciando sesión...</p>;
}