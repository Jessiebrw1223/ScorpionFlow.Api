import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Rocket,
  Receipt,
  FolderKanban,
  BarChart3,
  ShieldAlert,
  TrendingUp,
  Users,
  Send,
  CheckCircle2,
  Trophy,
  Calendar,
  Wallet,
  AlertTriangle,
  Lightbulb,
  PlayCircle,
  Sparkles,
  ArrowRight,
  GraduationCap,
  ChevronRight,
  Lock,
  Crown,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { TopBar } from "@/components/TopBar";
import { usePlan, PLAN_LABELS, type PlanId } from "@/hooks/usePlan";
import { cn } from "@/lib/utils";

interface QuickStartCard {
  icon: React.ElementType;
  title: string;
  desc: string;
  to: string;
  cta: string;
}

const QUICK_START: QuickStartCard[] = [
  { icon: Rocket, title: "Empezar en 5 minutos", desc: "Tour rápido de la plataforma.", to: "#tour", cta: "Iniciar tour" },
  { icon: Receipt, title: "Crear primera cotización", desc: "Convierte una idea en venta.", to: "/cotizaciones", cta: "Ir a cotizaciones" },
  { icon: FolderKanban, title: "Crear primer proyecto", desc: "Organiza la ejecución.", to: "/projects", cta: "Ir a proyectos" },
  { icon: BarChart3, title: "Entender tus números", desc: "Lee tu dashboard como un dueño.", to: "/", cta: "Ver dashboard" },
  { icon: ShieldAlert, title: "Gestionar riesgos", desc: "Detecta lo que puede salir mal.", to: "/riesgos", cta: "Ver riesgos" },
  { icon: TrendingUp, title: "Mejorar rentabilidad", desc: "Cierra más, gasta mejor.", to: "/finanzas", cta: "Ver finanzas" },
];

interface GuideStep {
  title: string;
  desc: string;
  icon: React.ElementType;
}

interface Guide {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  steps: GuideStep[];
  keywords: string[];
}

const GUIDES: Guide[] = [
  {
    id: "vender",
    title: "Cómo vender con ScorpionFlow",
    subtitle: "De primer contacto a venta cerrada.",
    icon: Receipt,
    keywords: ["vender", "venta", "cliente", "cotizar", "cotización", "whatsapp", "ganar"],
    steps: [
      { icon: Users, title: "Crea el cliente", desc: "Registra los datos clave: nombre, contacto y notas." },
      { icon: Receipt, title: "Crea la cotización", desc: "Agrega ítems, precios y condiciones en minutos." },
      { icon: Send, title: "Envíala por WhatsApp", desc: "Comparte un enlace claro y profesional." },
      { icon: CheckCircle2, title: "Márcala como ganada", desc: "Cuando el cliente acepta, cambia el estado." },
      { icon: Trophy, title: "Conviértela en proyecto", desc: "Se crea automáticamente para empezar a ejecutar." },
    ],
  },
  {
    id: "proyecto",
    title: "Cómo crear un proyecto",
    subtitle: "Estructura el trabajo desde el día uno.",
    icon: FolderKanban,
    keywords: ["proyecto", "crear proyecto", "responsables", "fechas", "prioridad"],
    steps: [
      { icon: Sparkles, title: "Desde cero o desde cotización", desc: "Empieza limpio o reutiliza una venta ganada." },
      { icon: Users, title: "Asigna responsables", desc: "Cada tarea con un dueño claro." },
      { icon: Calendar, title: "Define fechas y prioridades", desc: "Plazos realistas evitan retrasos costosos." },
      { icon: BarChart3, title: "Sigue el avance", desc: "Revisa el tablero al menos una vez por semana." },
    ],
  },
  {
    id: "costos",
    title: "Cómo controlar costos",
    subtitle: "Margen sano = negocio sano.",
    icon: Wallet,
    keywords: ["costo", "costos", "recursos", "margen", "sobrecosto", "rentabilidad"],
    steps: [
      { icon: Users, title: "Registra tus recursos", desc: "Personas, equipos y proveedores." },
      { icon: Wallet, title: "Registra los costos reales", desc: "Lo que pagas, no solo lo que estimas." },
      { icon: AlertTriangle, title: "Detecta sobrecostos", desc: "El sistema te avisa cuando un proyecto se sale." },
      { icon: TrendingUp, title: "Mejora el margen", desc: "Ajusta precios o reduce gasto donde duele." },
    ],
  },
  {
    id: "riesgos",
    title: "Cómo usar Riesgos",
    subtitle: "Lo que no se mide, no se controla.",
    icon: ShieldAlert,
    keywords: ["riesgo", "riesgos", "impacto", "mitigar", "responsable"],
    steps: [
      { icon: ShieldAlert, title: "Identifica el riesgo", desc: "¿Qué puede salir mal y cuánto cuesta?" },
      { icon: BarChart3, title: "Mide impacto y probabilidad", desc: "Prioriza lo que más duele." },
      { icon: Users, title: "Asigna un responsable", desc: "Sin dueño, no se resuelve." },
      { icon: CheckCircle2, title: "Mitiga a tiempo", desc: "Acciones hoy = ahorro mañana." },
    ],
  },
  {
    id: "dashboard",
    title: "Cómo leer tu Dashboard",
    subtitle: "Tu negocio en una pantalla.",
    icon: BarChart3,
    keywords: ["dashboard", "ganancia", "flujo", "alertas", "saturación", "kpi"],
    steps: [
      { icon: TrendingUp, title: "Ganancia y margen", desc: "Cuánto entra, cuánto queda." },
      { icon: ShieldAlert, title: "Riesgos activos", desc: "Lo urgente que necesita atención." },
      { icon: Users, title: "Saturación de recursos", desc: "Quién está sobrecargado y quién libre." },
      { icon: Wallet, title: "Flujo esperado", desc: "Cobros y pagos de los próximos 30 días." },
      { icon: AlertTriangle, title: "Alertas inteligentes", desc: "El sistema te dice qué hacer hoy." },
    ],
  },
];

