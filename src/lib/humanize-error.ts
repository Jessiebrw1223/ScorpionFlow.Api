/**
 * Convierte errores técnicos (Edge Functions, network, Stripe, Supabase)
 * en mensajes humanos accionables.
 *
 * Regla de oro: el usuario JAMÁS debe ver "Edge function returned non-2xx",
 * "FunctionsHttpError", stack traces ni IDs internos.
 */

const TECHNICAL_PATTERNS: Array<{ match: RegExp; friendly: string }> = [
  // Edge functions — específicos primero
  { match: /Function not found|404.*function/i,friendly: "El servicio aún no está disponible. Espera unos segundos y vuelve a intentarlo." },
  { match: /edge function.*non-?2xx/i,         friendly: "El servicio respondió con un error. Vuelve a intentarlo en unos segundos." },
  { match: /FunctionsHttpError/i,              friendly: "El servicio respondió con un error. Vuelve a intentarlo en unos segundos." },
  { match: /FunctionsRelayError/i,             friendly: "Hubo un problema de conexión con el servicio. Reintenta en un momento." },
  { match: /FunctionsFetchError/i,             friendly: "No pudimos contactar al servicio. Revisa tu conexión e intenta de nuevo." },
  { match: /Failed to (fetch|send) a request/i,friendly: "No pudimos contactar al servicio. Revisa tu conexión e intenta de nuevo." },
  { match: /Failed to fetch/i,                 friendly: "No pudimos contactar al servicio. Revisa tu conexión e intenta de nuevo." },
  { match: /Load failed/i,                     friendly: "No pudimos contactar al servicio. Revisa tu conexión e intenta de nuevo." },
  { match: /AbortError|signal is aborted/i,    friendly: "La operación se canceló. Intenta de nuevo." },
  { match: /Server configuration error/i,      friendly: "El servicio está en mantenimiento. Vuelve a intentarlo en unos minutos." },

  // Stripe
  { match: /STRIPE_SECRET_KEY no configurada/i,friendly: "Los pagos no están activos en tu cuenta. Contacta al soporte." },
  { match: /STRIPE_WEBHOOK_SECRET/i,           friendly: "La sincronización de pagos no está lista. Contacta al soporte." },
  { match: /portal.*no.*activado|No configuration provided|Portal de Stripe no configurado/i, friendly: "El portal de facturación no está activado. Contacta al soporte." },
  { match: /No such customer/i,                friendly: "No encontramos tu suscripción activa." },
  { match: /No such subscription/i,            friendly: "No encontramos una suscripción activa para gestionar." },
  { match: /Ya tienes una suscripción activa/i,friendly: "Ya tienes una suscripción activa. Cambia de plan en lugar de crear una nueva." },
  { match: /No tienes una suscripción activa/i,friendly: "Aún no tienes una suscripción activa. Suscríbete primero a un plan." },
  { match: /Ya estás en este plan y ciclo/i,   friendly: "Ya estás en este plan." },
  { match: /Suscripción en estado .*, no se puede cambiar/i, friendly: "Tu suscripción no permite cambios ahora. Revisa el portal de facturación." },
  { match: /no encontramos el producto activo/i, friendly: "No encontramos el producto activo en tu suscripción. Abre el portal y vuelve a intentarlo." },
  { match: /El período pagado expiró/i,        friendly: "El período pagado expiró. Crea una nueva suscripción." },
  { match: /Tu suscripción no está cancelada/i,friendly: "Tu suscripción no está marcada para cancelarse." },
  { match: /La suscripción ya está programada para cancelarse/i, friendly: "Tu suscripción ya está programada para cancelarse al final del período." },
  { match: /No tienes una suscripción que reactivar/i, friendly: "No encontramos una suscripción para reactivar." },
  { match: /resource_missing/i,                friendly: "No encontramos el recurso solicitado." },
  { match: /Plan inválido|Invalid plan/i,      friendly: "El plan seleccionado no es válido." },
  { match: /price.*not.*found|No such price/i, friendly: "Este plan no está disponible en este momento. Contacta al soporte." },
  { match: /card.*declined|payment.*failed/i,  friendly: "Tu tarjeta fue rechazada. Verifica los datos o usa otra tarjeta." },
  { match: /insufficient.?funds/i,             friendly: "Fondos insuficientes en la tarjeta. Usa otro método de pago." },
  { match: /No autenticado|Sesión inválida|Unauthorized/i, friendly: "Tu sesión expiró. Vuelve a iniciar sesión." },

  // Invitaciones / equipo
  { match: /already_member/i,                  friendly: "Este usuario ya forma parte de tu equipo." },
  { match: /already_invited/i,                 friendly: "Ya enviaste una invitación a este email." },
  { match: /limit_reached/i,                   friendly: "Has alcanzado el límite de tu plan." },
  { match: /email_mismatch/i,                  friendly: "Esta invitación es para otro correo. Inicia sesión con la cuenta correcta." },
  { match: /Invitación no encontrada/i,        friendly: "Esta invitación no existe o el enlace es inválido." },
  { match: /La invitación ha expirado/i,       friendly: "Esta invitación ha expirado. Pide una nueva." },
  { match: /Esta invitación ya no está disponible/i, friendly: "Esta invitación ya fue usada o cancelada." },
  { match: /No se pudo unir al equipo/i,       friendly: "No pudimos unirte al equipo. Intenta de nuevo en un momento." },

  // Correo de invitación / entregabilidad
  { match: /email_suppressed/i,                friendly: "Este correo fue marcado como no entregable (rebote o queja previa). Comparte el enlace manualmente con la persona invitada." },
  { match: /bounced|permanent bounce/i,        friendly: "El correo rebotó porque la dirección no existe o el dominio rechazó el mensaje. Verifica el email o comparte el enlace manualmente." },
  { match: /complained|spam complaint/i,       friendly: "Este destinatario marcó tus correos como spam. Comparte el enlace manualmente." },
  { match: /Template .* not found/i,           friendly: "La plantilla del correo no está disponible. Contacta al soporte." },
  { match: /No email domain record found/i,    friendly: "El servicio de correo está configurándose. Reintenta en unos minutos o comparte el enlace manualmente." },

  // Supabase / DB
  { match: /JWT expired|Auth session missing/i,friendly: "Tu sesión expiró. Vuelve a iniciar sesión." },
  { match: /permission denied/i,               friendly: "No tienes permisos para esta acción." },
  { match: /violates row-level security/i,     friendly: "No tienes permisos para esta acción." },
  { match: /duplicate key|already exists/i,    friendly: "Este registro ya existe." },
  { match: /violates not-null/i,               friendly: "Falta completar campos obligatorios." },
  { match: /violates foreign key/i,            friendly: "Este registro está vinculado a otros datos. Revisa antes de continuar." },
  { match: /violates check constraint/i,       friendly: "Algunos datos no son válidos. Revísalos e intenta de nuevo." },
  { match: /timeout|timed out/i,               friendly: "La operación tardó demasiado. Intenta de nuevo." },
  { match: /rate limit|too many requests/i,    friendly: "Demasiadas solicitudes. Espera un momento e intenta de nuevo." },

  // Realtime
  { match: /cannot add.*postgres_changes.*subscribe/i, friendly: "Hubo un problema sincronizando datos en tiempo real. Recarga la página." },
  { match: /channel error|subscribe.*callback/i, friendly: "Conexión en tiempo real interrumpida. Recarga la página." },

  // Errores típicos de tipos / runtime
  { match: /Cannot read propert.*of (undefined|null)/i, friendly: "No pudimos cargar esta información. Recarga la página." },
  { match: /(\w+) is not a function/i,         friendly: "Algunos datos están incompletos. Recarga e intenta de nuevo." },
  { match: /Unexpected token.*JSON|JSON\.parse/i, friendly: "Recibimos una respuesta inesperada del servidor. Reintenta en un momento." },

  // Network
  { match: /NetworkError|ERR_NETWORK|net::ERR/i, friendly: "Sin conexión. Revisa tu internet." },
  { match: /CORS|blocked by CORS/i,            friendly: "Error de conexión con el servicio. Recarga la página." },
];

