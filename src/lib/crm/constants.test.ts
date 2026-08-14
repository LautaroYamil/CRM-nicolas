import { describe, expect, it } from "vitest";
import { contactOutcomeLabel } from "@/lib/crm/constants";

describe("contactOutcomeLabel", () => {
  it("devuelve la etiqueta en espanol para un valor valido", () => {
    expect(contactOutcomeLabel("venta_concretada")).toBe("Venta concretada");
    expect(contactOutcomeLabel("no_respondio")).toBe("No respondio");
  });

  it("devuelve null si no hay resultado clasificado (historial viejo o sin elegir)", () => {
    expect(contactOutcomeLabel(null)).toBeNull();
    expect(contactOutcomeLabel(undefined)).toBeNull();
    expect(contactOutcomeLabel("")).toBeNull();
  });

  it("devuelve null ante un valor desconocido en vez de reventar", () => {
    expect(contactOutcomeLabel("algo_que_no_existe")).toBeNull();
  });
});