interface VideoTip {
  title: string;
  duration: string;
  topic: string;
}

const VIDEOS: VideoTip[] = [
  { title: "Crear cotización en 1 minuto", duration: "1:12", topic: "Comercial" },
  { title: "Entender rentabilidad", duration: "2:45", topic: "Finanzas" },
  { title: "Revisar proyectos en riesgo", duration: "1:58", topic: "Riesgos" },
];

const TIPS: { text: string; icon: React.ElementType }[] = [
  { text: "Si cotizas rápido, cierras más.", icon: Rocket },
  { text: "Revisa costos semanalmente.", icon: Wallet },
  { text: "Todo proyecto sin seguimiento pierde margen.", icon: TrendingUp },
  { text: "Los riesgos no atendidos cuestan dinero.", icon: ShieldAlert },
  { text: "Un cliente bien tratado vuelve y trae a otros.", icon: Users },
  { text: "Mide hoy, decide mañana.", icon: BarChart3 },
];

const PLAN_PLAYBOOKS: Record<PlanId, { title: string; items: string[] }> = {
  free: {
    title: "Guías básicas",
    items: [
      "Crea tu primer cliente y cotización.",
      "Convierte una venta ganada en proyecto.",
      "Aprende a leer las 3 KPIs del dashboard.",
    ],
  },
  starter: {
    title: "Plantillas de cotización",
    items: [
      "Reutiliza cotizaciones ganadas como plantillas.",
      "Estandariza precios y condiciones.",
      "Acorta tu tiempo de respuesta a clientes.",
    ],
  },
  pro: {
    title: "Buenas prácticas operativas",
    items: [
      "Revisa costos por proyecto cada semana.",
      "Asigna responsables únicos por tarea.",
      "Cierra riesgos abiertos antes de avanzar fases.",
      "Usa el informe de proyecto en cada reunión.",
    ],
  },
  business: {
    title: "Playbooks gerenciales · KPIs · Estrategia",
    items: [
      "Reunión semanal de 30 min con el Resumen Ejecutivo.",
      "Define umbrales de margen mínimo por tipo de proyecto.",
      "Audita el Centro de Riesgos cada lunes.",
      "Forecast mensual de caja con el Centro Financiero.",
      "Top 5 clientes por utilidad: enfócate ahí.",
    ],
  },
};

