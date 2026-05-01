export type TaskStatus = "todo" | "in_progress" | "in_review" | "done" | "blocked";
export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  assigneeAvatar: string;
  estimatedCost: number;
  actualCost: number;
  estimatedHours: number;
  loggedHours: number;
  dueDate: string;
  projectId: string;
  tags: string[];
}

export interface Project {
  id: string;
  name: string;
  code: string;
  budget: number;
  spent: number;
  progress: number;
  startDate: string;
  endDate: string;
  tasksTotal: number;
  tasksCompleted: number;
  burnRate: number;
  status: "on_track" | "at_risk" | "over_budget";
}

export interface Resource {
  id: string;
  name: string;
  role: string;
  avatar: string;
  utilization: number;
  hourlyRate: number;
  assignedProjects: string[];
}

export interface PersonnelResource {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  salary: number;
  projectRole: string;
  utilization: number;
  assignedProjects: string[];
  status: "active" | "on_leave" | "inactive";
}

export interface TechResource {
  id: string;
  name: string;
  type: string;
  technology: string;
  provider: string;
  status: "active" | "inactive" | "maintenance";
  projectId: string;
  responsible: string;
  implementationDate: string;
  utilization: number;
}

export interface MachineryResource {
  id: string;
  name: string;
  category: string;
  area: string;
  operationalStatus: "active" | "maintenance" | "available" | "inactive";
  location: string;
  responsible: string;
  capacity: number;
  projectId: string;
  utilization: number;
}

const avatarInitials = (name: string) => name.split(" ").map(n => n[0]).join("");

export const projects: Project[] = [
  {
    id: "proj-001",
    name: "Project Alpha",
    code: "ALPHA",
    budget: 150000,
    spent: 98500,
    progress: 62,
    startDate: "2026-01-15",
    endDate: "2026-06-30",
    tasksTotal: 48,
    tasksCompleted: 30,
    burnRate: 1240,
    status: "at_risk",
  },
  {
    id: "proj-002",
    name: "Project Beta",
    code: "BETA",
    budget: 85000,
    spent: 42000,
    progress: 45,
    startDate: "2026-02-01",
    endDate: "2026-08-15",
    tasksTotal: 32,
    tasksCompleted: 14,
    burnRate: 680,
    status: "on_track",
  },
  {
    id: "proj-003",
    name: "Project Gamma",
    code: "GAMMA",
    budget: 200000,
    spent: 215000,
    progress: 78,
    startDate: "2025-10-01",
    endDate: "2026-04-30",
    tasksTotal: 64,
    tasksCompleted: 50,
    burnRate: 2100,
    status: "over_budget",
  },
];

export const resources: Resource[] = [
  { id: "res-001", name: "Ana García", role: "Senior Developer", avatar: "", utilization: 92, hourlyRate: 85, assignedProjects: ["proj-001", "proj-003"] },
  { id: "res-002", name: "Carlos López", role: "Backend Developer", avatar: "", utilization: 78, hourlyRate: 75, assignedProjects: ["proj-001"] },
  { id: "res-003", name: "María Torres", role: "UX Designer", avatar: "", utilization: 65, hourlyRate: 70, assignedProjects: ["proj-002"] },
  { id: "res-004", name: "Luis Ramírez", role: "Project Manager", avatar: "", utilization: 88, hourlyRate: 95, assignedProjects: ["proj-001", "proj-002", "proj-003"] },
  { id: "res-005", name: "Elena Martín", role: "QA Engineer", avatar: "", utilization: 45, hourlyRate: 65, assignedProjects: ["proj-002"] },
  { id: "res-006", name: "Diego Fernández", role: "DevOps Engineer", avatar: "", utilization: 95, hourlyRate: 90, assignedProjects: ["proj-001", "proj-003"] },
];

