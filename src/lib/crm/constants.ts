export const CLIENT_STATUS_OPTIONS = [
  { value: "nuevo", label: "Nuevo" },
  { value: "interesado", label: "Interesado" },
  { value: "en_seguimiento", label: "En seguimiento" },
  { value: "compro", label: "Compro" },
  { value: "no_interesado", label: "No interesado" },
  { value: "inactivo", label: "Inactivo" },
] as const;

export type ClientStatus = (typeof CLIENT_STATUS_OPTIONS)[number]["value"];

export const ACTIVITY_TYPE_OPTIONS = [
  { value: "llamada", label: "Llamada" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "visita", label: "Visita al local" },
  { value: "reunion", label: "Reunion" },
  { value: "nota", label: "Nota" },
] as const;

export type ActivityType = (typeof ACTIVITY_TYPE_OPTIONS)[number]["value"];

export const ACTIVITY_STATUS_LABELS = {
  pendiente: "Pendiente",
  realizada: "Realizada",
  cancelada: "Cancelada",
} as const;

export type ActivityStatus = keyof typeof ACTIVITY_STATUS_LABELS;

export const CONTACT_OUTCOME_OPTIONS = [
  { value: "respondio_sigue_interesado", label: "Respondio - sigue interesado" },
  { value: "respondio_quiere_pensarlo", label: "Respondio - quiere pensarlo" },
  { value: "pidio_contacto_despues", label: "Pidio que lo contacten despues" },
  { value: "no_respondio", label: "No respondio" },
  { value: "no_interesado", label: "No interesado" },
  { value: "venta_concretada", label: "Venta concretada" },
] as const;

export type ContactOutcome = (typeof CONTACT_OUTCOME_OPTIONS)[number]["value"];

export function contactOutcomeLabel(value: string | null | undefined) {
  return CONTACT_OUTCOME_OPTIONS.find((option) => option.value === value)?.label ?? null;
}

export function activityTypeLabel(type: string) {
  return ACTIVITY_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

export function clientStatusLabel(status: string) {
  return CLIENT_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

const ACTIVITY_TYPE_ICONS: Record<string, string> = {
  llamada: "call",
  whatsapp: "chat",
  email: "mail",
  visita: "storefront",
  reunion: "groups",
  nota: "sticky_note_2",
};

export function activityTypeIcon(type: string) {
  return ACTIVITY_TYPE_ICONS[type] ?? "event";
}

const CLIENT_STATUS_CHIP_CLASSES: Record<string, string> = {
  nuevo: "border-outline-variant/40 bg-surface-container text-on-surface",
  interesado: "border-yellow-600/20 bg-yellow-50 text-yellow-800",
  en_seguimiento: "border-orange-600/20 bg-orange-50 text-orange-700",
  compro: "border-green-600/20 bg-green-50 text-green-700",
  no_interesado: "border-error/20 bg-error-container/20 text-error",
  inactivo: "border-outline-variant/40 bg-surface-container-high text-on-surface-variant",
};

const DEFAULT_STATUS_CHIP_CLASSES = "border-outline-variant/40 bg-surface-container text-on-surface-variant";

export function clientStatusChipClasses(status: string) {
  return CLIENT_STATUS_CHIP_CLASSES[status] ?? DEFAULT_STATUS_CHIP_CLASSES;
}
