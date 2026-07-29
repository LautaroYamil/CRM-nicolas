import { z } from "zod";
import { ACTIVITY_TYPE_OPTIONS, CLIENT_STATUS_OPTIONS } from "@/lib/crm/constants";

const statusValues = CLIENT_STATUS_OPTIONS.map((item) => item.value) as [
  (typeof CLIENT_STATUS_OPTIONS)[number]["value"],
  ...(typeof CLIENT_STATUS_OPTIONS)[number]["value"][],
];

export const clientFormSchema = z.object({
  firstName: z.string().trim().min(1, "El nombre es obligatorio"),
  lastName: z.string().trim().optional(),
  phone: z.string().trim().min(1, "El telefono es obligatorio"),
  locality: z.string().trim().optional(),
  address: z.string().trim().optional(),
  status: z.enum(statusValues),
  assignedUserId: z.string().uuid("Vendedor invalido"),
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

export const logContactSchema = z.object({
  type: z.enum(activityTypeValues),
  outcome: z.string().trim().min(1, "Contanos el resultado del contacto"),
  nextScheduledAt: dateTimeLocalValue.optional().or(z.literal("")),
  nextObjective: z.string().trim().optional(),
});

export const scheduleFollowUpSchema = z.object({
  type: z.enum(activityTypeValues),
  scheduledAt: dateTimeLocalValue,
  objective: z.string().trim().optional(),
});

export const completeActivitySchema = z.object({
  outcome: z.string().trim().min(1, "Contanos el resultado del contacto"),
  nextScheduledAt: dateTimeLocalValue.optional().or(z.literal("")),
});

export const rescheduleActivitySchema = z.object({
  scheduledAt: dateTimeLocalValue,
});
