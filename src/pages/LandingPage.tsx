import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  Flame,
  ArrowRight,
  Eye,
  AlertTriangle,
  TrendingDown,
  Activity,
  ShieldCheck,
  CheckCircle2,
  PlayCircle,
  Target,
  LineChart,
  Sparkles,
  Minus,
  BarChart3,
  Lightbulb,
  Compass,
  Users,
  UserPlus,
  Share2,
  ShieldAlert,
  Eye as EyeIcon,
  GraduationCap,
  FileText,
  Wallet,
  ShieldQuestion,
  HelpCircle,
  Plus,
  Quote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAuth } from "@/contexts/AuthContext";

type Billing = "monthly" | "annual";

const ROTATING_QUESTIONS = [
  "¿Tu proyecto realmente está funcionando como esperas?",
  "¿Trabajas mucho… pero sabes si estás ganando dinero?",
  "¿Tus proyectos avanzan o solo consumen recursos?",
  "¿Tomas decisiones con datos… o por intuición?",
];

const PLANS = [
  {
    id: "free",
    name: "Free",
    monthly: 0,
    emotional: "Empieza sin riesgo",
    features: ["Hasta 5 usuarios", "Hasta 3 proyectos", "Tareas básicas", "Vista simple"],
    cta: "Empezar gratis",
    highlight: false,
  },
  {
    id: "starter",
    name: "Starter",
    monthly: 45,
    emotional: "Vende y organiza mejor",
    features: ["Hasta 10 usuarios", "Proyectos ilimitados", "Cotizaciones profesionales", "Colaboración ampliada"],
    cta: "Activar Starter",
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 101,
    emotional: "Control total para crecer",
    features: [
      "Usuarios ilimitados",
      "Control financiero completo",
      "Margen real y ROI",
      "Costos por tarea",
      "Alertas inteligentes",
      "Gestión de recursos",
    ],
    cta: "Activar Pro",
    highlight: true,
  },
  {
    id: "business",
    name: "Business",
    monthly: 225,
    emotional: "Visión estratégica completa",
    features: [
      "Todo lo de Pro",
      "Centro financiero corporativo",
      "Riesgos empresariales",
      "Analítica ejecutiva",
      "Reportes multi-proyecto",
    ],
    cta: "Hablar con ventas",
    highlight: false,
  },
];

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "¿Necesito tarjeta de crédito para empezar?",
    a: "No. El plan Free es gratis para siempre y no pide tarjeta. Solo te pediremos datos de pago cuando decidas activar Starter, Pro o Business.",
  },
  {
    q: "¿Sirve para equipos pequeños?",
    a: "Sí. ScorpionFlow está diseñado para equipos desde 1 persona hasta 50+. La mayoría de nuestros usuarios son agencias y PYMEs B2B con 3 a 20 colaboradores.",
  },
  {
    q: "¿Puedo cancelar cuando quiera?",
    a: "Sí. Cancelas con un clic desde Configuración. No hay permanencia, ni penalidades, ni letras chicas.",
  },
  {
    q: "¿Necesito saber de gestión de proyectos para usarlo?",
    a: "No. Hablamos como un negocio real, no como un manual técnico. En menos de 30 segundos entiendes cómo cotizar, ejecutar y ver tu margen.",
  },
  {
    q: "¿Cuánto demoro en empezar?",
    a: "Menos de 5 minutos. Creas tu cuenta, invitas a tu equipo con un correo y haces tu primera cotización en el mismo día.",
  },
];

const COMPARE_ROWS: Array<{
  label: string;
  values: [string | boolean, string | boolean, string | boolean, string | boolean];
}> = [
  { label: "Usuarios / Equipo", values: ["5", "10", "Ilimitado", "Ilimitado"] },
  { label: "Proyectos", values: ["3", "Ilimitado", "Ilimitado", "Ilimitado"] },
  { label: "Clientes", values: ["limitado", true, true, true] },
  { label: "Indicadores de rentabilidad", values: [false, false, true, true] },
  { label: "Margen real", values: [false, false, true, true] },
  { label: "ROI claro", values: [false, false, true, true] },
  { label: "Alertas inteligentes", values: [false, false, true, true] },
  { label: "Gestión de recursos", values: [false, false, true, true] },
];

/**
 * Landing pública de ScorpionFlow.
 * Tono profesional y empático: claridad, control y mejores decisiones.
 */