export const personnelResources: PersonnelResource[] = [
  { id: "per-001", firstName: "Ana", lastName: "García", position: "Ingeniera de Software", salary: 4500, projectRole: "Desarrolladora Backend", utilization: 92, assignedProjects: ["proj-001", "proj-003"], status: "active" },
  { id: "per-002", firstName: "Carlos", lastName: "López", position: "Ingeniero de Datos", salary: 4200, projectRole: "Desarrollador Backend", utilization: 78, assignedProjects: ["proj-001"], status: "active" },
  { id: "per-003", firstName: "María", lastName: "Torres", position: "Diseñadora UX/UI", salary: 3800, projectRole: "Diseñadora UX", utilization: 65, assignedProjects: ["proj-002"], status: "active" },
  { id: "per-004", firstName: "Luis", lastName: "Ramírez", position: "Gerente de Proyectos", salary: 5500, projectRole: "Gerente de Proyecto", utilization: 88, assignedProjects: ["proj-001", "proj-002", "proj-003"], status: "active" },
  { id: "per-005", firstName: "Elena", lastName: "Martín", position: "Ingeniera QA", salary: 3500, projectRole: "Analista QA", utilization: 45, assignedProjects: ["proj-002"], status: "active" },
  { id: "per-006", firstName: "Diego", lastName: "Fernández", position: "Ingeniero DevOps", salary: 4800, projectRole: "Ingeniero DevOps", utilization: 95, assignedProjects: ["proj-001", "proj-003"], status: "active" },
  { id: "per-007", firstName: "Roberto", lastName: "Sánchez", position: "Operador de Maquinaria", salary: 2800, projectRole: "Operador CNC", utilization: 70, assignedProjects: ["proj-003"], status: "active" },
  { id: "per-008", firstName: "Patricia", lastName: "Vega", position: "Técnica de Mantenimiento", salary: 3000, projectRole: "Técnica de Mantenimiento", utilization: 55, assignedProjects: ["proj-003"], status: "on_leave" },
];

export const techResources: TechResource[] = [
  { id: "tech-001", name: "Base de Datos Principal", type: "Base de datos relacional", technology: "PostgreSQL", provider: "AWS RDS", status: "active", projectId: "proj-001", responsible: "Carlos López", implementationDate: "2026-01-20", utilization: 85 },
  { id: "tech-002", name: "Servidor de Aplicaciones", type: "Máquina virtual", technology: "EC2 Instance", provider: "AWS", status: "active", projectId: "proj-001", responsible: "Diego Fernández", implementationDate: "2026-01-15", utilization: 72 },
  { id: "tech-003", name: "Motor de IA Predictiva", type: "Inteligencia artificial", technology: "TensorFlow", provider: "Google Cloud", status: "active", projectId: "proj-002", responsible: "Ana García", implementationDate: "2026-02-10", utilization: 60 },
  { id: "tech-004", name: "Pipeline CI/CD", type: "Herramienta de desarrollo", technology: "GitHub Actions", provider: "GitHub", status: "active", projectId: "proj-001", responsible: "Diego Fernández", implementationDate: "2026-01-18", utilization: 90 },
  { id: "tech-005", name: "API Gateway", type: "API externa", technology: "Kong Gateway", provider: "Kong Inc.", status: "active", projectId: "proj-001", responsible: "Carlos López", implementationDate: "2026-02-05", utilization: 68 },
  { id: "tech-006", name: "Plataforma de Monitoreo", type: "Servicio cloud", technology: "Datadog", provider: "Datadog Inc.", status: "maintenance", projectId: "proj-003", responsible: "Diego Fernández", implementationDate: "2025-11-01", utilization: 40 },
  { id: "tech-007", name: "Cluster Kubernetes", type: "Máquina virtual", technology: "EKS", provider: "AWS", status: "active", projectId: "proj-003", responsible: "Diego Fernández", implementationDate: "2025-10-15", utilization: 82 },
  { id: "tech-008", name: "Sistema de Automatización", type: "Plataforma de automatización", technology: "Apache Airflow", provider: "On-premise", status: "inactive", projectId: "proj-002", responsible: "Carlos López", implementationDate: "2026-03-01", utilization: 0 },
];

