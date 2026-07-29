// El negocio opera en Argentina (UTC-3 fijo, sin horario de verano).
// Todo se guarda en UTC (timestamptz) y se muestra/interpreta en hora argentina.

import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const AR_TIME_ZONE = "America/Argentina/Buenos_Aires";
const AR_UTC_OFFSET = "-03:00";

const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: AR_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: AR_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: AR_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTimeAr(iso: string | null | undefined) {
  if (!iso) {
    return "-";
  }

  return dateTimeFormatter.format(new Date(iso));
}

export function formatDateAr(iso: string | null | undefined) {
  if (!iso) {
    return "-";
  }

  return dateFormatter.format(new Date(iso));
}

export function formatTimeAr(iso: string) {
  return timeFormatter.format(new Date(iso));
}

/** Convierte el valor de un input datetime-local (hora argentina) a ISO UTC. */
export function argDateTimeLocalToIso(value: string) {
  return new Date(`${value}:00${AR_UTC_OFFSET}`).toISOString();
}

/** Fecha calendario argentina actual como YYYY-MM-DD. */
export function currentArgDateString(reference: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: AR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(reference);

  return parts;
}

/** Limites del dia calendario argentino actual, en ISO UTC. */
export function argTodayRange(reference: Date = new Date()) {
  const day = currentArgDateString(reference);
  const start = new Date(`${day}T00:00:00${AR_UTC_OFFSET}`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

const longDateFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: AR_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Fecha larga para encabezados, ej: "29 jul 2026". */
export function formatLongDateAr(reference: Date = new Date()) {
  return longDateFormatter.format(reference).replace(/\./g, "");
}

/** Tiempo relativo en espanol, ej: "hace 2 horas". */
export function formatRelativeAr(iso: string | null | undefined) {
  if (!iso) {
    return "-";
  }

  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: es });
}

/** Saludo segun la hora argentina. */
export function argGreeting(reference: Date = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: AR_TIME_ZONE,
      hour: "numeric",
      hour12: false,
    }).format(reference),
  );

  if (hour >= 5 && hour < 13) {
    return "Buenos dias";
  }

  if (hour >= 13 && hour < 20) {
    return "Buenas tardes";
  }

  return "Buenas noches";
}

const DAY_MS = 24 * 60 * 60 * 1000;

export type ArgWeekDay = {
  /** YYYY-MM-DD en calendario argentino */
  dateStr: string;
  /** ej: "LUN" */
  weekdayLabel: string;
  /** ej: 27 */
  dayNumber: number;
  startIso: string;
  endIso: string;
  isToday: boolean;
};

const weekdayFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: AR_TIME_ZONE,
  weekday: "short",
});

const monthYearFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: AR_TIME_ZONE,
  month: "long",
  year: "numeric",
});

/** Dias lunes a sabado de la semana argentina actual + offset en semanas. */
export function argWeekDays(weekOffset = 0, reference: Date = new Date()): ArgWeekDay[] {
  const todayStr = currentArgDateString(reference);
  const todayStart = new Date(`${todayStr}T00:00:00${AR_UTC_OFFSET}`);
  // getUTCDay sobre el mediodia UTC de la fecha calendario evita corrimientos de zona
  const dayOfWeek = new Date(`${todayStr}T12:00:00Z`).getUTCDay();
  const mondayStart = new Date(
    todayStart.getTime() - ((dayOfWeek + 6) % 7) * DAY_MS + weekOffset * 7 * DAY_MS,
  );

  return Array.from({ length: 6 }, (_, index) => {
    const start = new Date(mondayStart.getTime() + index * DAY_MS);
    const end = new Date(start.getTime() + DAY_MS);
    const dateStr = currentArgDateString(start);

    return {
      dateStr,
      weekdayLabel: weekdayFormatter.format(start).replace(/\./g, "").toUpperCase(),
      dayNumber: Number(dateStr.slice(8, 10)),
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      isToday: dateStr === todayStr,
    };
  });
}

/** Titulo de la semana, ej: "julio de 2026". */
export function argMonthYearLabel(iso: string) {
  return monthYearFormatter.format(new Date(iso));
}

/** Fecha calendario argentina (YYYY-MM-DD) de un instante ISO. */
export function argDateStringOf(iso: string) {
  return currentArgDateString(new Date(iso));
}

/** ISO UTC de hace N dias, para umbrales tipo "sin contacto reciente". */
export function isoDaysAgo(days: number, reference: Date = new Date()) {
  return new Date(reference.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** Valor por defecto para inputs datetime-local: manana a las 10:00 hora argentina. */
export function defaultFollowUpLocalValue(reference: Date = new Date()) {
  const day = currentArgDateString(new Date(reference.getTime() + 24 * 60 * 60 * 1000));
  return `${day}T10:00`;
}
