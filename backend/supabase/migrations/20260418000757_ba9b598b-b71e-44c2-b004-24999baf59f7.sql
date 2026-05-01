-- Tabla de aportes adicionales del propietario al proyecto
CREATE TABLE public.project_contributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  reason TEXT,
  contributed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.project_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners view contributions" ON public.project_contributions
  FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "owners insert contributions" ON public.project_contributions
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners update contributions" ON public.project_contributions
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "owners delete contributions" ON public.project_contributions
  FOR DELETE USING (auth.uid() = owner_id);

CREATE INDEX idx_project_contributions_project ON public.project_contributions(project_id);

CREATE TRIGGER update_project_contributions_updated_at
BEFORE UPDATE ON public.project_contributions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();