export const machineryResources: MachineryResource[] = [
  { id: "maq-001", name: "Máquina CNC XR-500", category: "Maquinaria de producción", area: "Producción", operationalStatus: "active", location: "Planta A - Sector 3", responsible: "Roberto Sánchez", capacity: 92, projectId: "proj-003", utilization: 88 },
  { id: "maq-002", name: "Robot de Ensamblaje XR-21", category: "Robot industrial", area: "Producción", operationalStatus: "active", location: "Planta A - Línea 2", responsible: "Roberto Sánchez", capacity: 100, projectId: "proj-003", utilization: 75 },
  { id: "maq-003", name: "Sistema de Transporte Automatizado", category: "Sistema de transporte logístico", area: "Logística", operationalStatus: "available", location: "Planta A - Almacén", responsible: "Patricia Vega", capacity: 80, projectId: "proj-003", utilization: 30 },
  { id: "maq-004", name: "Cortadora Láser Industrial", category: "Maquinaria de corte industrial", area: "Producción", operationalStatus: "maintenance", location: "Planta B - Sector 1", responsible: "Patricia Vega", capacity: 95, projectId: "proj-003", utilization: 0 },
  { id: "maq-005", name: "Prensa Hidráulica PH-200", category: "Maquinaria pesada", area: "Producción", operationalStatus: "active", location: "Planta B - Sector 2", responsible: "Roberto Sánchez", capacity: 85, projectId: "proj-003", utilization: 65 },
  { id: "maq-006", name: "Sistema de Control de Calidad Óptico", category: "Maquinaria de control de calidad", area: "Control de Calidad", operationalStatus: "active", location: "Planta A - Laboratorio", responsible: "Elena Martín", capacity: 70, projectId: "proj-003", utilization: 55 },
];

export const projectRoles = [
  "Desarrollador", "Analista de Sistemas", "Ingeniero de Datos", "Diseñador UX/UI",
  "Gerente de Proyecto", "Analista Financiero", "Ingeniero Industrial",
  "Operador de Maquinaria", "Técnico de Mantenimiento",
];

export const techTypes = [
  "Base de datos relacional", "Base de datos NoSQL", "Inteligencia artificial",
  "Máquina virtual", "Servidor", "Servicio cloud", "Herramienta de desarrollo",
  "API externa", "Plataforma de automatización", "Computadora personal",
];

export const machineryCategories = [
  "Maquinaria de producción", "Maquinaria de ensamblaje", "Maquinaria de corte industrial",
  "Sistema automatizado", "Robot industrial", "Sistema de transporte logístico",
  "Maquinaria de almacenamiento", "Maquinaria de control de calidad", "Maquinaria pesada",
];

