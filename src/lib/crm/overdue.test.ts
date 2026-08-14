import { describe, expect, it } from "vitest";
import { isOverdue } from "@/lib/crm/overdue";

describe("isOverdue", () => {
  const now = "2026-08-11T12:00:00.000Z";

  it("no vencido: pendiente en el futuro", () => {
    expect(isOverdue("2026-08-11T15:00:00.000Z", now)).toBe(false);
  });

  it("vencido: pendiente en el pasado", () => {
    expect(isOverdue("2026-08-10T09:00:00.000Z", now)).toBe(true);
  });

  it("vencido: unos segundos antes de ahora", () => {
    expect(isOverdue("2026-08-11T11:59:59.000Z", now)).toBe(true);
  });

  it("borde: exactamente ahora no cuenta como vencido (comparacion estricta <)", () => {
    expect(isOverdue(now, now)).toBe(false);
  });

  it("mismo criterio sin importar la hora del dia (medianoche argentina = 03:00 UTC)", () => {
    // scheduled_at guardado en UTC; isOverdue no debe reinterpretar zona horaria,
    // solo comparar los ISO tal cual llegan de la base (que ya estan en UTC).
    expect(isOverdue("2026-08-11T03:00:00.000Z", "2026-08-11T03:00:01.000Z")).toBe(true);
    expect(isOverdue("2026-08-11T03:00:01.000Z", "2026-08-11T03:00:00.000Z")).toBe(false);
  });
});