const TOUR_STEPS = [
  { n: 1, title: "Crea un cliente", desc: "Empieza por registrar a quién le vendes." },
  { n: 2, title: "Haz una cotización", desc: "Arma tu propuesta con ítems claros." },
  { n: 3, title: "Gana la venta", desc: "Marca la cotización como ganada." },
  { n: 4, title: "Ejecuta el proyecto", desc: "Asigna tareas y avanza con tu equipo." },
  { n: 5, title: "Controla la utilidad", desc: "Revisa costos y margen cada semana." },
];

export default function LearnCenterPage() {
  const [query, setQuery] = useState("");
  const { plan } = usePlan();

  const filteredGuides = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GUIDES;
    return GUIDES.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        g.subtitle.toLowerCase().includes(q) ||
        g.keywords.some((k) => k.includes(q)) ||
        g.steps.some((s) => s.title.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q)),
    );
  }, [query]);

  const playbook = PLAN_PLAYBOOKS[plan];

  return (
    <div className="space-y-6 pb-12">
      <TopBar />

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-card/60 p-6 sm:p-8">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-accent/10 pointer-events-none" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2 max-w-2xl">
            <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary text-[10px] uppercase tracking-widest font-semibold">
              <GraduationCap className="w-3 h-3 mr-1" /> Learn Center
            </Badge>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Centro de Ayuda <span className="fire-text">ScorpionFlow</span>
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Aprende a vender, organizar y controlar tu negocio paso a paso.
            </p>
          </div>
          <Badge variant="outline" className="border-border/60 bg-background/40 text-xs">
            <Crown className="w-3 h-3 mr-1 text-primary" />
            Tu plan: <span className="font-semibold ml-1">{PLAN_LABELS[plan]}</span>
          </Badge>
        </div>

        {/* Buscador */}
        <div className="relative mt-6 max-w-2xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="¿Qué deseas aprender? Ej: cotizar, costos, riesgos…"
            className="pl-9 h-11 bg-background/60"
          />
          {!query && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {["cotizar", "crear proyecto", "costos", "riesgos", "clientes", "dashboard"].map((s) => (
                <button
                  key={s}
                  onClick={() => setQuery(s)}
                  className="px-2.5 py-1 rounded-full text-[11px] bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-sf border border-border/40"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Inicio rápido */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Inicio rápido</h2>
          <span className="text-xs text-muted-foreground">Empieza por aquí</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {QUICK_START.map((c) => {
            const Icon = c.icon;
            const isAnchor = c.to.startsWith("#");
            const inner = (
              <Card className="group h-full bg-card/80 hover:bg-card border-border/60 hover:border-primary/40 transition-sf cursor-pointer hover:shadow-[0_0_24px_-12px_hsl(15_90%_55%/0.4)]">
                <CardContent className="p-5 space-y-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/15 transition-sf">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{c.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.desc}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-sf">
                    {c.cta} <ArrowRight className="w-3 h-3" />
                  </div>
                </CardContent>
              </Card>
            );
            return isAnchor ? (
              <a key={c.title} href={c.to}>
                {inner}
              </a>
            ) : (
              <Link key={c.title} to={c.to}>
                {inner}
              </Link>
            );
          })}
        </div>
      </section>

      {/* Tabs guías + videos + tour */}
      <Tabs defaultValue="guides" className="space-y-4">
        <TabsList className="bg-card/60 border border-border/60">
          <TabsTrigger value="guides">Guías paso a paso</TabsTrigger>
          <TabsTrigger value="videos">Videos cortos</TabsTrigger>
          <TabsTrigger value="tour" id="tour">Tour de 5 pasos</TabsTrigger>
          <TabsTrigger value="plan">Para tu plan</TabsTrigger>
        </TabsList>

        {/* Guías */}
        <TabsContent value="guides" className="space-y-3">
          {filteredGuides.length === 0 ? (
            <Card className="border-dashed border-border/60 bg-card/40">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No encontramos resultados para <span className="text-foreground font-medium">"{query}"</span>.
                Prueba con: cotizar, costos, riesgos.
              </CardContent>
            </Card>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {filteredGuides.map((g) => {
                const GIcon = g.icon;
                return (
                  <AccordionItem
                    key={g.id}
                    value={g.id}
                    className="border border-border/60 rounded-xl bg-card/60 px-4 data-[state=open]:bg-card data-[state=open]:border-primary/30"
                  >
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-3 text-left">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                          <GIcon className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{g.title}</div>
                          <div className="text-xs text-muted-foreground font-normal">{g.subtitle}</div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ol className="space-y-2 pl-1 pb-2">
                        {g.steps.map((s, idx) => {
                          const SIcon = s.icon;
                          return (
                            <li
                              key={idx}
                              className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/40"
                            >
                              <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 border border-primary/20 shrink-0">
                                <span className="text-[11px] font-bold text-primary">{idx + 1}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <SIcon className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span className="text-sm font-medium">{s.title}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </TabsContent>

        {/* Videos */}
        <TabsContent value="videos">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {VIDEOS.map((v) => (
              <Card key={v.title} className="group bg-card/80 hover:bg-card border-border/60 hover:border-primary/40 transition-sf cursor-pointer">
                <CardContent className="p-0 overflow-hidden rounded-t-lg">
                  <div className="relative aspect-video bg-gradient-to-br from-muted/40 to-muted/10 flex items-center justify-center">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5" />
                    <div className="relative w-14 h-14 rounded-full bg-primary/20 backdrop-blur border border-primary/30 flex items-center justify-center group-hover:scale-110 transition-sf">
                      <PlayCircle className="w-7 h-7 text-primary" />
                    </div>
                    <Badge className="absolute bottom-2 right-2 bg-background/80 text-foreground text-[10px] backdrop-blur">
                      {v.duration}
                    </Badge>
                  </div>
                </CardContent>
                <CardHeader className="p-4">
                  <CardTitle className="text-sm">{v.title}</CardTitle>
                  <CardDescription className="text-xs">{v.topic} · próximamente</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tour */}
        <TabsContent value="tour">
          <Card className="bg-card/80 border-border/60">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> Tour de activación
              </CardTitle>
              <CardDescription>5 pasos para empezar a vender hoy mismo.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {TOUR_STEPS.map((s) => (
                  <li key={s.n} className="flex items-start gap-4 p-3 rounded-lg bg-muted/30 border border-border/40">
                    <div className="w-9 h-9 rounded-full scorpion-gradient flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0 fire-glow">
                      {s.n}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{s.title}</div>
                      <div className="text-xs text-muted-foreground">{s.desc}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground self-center" />
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap gap-2 mt-5">
                <Button asChild size="sm">
                  <Link to="/clientes">Empezar ahora</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/cotizaciones">Ir a cotizaciones</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Plan */}
        <TabsContent value="plan">
          <Card className="bg-card/80 border-border/60">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Crown className="w-4 h-4 text-primary" /> {playbook.title}
              </CardTitle>
              <CardDescription>
                Recomendaciones específicas para tu plan <span className="font-semibold text-foreground">{PLAN_LABELS[plan]}</span>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {playbook.items.map((it, i) => (
                  <li key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm">{it}</span>
                  </li>
                ))}
              </ul>
              {plan !== "business" && (
                <div className={cn(
                  "mt-4 p-4 rounded-lg border border-primary/30 bg-primary/5 flex items-start gap-3",
                )}>
                  <Lock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold">Desbloquea más playbooks</div>
                    <p className="text-xs text-muted-foreground">
                      Sube de plan para acceder a guías comerciales avanzadas, KPIs ejecutivos y estrategia.
                    </p>
                  </div>
                  <Button asChild size="sm" variant="default">
                    <Link to="/settings">Ver planes</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Tips */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-primary" />
          <h2 className="text-lg font-semibold">Consejos de negocio</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TIPS.map((t) => {
            const Icon = t.icon;
            return (
              <Card key={t.text} className="bg-card/60 border-border/60">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-sm leading-snug">{t.text}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* CTA final */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card to-card/40 p-6 text-center">
        <Sparkles className="w-6 h-6 text-primary mx-auto mb-2" />
        <h3 className="text-base font-semibold">¿Listo para vender más y mejor?</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Empieza con un cliente, cierra una cotización y deja que ScorpionFlow haga el resto.
        </p>
        <div className="flex flex-wrap gap-2 justify-center mt-4">
          <Button asChild size="sm">
            <Link to="/clientes">Crear cliente</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/cotizaciones">Nueva cotización</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