export const tasks: Task[] = [
  { id: "ALPHA-001", title: "Setup CI/CD Pipeline", description: "Configure automated build and deploy", status: "done", priority: "high", assignee: "Diego Fernández", assigneeAvatar: "", estimatedCost: 2400, actualCost: 2800, estimatedHours: 32, loggedHours: 35, dueDate: "2026-02-15", projectId: "proj-001", tags: ["devops", "infrastructure"] },
  { id: "ALPHA-002", title: "Design Database Schema", description: "Create ERD and implement migrations", status: "done", priority: "high", assignee: "Carlos López", assigneeAvatar: "", estimatedCost: 1800, actualCost: 1600, estimatedHours: 24, loggedHours: 21, dueDate: "2026-02-20", projectId: "proj-001", tags: ["backend", "database"] },
  { id: "ALPHA-003", title: "Implement Auth Module", description: "JWT-based authentication with role management", status: "in_progress", priority: "critical", assignee: "Ana García", assigneeAvatar: "", estimatedCost: 3200, actualCost: 3800, estimatedHours: 40, loggedHours: 44, dueDate: "2026-03-10", projectId: "proj-001", tags: ["backend", "security"] },
  { id: "ALPHA-004", title: "Dashboard UI Components", description: "Build reusable chart and card components", status: "in_progress", priority: "medium", assignee: "Ana García", assigneeAvatar: "", estimatedCost: 2100, actualCost: 1200, estimatedHours: 28, loggedHours: 16, dueDate: "2026-03-20", projectId: "proj-001", tags: ["frontend", "ui"] },
  { id: "ALPHA-005", title: "API Rate Limiting", description: "Implement rate limiting middleware", status: "todo", priority: "medium", assignee: "Carlos López", assigneeAvatar: "", estimatedCost: 900, actualCost: 0, estimatedHours: 12, loggedHours: 0, dueDate: "2026-03-25", projectId: "proj-001", tags: ["backend", "security"] },
  { id: "ALPHA-006", title: "User Notifications System", description: "Real-time notification service", status: "todo", priority: "low", assignee: "Carlos López", assigneeAvatar: "", estimatedCost: 1500, actualCost: 0, estimatedHours: 20, loggedHours: 0, dueDate: "2026-04-05", projectId: "proj-001", tags: ["backend", "feature"] },
  { id: "ALPHA-007", title: "Performance Load Testing", description: "Load test all critical endpoints", status: "blocked", priority: "high", assignee: "Elena Martín", assigneeAvatar: "", estimatedCost: 1200, actualCost: 0, estimatedHours: 16, loggedHours: 0, dueDate: "2026-04-10", projectId: "proj-001", tags: ["qa", "testing"] },
  { id: "ALPHA-008", title: "Resource Allocation View", description: "Drag-and-drop resource assignment interface", status: "in_review", priority: "high", assignee: "Ana García", assigneeAvatar: "", estimatedCost: 2800, actualCost: 2600, estimatedHours: 36, loggedHours: 33, dueDate: "2026-03-15", projectId: "proj-001", tags: ["frontend", "feature"] },
  { id: "BETA-001", title: "Wireframe Prototyping", description: "Create interactive wireframes for client review", status: "done", priority: "high", assignee: "María Torres", assigneeAvatar: "", estimatedCost: 1400, actualCost: 1400, estimatedHours: 20, loggedHours: 20, dueDate: "2026-02-28", projectId: "proj-002", tags: ["design", "ux"] },
  { id: "BETA-002", title: "Component Library Setup", description: "Initialize shared component library", status: "in_progress", priority: "medium", assignee: "María Torres", assigneeAvatar: "", estimatedCost: 1050, actualCost: 700, estimatedHours: 15, loggedHours: 10, dueDate: "2026-03-15", projectId: "proj-002", tags: ["design", "frontend"] },
  { id: "GAMMA-001", title: "Data Migration Script", description: "Migrate legacy data to new schema", status: "in_review", priority: "critical", assignee: "Diego Fernández", assigneeAvatar: "", estimatedCost: 4500, actualCost: 5200, estimatedHours: 50, loggedHours: 58, dueDate: "2026-03-01", projectId: "proj-003", tags: ["backend", "migration"] },
  { id: "GAMMA-002", title: "Report Generation Engine", description: "Automated PDF/Excel report builder", status: "in_progress", priority: "high", assignee: "Ana García", assigneeAvatar: "", estimatedCost: 3600, actualCost: 2800, estimatedHours: 40, loggedHours: 32, dueDate: "2026-03-20", projectId: "proj-003", tags: ["backend", "reporting"] },
];

export const costFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export const costFormatterDetailed = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

export const statusLabels: Record<TaskStatus, string> = {
  todo: "Pendiente",
  in_progress: "En Proceso",
  in_review: "En Revisión",
  done: "Finalizada",
  blocked: "Bloqueada",
};

export const priorityLabels: Record<TaskPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
};
