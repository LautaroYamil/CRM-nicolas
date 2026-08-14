// Priorizacion por reglas transparentes, no un modelo/score oculto. Se
// calcula al leer (nunca se guarda), igual que "vencido" -asi nunca queda
// desactualizada y no hace falta un job que la recalcule.
//
// Alta: vencido y el cliente esta en un estado donde la oportunidad sigue
//   activa (interesado / en seguimiento) -es la que se esta enfriando.
// Media: vencido en cualquier otro estado.
// Baja: no vencido (todavia a tiempo).

export type Priority = "alta" | "media" | "baja";

export const PRIORITY_LABELS: Record<Priority, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

const HOT_STATUSES = new Set(["interesado", "en_seguimiento"]);

export function computePriority(overdue: boolean, clientStatus: string): Priority {
  if (!overdue) {
    return "baja";
  }

  return HOT_STATUSES.has(clientStatus) ? "alta" : "media";
}