export default function LandingPage() {
  const { user, loading } = useAuth();
  const [billing, setBilling] = useState<Billing>("monthly");
  const [questionIndex, setQuestionIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setQuestionIndex((i) => (i + 1) % ROTATING_QUESTIONS.length);
    }, 3800);
    return () => clearInterval(interval);
  }, []);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center fire-glow">
              <Flame className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">
              Scorpion<span className="text-primary">Flow</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-[13px] text-muted-foreground">
            <a href="#problema" className="hover:text-foreground transition-colors">Problema</a>
            <a href="#solucion" className="hover:text-foreground transition-colors">Solución</a>
            <a href="#nosotros" className="hover:text-foreground transition-colors">Nosotros</a>
            <a href="#precios" className="hover:text-foreground transition-colors">Precios</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth/login">
              <Button variant="ghost" size="sm" className="text-[13px]">Ingresar</Button>
            </Link>
            <Link to="/auth/register">
              <Button size="sm" className="fire-button text-[13px] font-semibold">
                Empezar gratis
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative">
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-accent/10 blur-[100px]" />
        </div>

        <div className="max-w-6xl mx-auto px-5 pt-20 pb-24 md:pt-28 md:pb-32 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-secondary/40 text-[11px] uppercase tracking-widest text-muted-foreground mb-6">
            <Sparkles className="w-3 h-3 text-primary" />
            Gestión clara para proyectos y negocio
          </div>

          <h1 className="text-[28px] sm:text-4xl md:text-6xl font-bold tracking-tight leading-[1.1] max-w-4xl mx-auto min-h-[8.5rem] sm:min-h-[7.5rem] md:min-h-[10rem] flex items-center justify-center px-1">
            <span key={questionIndex} className="block animate-fade-in text-foreground">
              {ROTATING_QUESTIONS[questionIndex].split("…").map((part, i, arr) => (
                <span key={i}>
                  {i === arr.length - 1 ? (
                    <span className="text-primary">{part}</span>
                  ) : (
                    <>{part}…</>
                  )}
                </span>
              ))}
            </span>
          </h1>

          <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Controla ventas, proyectos, costos y utilidad en un solo lugar.
          </p>

          <p className="mt-4 text-sm md:text-base text-foreground/70 max-w-xl mx-auto">
            Más claridad. Mejores decisiones.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/auth/register">
              <Button size="lg" className="fire-button h-12 px-7 font-semibold text-sm gap-2">
                <Flame className="w-4 h-4" />
                Empezar gratis
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <a href="#demo">
              <Button size="lg" variant="outline" className="h-12 px-7 text-sm gap-2 border-border hover:border-primary/50">
                <Eye className="w-4 h-4" />
                Ver ejemplo real
              </Button>
            </a>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Sin tarjeta de crédito</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Empiezas en minutos</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Sin compromiso</span>
          </div>
        </div>
      </section>

      {/* PROBLEMA — empático */}
      <section id="problema" className="border-t border-border/60 bg-secondary/20">
        <div className="max-w-6xl mx-auto px-5 py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-[11px] uppercase tracking-widest text-primary font-semibold">El problema real</span>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
              Tener todo organizado…
              <span className="block text-muted-foreground">no siempre significa tener claridad.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                icon: BarChart3,
                title: "Avanzas, pero no ves el impacto",
                body: "Tus proyectos progresan, pero no siempre sabes cómo afectan al negocio.",
              },
              {
                icon: Lightbulb,
                title: "Decides con información parcial",
                body: "Tienes datos en muchos lados, pero no una imagen completa para decidir bien.",
              },
              {
                icon: Compass,
                title: "Varias herramientas, ninguna te orienta",
                body: "Cada app resuelve un pedazo. Falta una visión integrada del negocio.",
              },
            ].map(({ icon: Icon, title, body }, i) => (
              <div key={i} className="group rounded-xl border border-border bg-card p-6 hover:border-primary/40 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Icon className="w-5 h-5" />
                </div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-muted-foreground mt-1">{body}</p>
              </div>
            ))}
          </div>

          <p className="mt-10 text-center text-base md:text-lg text-foreground/85 max-w-xl mx-auto">
            No es falta de trabajo.
            <span className="block font-semibold text-primary mt-1">Es falta de visibilidad.</span>
          </p>
        </div>
      </section>

      {/* DEMO */}
      <section id="demo" className="border-t border-border/60">
        <div className="max-w-6xl mx-auto px-5 py-20 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="text-[11px] uppercase tracking-widest text-primary font-semibold">Ejemplo real</span>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight leading-tight">
              Con la información correcta,
              <span className="block text-primary">puedes actuar antes.</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              Así se ven los indicadores clave de un proyecto cuando cada número
              está donde debe estar: presupuesto, gasto y resultado, juntos.
            </p>
            <div className="mt-6">
              <Link to="/auth/register">
                <Button size="lg" className="fire-button h-12 px-6 font-semibold text-sm gap-2">
                  <PlayCircle className="w-4 h-4" />
                  Ver cómo funciona
                </Button>
              </Link>
            </div>
          </div>

          {/* Mock card */}
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-br from-primary/20 to-accent/20 blur-2xl rounded-3xl" />
            <div className="relative rounded-2xl border border-border bg-card p-5 shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Proyecto</p>
                  <p className="font-semibold">Hotel Costa Sur — Renovación</p>
                </div>
                <span className="px-2 py-1 rounded-md bg-destructive/15 text-destructive text-[11px] font-semibold border border-destructive/30">
                  Requiere atención
                </span>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border border-border bg-secondary/40 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Presupuesto</p>
                  <p className="font-mono-data font-semibold mt-1">S/ 48,000</p>
                </div>
                <div className="rounded-lg border border-border bg-secondary/40 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Gastado</p>
                  <p className="font-mono-data font-semibold mt-1 text-cost-warning">S/ 51,200</p>
                </div>
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-destructive">Resultado</p>
                  <p className="font-mono-data font-semibold mt-1 text-destructive">−S/ 3,200</p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                  <span>Desviación de costos del 6.7% sobre lo presupuestado.</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <TrendingDown className="w-4 h-4 text-cost-warning shrink-0" />
                  <span>El margen pasó del 22% al −6%.</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Activity className="w-4 h-4 text-status-blocked shrink-0" />
                  <span>2 riesgos detectados antes del cierre.</span>
                </div>
              </div>

              <p className="mt-5 text-[12px] text-muted-foreground border-t border-border pt-3">
                Con esta vista, sabes dónde corregir antes de que sea tarde.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* TRANSFORMACIÓN — Antes / Después */}
      <section className="border-t border-border/60 bg-secondary/20">
        <div className="max-w-6xl mx-auto px-5 py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-[11px] uppercase tracking-widest text-primary font-semibold">Transformación</span>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
              Cuando entiendes los números,
              <span className="block text-primary">trabajas diferente.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card p-6">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-4 font-semibold">Antes</p>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2"><Minus className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> Tomas decisiones con dudas</li>
                <li className="flex items-start gap-2"><Minus className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> Detectas problemas tarde</li>
                <li className="flex items-start gap-2"><Minus className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /> Ajustas sobre la marcha</li>
              </ul>
            </div>
            <div className="rounded-xl border border-cost-positive/40 bg-cost-positive/5 p-6">
              <p className="text-[11px] uppercase tracking-widest text-cost-positive mb-4 font-semibold">Después</p>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-cost-positive mt-0.5 shrink-0" /> Ves lo importante</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-cost-positive mt-0.5 shrink-0" /> Tomas decisiones con confianza</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-cost-positive mt-0.5 shrink-0" /> Actúas a tiempo</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* SOLUCIÓN */}
      <section id="solucion" className="border-t border-border/60">
        <div className="max-w-6xl mx-auto px-5 py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-[11px] uppercase tracking-widest text-primary font-semibold">La solución</span>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
              Una herramienta para gestionar…
              <span className="block text-primary">y entender.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Target, title: "Todo en un solo lugar", body: "Proyectos, clientes y números, sin saltar entre apps." },
              { icon: LineChart, title: "Datos claros en tiempo real", body: "Costos, márgenes y avance se calculan solos." },
              { icon: AlertTriangle, title: "Alertas que ayudan", body: "Te avisamos antes, para que puedas reaccionar a tiempo." },
              { icon: ShieldCheck, title: "Visión completa", body: "Sin depender de Excel ni hojas externas." },
            ].map(({ icon: Icon, title, body }, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-6">
                <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-muted-foreground mt-1">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COLABORACIÓN */}
      <section id="colaboracion" className="border-t border-border/60 bg-secondary/20">
        <div className="max-w-6xl mx-auto px-5 py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-[11px] uppercase tracking-widest text-primary font-semibold">Trabaja en equipo</span>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
              No trabajas solo.
              <span className="block text-primary">Tus proyectos tampoco deberían.</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              Invita a tu equipo, comparte la información correcta y toma decisiones alineadas.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: UserPlus, title: "Invita en segundos", body: "Suma colaboradores con un correo y empiezan a trabajar juntos." },
              { icon: Share2, title: "Misma información", body: "Todos ven los mismos datos, en tiempo real, sin versiones." },
              { icon: ShieldAlert, title: "Menos errores", body: "Evitas decisiones desalineadas y duplicación de trabajo." },
              { icon: EyeIcon, title: "Control compartido", body: "Visibilidad conjunta sin perder claridad ni gobernanza." },
            ].map(({ icon: Icon, title, body }, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-6">
                <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-muted-foreground mt-1">{body}</p>
              </div>
            ))}
          </div>

          <p className="mt-10 text-center text-base md:text-lg text-foreground/85 max-w-xl mx-auto">
            La claridad no sirve si no es compartida.
            <span className="block font-semibold text-primary mt-1">
              No solo entiendes tu negocio. Tu equipo también.
            </span>
          </p>
        </div>
      </section>

      {/* DIFERENCIA */}
      <section id="diferencia" className="border-t border-border/60">
        <div className="max-w-6xl mx-auto px-5 py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-[11px] uppercase tracking-widest text-primary font-semibold">La diferencia</span>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
              No solo organizas tu trabajo.
              <span className="block text-primary">También entiendes tu negocio.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card p-6">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-3">Otras herramientas</p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Organización</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Seguimiento de tareas</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Estructura de equipo</li>
              </ul>
            </div>
            <div className="rounded-xl border border-primary/40 bg-gradient-to-br from-primary/10 to-accent/5 p-6 fire-glow">
              <p className="text-[11px] uppercase tracking-widest text-primary mb-3 font-semibold">ScorpionFlow</p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Visibilidad financiera</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Indicadores claros</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Apoyo para tomar decisiones</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* SOBRE NOSOTROS — Narrativa con timeline */}
      <section id="nosotros" className="border-t border-border/60 bg-secondary/20 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-1/3 left-[-10%] w-[400px] h-[400px] rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute bottom-0 right-[-10%] w-[500px] h-[500px] rounded-full bg-accent/5 blur-[120px]" />
        </div>

        <div className="max-w-5xl mx-auto px-5 py-24">
          {/* Hero identidad */}
          <div className="text-center max-w-3xl mx-auto mb-20">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-secondary/40 text-[11px] uppercase tracking-widest text-muted-foreground mb-6">
              <Users className="w-3 h-3 text-primary" />
              Nosotros
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.1]">
              No creamos otra herramienta.
              <span className="block text-primary mt-2">Creamos claridad para tomar mejores decisiones.</span>
            </h2>
            <p className="mt-6 text-base md:text-lg text-muted-foreground leading-relaxed">
              ScorpionFlow nace de una necesidad real: entender qué está pasando
              en un proyecto, más allá de tareas y estados.
            </p>
            <p className="mt-4 text-[13px] text-foreground/60 italic">
              Construido desde la experiencia real.
            </p>
          </div>

          {/* Timeline narrativa */}
          <div className="relative max-w-3xl mx-auto">
            {/* Línea vertical */}
            <div className="absolute left-5 md:left-6 top-2 bottom-2 w-px bg-gradient-to-b from-primary/60 via-border to-transparent" />

            <div className="space-y-10">
              {[
                {
                  icon: Compass,
                  tag: "El contexto",
                  title: "Usábamos herramientas que organizaban bien el trabajo.",
                  body: "Tareas, cronogramas, seguimiento. Pero algo no estaba claro: el impacto real de cada proyecto en el negocio. Teníamos información, no una visión completa.",
                },
                {
                  icon: Lightbulb,
                  tag: "La brecha",
                  title: "Gestionar no es lo mismo que entender.",
                  body: "Tener datos no significa tener claridad. Y muchas decisiones se toman sin ver el panorama completo. Esa falta de visibilidad genera errores, retrasos y pérdidas que podrían evitarse.",
                },
                {
                  icon: Flame,
                  tag: "Nuestra respuesta",
                  title: "Decidimos construir algo diferente.",
                  body: "No una herramienta más para gestionar tareas. Una plataforma que permita entender lo que está pasando, identificar riesgos a tiempo y tomar decisiones con información clara.",
                },
                {
                  icon: LineChart,
                  tag: "Lo que es hoy",
                  title: "Trabajo, proyectos y negocio en un solo lugar.",
                  body: "Hoy ScorpionFlow conecta tareas, proyectos e información clave del negocio, con un objetivo claro: dar contexto a cada decisión.",
                },
                {
                  icon: Target,
                  tag: "Propósito",
                  title: "Que cada equipo entienda la realidad de sus proyectos.",
                  body: "Ayudar a personas y equipos a tomar decisiones con claridad, basadas en información que sí refleja lo que está pasando.",
                },
                {
                  icon: Sparkles,
                  tag: "Visión",
                  title: "Redefinir cómo se gestionan los proyectos.",
                  body: "Integrar trabajo y negocio en un sistema donde cada decisión tenga sentido, sustentada por datos claros y a tiempo.",
                },
              ].map(({ icon: Icon, tag, title, body }, i) => (
                <div key={i} className="relative pl-16 md:pl-20 group">
                  <div className="absolute left-0 top-0 w-10 h-10 md:w-12 md:h-12 rounded-xl border border-border bg-card flex items-center justify-center group-hover:border-primary/50 group-hover:bg-primary/5 transition-colors">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mb-1.5">
                    {tag}
                  </p>
                  <h3 className="text-lg md:text-xl font-semibold tracking-tight">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm md:text-[15px] text-muted-foreground leading-relaxed">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Filosofía */}
          <div className="mt-20 max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <span className="text-[11px] uppercase tracking-widest text-primary font-semibold">
                Filosofía de trabajo
              </span>
              <h3 className="mt-3 text-2xl md:text-3xl font-bold tracking-tight">
                En lo que creemos.
              </h3>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { title: "La claridad reduce la incertidumbre", body: "Cuando ves los números, decides distinto." },
                { title: "Mejor información, mejores decisiones", body: "No es cuánto sabes, es cómo lo entiendes." },
                { title: "Las herramientas deben simplificar", body: "Si te complican, no están haciendo su trabajo." },
              ].map((p, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-6">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <p className="font-semibold text-[15px]">{p.title}</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">{p.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Cierre emocional */}
          <div className="mt-20 text-center max-w-2xl mx-auto">
            <div className="inline-block">
              <div className="h-px w-16 bg-primary/40 mx-auto mb-8" />
              <p className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">
                No se trata de hacer más.
                <span className="block text-primary mt-1">Se trata de entender mejor.</span>
              </p>
              <p className="mt-6 text-[13px] text-muted-foreground italic">
                — El equipo de ScorpionFlow
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="precios" className="border-t border-border/60">
        <div className="max-w-6xl mx-auto px-5 py-20">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <span className="text-[11px] uppercase tracking-widest text-primary font-semibold">Precios</span>
            <h2 className="mt-3 text-3xl md:text-5xl font-bold tracking-tight leading-[1.1]">
              Empiezas gratis.
              <span className="block bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                Escala cuando lo necesites.
              </span>
            </h2>
            <p className="mt-5 text-sm md:text-base text-muted-foreground">
              A medida que creces, necesitas más claridad. Cada plan está
              pensado para acompañarte en esa evolución.
            </p>
          </div>

          {/* Toggle Mensual / Anual */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex items-center gap-1 p-1 rounded-full border border-border bg-card">
              <button
                onClick={() => setBilling("monthly")}
                className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-all ${
                  billing === "monthly"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Mensual
              </button>
              <button
                onClick={() => setBilling("annual")}
                className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-all flex items-center gap-1.5 ${
                  billing === "annual"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Anual
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  billing === "annual" ? "bg-primary-foreground/20" : "bg-cost-positive/15 text-cost-positive"
                }`}>
                  −20%
                </span>
              </button>
            </div>
          </div>

          {/* Cards de planes */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
            {PLANS.map((plan) => {
              const effectivePrice = billing === "annual"
                ? Math.round(plan.monthly * 0.8)
                : plan.monthly;
              const isFree = plan.monthly === 0;
              const isPro = plan.highlight;

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl border p-6 flex flex-col transition-all ${
                    isPro
                      ? "border-primary bg-gradient-to-br from-primary/15 via-card to-accent/5 fire-glow scale-100 lg:scale-105 z-10"
                      : "border-border bg-card hover:border-border/80"
                  }`}
                >
                  {isPro && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground text-[10px] uppercase tracking-widest font-bold shadow-lg whitespace-nowrap">
                      ⭐ Más elegido por empresas en crecimiento
                    </span>
                  )}

                  <p className={`text-[11px] uppercase tracking-widest font-semibold ${
                    isPro ? "text-primary" : "text-muted-foreground"
                  }`}>
                    {plan.name}
                  </p>

                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight">
                      S/ {effectivePrice}
                    </span>
                    <span className="text-sm font-normal text-muted-foreground">/mes</span>
                  </div>
                  {billing === "annual" && !isFree && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      antes <span className="line-through">S/ {plan.monthly}</span> · facturado anual
                    </p>
                  )}
                  {billing === "monthly" && !isFree && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      o S/ {Math.round(plan.monthly * 0.8)}/mes anual
                    </p>
                  )}
                  {isFree && <p className="mt-1 text-[11px] text-muted-foreground">para siempre</p>}

                  <p className={`mt-4 text-sm font-medium ${
                    isPro ? "text-foreground" : "text-muted-foreground"
                  }`}>
                    {plan.emotional}
                  </p>

                  <ul className="mt-5 space-y-2 text-sm flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${
                          isPro ? "text-primary" : "text-cost-positive/70"
                        }`} />
                        <span className="text-foreground/90">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Link to="/auth/register" className="mt-6">
                    <Button
                      className={`w-full ${isPro ? "fire-button font-semibold" : ""}`}
                      variant={isPro ? "default" : isFree ? "secondary" : "outline"}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>

          {/* TABLA COMPARATIVA */}
          <div className="mt-20">
            <div className="text-center max-w-2xl mx-auto mb-8">
              <span className="text-[11px] uppercase tracking-widest text-primary font-semibold">Comparativa</span>
              <h3 className="mt-3 text-2xl md:text-3xl font-bold tracking-tight">
                Lo que puedes ver en cada plan
              </h3>
              <p className="mt-3 text-sm text-muted-foreground">
                No se trata solo de gestionar tareas. Se trata de entender el impacto.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left font-semibold text-muted-foreground px-5 py-4 min-w-[200px]">
                        Función clave
                      </th>
                      {PLANS.map((p) => (
                        <th
                          key={p.id}
                          className={`text-center font-semibold px-4 py-4 min-w-[110px] ${
                            p.highlight ? "text-primary bg-primary/5" : "text-foreground"
                          }`}
                        >
                          {p.name}
                          {p.highlight && (
                            <span className="block text-[9px] uppercase tracking-widest text-primary/80 mt-0.5">
                              Recomendado
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARE_ROWS.map((row, idx) => (
                      <tr
                        key={row.label}
                        className={`border-b border-border/60 last:border-b-0 ${
                          idx % 2 === 0 ? "bg-transparent" : "bg-secondary/10"
                        }`}
                      >
                        <td className="px-5 py-3.5 font-medium text-foreground/90">{row.label}</td>
                        {row.values.map((v, i) => {
                          const isProCol = i === 2;
                          return (
                            <td
                              key={i}
                              className={`text-center px-4 py-3.5 ${
                                isProCol ? "bg-primary/5" : ""
                              }`}
                            >
                              {v === true ? (
                                <CheckCircle2 className={`inline w-5 h-5 ${
                                  isProCol ? "text-primary" : "text-cost-positive"
                                }`} />
                              ) : v === false ? (
                                <Minus className="inline w-4 h-4 text-muted-foreground/40" />
                              ) : (
                                <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                                  {v}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="mt-8 text-center text-base md:text-lg text-foreground/85 max-w-2xl mx-auto">
              Cada nivel suma claridad.
              <span className="block font-semibold text-primary mt-1">
                Tú eliges hasta dónde quieres ver.
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* PRUEBA SOCIAL */}
      <section id="prueba-social" className="border-t border-border/60 bg-secondary/20">
        <div className="max-w-6xl mx-auto px-5 py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-[11px] uppercase tracking-widest text-primary font-semibold">Confianza</span>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
              Equipos que necesitaban claridad
              <span className="block text-primary">eligieron ScorpionFlow.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-12">
            {[
              { value: "+1,200", label: "proyectos gestionados" },
              { value: "+3,800", label: "cotizaciones creadas" },
              { value: "+450", label: "equipos colaborando" },
            ].map((m, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-card p-8 text-center hover:border-primary/40 transition-colors"
              >
                <p className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  {m.value}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{m.label}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {[
              {
                quote: "Por fin sé qué proyectos me dan dinero y cuáles me lo quitan. Cambió cómo decido.",
                author: "Gerente comercial · Agencia de marketing",
              },
              {
                quote: "Dejamos de cotizar a ciegas. Ahora cerramos más rápido y con margen real.",
                author: "Director de operaciones · Constructora",
              },
            ].map((t, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-6">
                <Quote className="w-5 h-5 text-primary mb-3" />
                <p className="text-[15px] text-foreground/90 leading-relaxed">"{t.quote}"</p>
                <p className="mt-4 text-[12px] uppercase tracking-widest text-muted-foreground">
                  {t.author}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EDUCACIÓN RÁPIDA */}
      <section id="educacion" className="border-t border-border/60">
        <div className="max-w-6xl mx-auto px-5 py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-[11px] uppercase tracking-widest text-primary font-semibold">Aprende en minutos</span>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
              Aprende a usarlo
              <span className="block text-primary">en minutos.</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              Sin capacitaciones largas. Sin manuales. Solo abre y empieza.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {[
              { icon: FileText, title: "Cómo cotizar rápido", body: "Crea propuestas profesionales en menos de 2 minutos." },
              { icon: Wallet, title: "Cómo controlar costos", body: "Ve qué consume tu margen antes de que sea tarde." },
              { icon: TrendingDown, title: "Cómo detectar pérdidas", body: "Identifica proyectos que no son rentables a tiempo." },
              { icon: ShieldQuestion, title: "Cómo revisar riesgos", body: "Visibilidad total de lo que puede salir mal." },
            ].map(({ icon: Icon, title, body }, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-card p-6 hover:border-primary/40 transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Icon className="w-5 h-5" />
                </div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-muted-foreground mt-1">{body}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link to="/auth/register">
              <Button size="lg" variant="outline" className="h-12 px-7 gap-2 border-border hover:border-primary/50">
                <GraduationCap className="w-4 h-4" />
                Explorar Learn Center
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border/60 bg-secondary/20">
        <div className="max-w-3xl mx-auto px-5 py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-[11px] uppercase tracking-widest text-primary font-semibold">Preguntas frecuentes</span>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
              Resolvemos tus dudas
              <span className="block text-primary">antes de empezar.</span>
            </h2>
          </div>

          <Accordion type="single" collapsible className="space-y-3">
            {FAQS.map((item, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="rounded-xl border border-border bg-card px-5 data-[state=open]:border-primary/40 transition-colors"
              >
                <AccordionTrigger className="text-left font-semibold hover:no-underline py-4">
                  <span className="flex items-center gap-3">
                    <HelpCircle className="w-4 h-4 text-primary shrink-0" />
                    {item.q}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-[15px] leading-relaxed pb-5 pl-7">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="border-t border-border/60 bg-gradient-to-b from-background to-secondary/30 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-primary/10 blur-[120px]" />
        </div>
        <div className="max-w-3xl mx-auto px-5 py-24 text-center">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
            Tu negocio no necesita
            <span className="block text-muted-foreground">más herramientas sueltas.</span>
            <span className="block text-primary mt-2">Necesita claridad.</span>
          </h2>
          <p className="mt-6 text-muted-foreground text-base md:text-lg">
            Empieza gratis hoy y entiende lo que pasa detrás de tus proyectos.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/auth/register">
              <Button size="lg" className="fire-button h-12 px-8 font-semibold gap-2">
                <Flame className="w-4 h-4" />
                Empezar gratis ahora
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/auth/register">
              <Button size="lg" variant="outline" className="h-12 px-8 gap-2">
                <PlayCircle className="w-4 h-4" />
                Solicitar demo
              </Button>
            </Link>
          </div>
          <p className="mt-6 text-[12px] text-muted-foreground">
            Sin tarjeta de crédito · Empiezas en minutos · Sin compromiso
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/60">
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col md:flex-row items-center justify-between gap-3 text-[12px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <Flame className="w-3.5 h-3.5 text-primary" />
            <span>© {new Date().getFullYear()} ScorpionFlow — Gestiona y entiende tu negocio.</span>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/auth/login" className="hover:text-foreground transition-colors">Ingresar</Link>
            <Link to="/auth/register" className="hover:text-foreground transition-colors">Crear cuenta</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
