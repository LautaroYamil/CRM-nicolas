import { z } from "zod";
import { ACTIVITY_TYPE_OPTIONS, CLIENT_STATUS_OPTIONS, CONTACT_OUTCOME_OPTIONS } from "@/lib/crm/constants";

const statusValues = CLIENT_STATUS_OPTIONS.map((item) => item.value) as [
  (typeof CLIENT_STATUS_OPTIONS)[number]["value"],
  ...(typeof CLIENT_STATUS_OPTIONS)[number]["value"][],
];

const plainDateValue = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha invalida");

const dniValue = z
  .string()
  .trim()
  .transform((value) => value.replace(/\D+/g, ""))
  .refine((value) => value === "" || (value.length >= 6 && value.length <= 9), {
    message: "El DNI debe tener entre 6 y 9 numeros",
  });

export const clientFormSchema = z.object({
  firstName: z.string().trim().min(1, "El nombre es obligatorio"),
  lastName: z.string().trim().optional(),
  phone: z.string().trim().min(1, "El telefono es obligatorio"),
  dni: dniValue,
  birthDate: plainDateValue.optional().or(z.literal("")),
  locality: z.string().trim().optional(),
  address: z.string().trim().optional(),
  status: z.enum(statusValues),
  assignedUserId: z.string().uuid("Vendedor invalido"),
  lossReasonId: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  interestIds: z.array(z.string().uuid()).default([]),
});

export type ClientFormInput = z.infer<typeof clientFormSchema>;

const activityTypeValues = ACTIVITY_TYPE_OPTIONS.map((item) => item.value) as [
  (typeof ACTIVITY_TYPE_OPTIONS)[number]["value"],
  ...(typeof ACTIVITY_TYPE_OPTIONS)[number]["value"][],
];

const dateTimeLocalValue = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Fecha y hora invalidas");

const contactOutcomeValues = CONTACT_OUTCOME_OPTIONS.map((item) => item.value) as [
  (typeof CONTACT_OUTCOME_OPTIONS)[number]["value"],
  ...(typeof CONTACT_OUTCOME_OPTIONS)[number]["value"][],
];

/** Resultado estructurado: opcional, no se obliga a elegir uno todavia. */
const outcomeTypeValue = z.enum(contactOutcomeValues).optional().or(z.literal(""));

/** "otro" o el id de una fila de contact_objectives; el texto libre acompana como respaldo. */
const objectiveChoiceValue = z.string().trim().optional();

export const logContactSchema = z.object({
  type: z.enum(activityTypeValues),
  outcome: z.string().trim().min(1, "Contanos el resultado del contacto"),
  outcomeType: outcomeTypeValue,
  nextScheduledAt: dateTimeLocalValue.optional().or(z.literal("")),
  nextObjectiveChoice: objectiveChoiceValue,
  nextObjective: z.string().trim().optional(),
});

export const scheduleFollowUpSchema = z.object({
  type: z.enum(activityTypeValues),
  scheduledAt: dateTimeLocalValue,
  objectiveChoice: objectiveChoiceValue,
  objective: z.string().trim().optional(),
});

export const completeActivitySchema = z.object({
  outcome: z.string().trim().min(1, "Contanos el resultado del contacto"),
  outcomeType: outcomeTypeValue,
  nextScheduledAt: dateTimeLocalValue.optional().or(z.literal("")),
});

export const rescheduleActivitySchema = z.object({
  scheduledAt: dateTimeLocalValue,
});

export const registerPurchaseSchema = z.object({
  description: z.string().trim().optional(),
  interestId: z.string().trim().optional(),
});

export const checkinSearchSchema = z.object({
  event: z.string().trim().min(1, "Falta el nombre del evento"),
  query: z.string().trim().min(1, "Escribi un telefono o nombre para buscar"),
});

const eventInterestLevelValue = z.enum(["paso", "interesado"], {
  message: "Indica si solo paso o si mostro interes real de compra",
});

export const checkinEventDataSchema = z.object({
  locality: z.string().trim().optional(),
  interestLevel: eventInterestLevelValue,
  interestIds: z.array(z.string().uuid()).default([]),
});

// Minimo de digitos reales, no solo "no vacio": un telefono sin numeros
// (typo, campo mal tocado) normaliza a texto vacio y haria que el chequeo de
// duplicados de checkinNewAction junte por error a dos personas distintas
// que hayan cometido el mismo error.
const checkinPhoneValue = z
  .string()
  .trim()
  .min(1, "El telefono es obligatorio")
  .refine((value) => value.replace(/\D+/g, "").length >= 6, {
    message: "El telefono tiene que tener al menos 6 numeros",
  });

export const checkinNewClientSchema = z.object({
  event: z.string().trim().min(1, "Falta el nombre del evento"),
  firstName: z.string().trim().min(1, "El nombre es obligatorio"),
  phone: checkinPhoneValue,
}).merge(checkinEventDataSchema);

export const inviteSellerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email invalido"),
  fullName: z.string().trim().min(1, "El nombre es obligatorio"),
});
