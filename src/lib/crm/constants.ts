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

export function activityTypeLabel(type: string) {
  return ACTIVITY_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

export function clientStatusLabel(status: string) {
  return CLIENT_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}