export function humanizeError(err: unknown, fallback = "Algo salió mal. Intenta de nuevo."): string {
  if (!err) return fallback;
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : safeStringify(err);
  if (!raw) return fallback;

  for (const { match, friendly } of TECHNICAL_PATTERNS) {
    if (match.test(raw)) return friendly;
  }

  // Si el mensaje tiene pinta técnica (códigos, stacks), usa fallback
  const looksTechnical = /[{}\[\]<>]|0x[0-9a-f]+|at \w+\(|line \d+|stack:/i.test(raw);
  if (looksTechnical) return fallback;

  // Si es corto y legible, devuélvelo
  if (raw.length < 140) return raw;

  return fallback;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Humaniza el resultado de `supabase.functions.invoke(...)`.
 * Considera tanto el error de transporte como el body de respuesta
 * (que muchas edge functions usan para devolver `{ error, message }`).
 */
export function humanizeFunctionError(
  fnError: unknown,
  fnData?: unknown,
  fallback = "No pudimos completar esta acción. Intenta de nuevo en un momento.",
): string {
  // Algunas edge functions devuelven 4xx/5xx como error de transporte,
  // pero el detalle viene en fnData. Lo intentamos primero.
  const data = fnData as any;
  if (data && typeof data === "object") {
    if (typeof data.message === "string" && data.message.length > 0) {
      return humanizeError(data.message, fallback);
    }
    if (typeof data.error === "string" && data.error.length > 0) {
      return humanizeError(data.error, fallback);
    }
    if (typeof data.reason === "string" && data.reason.length > 0) {
      return humanizeError(data.reason, fallback);
    }
  }
  if (fnError) {
    return humanizeError(fnError, fallback);
  }
  return fallback;
}
