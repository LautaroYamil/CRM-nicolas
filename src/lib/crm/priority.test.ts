import { describe, expect, it } from "vitest";
import { computePriority } from "@/lib/crm/priority";

describe("computePriority", () => {
  it("alta: vencido y en un estado de oportunidad activa", () => {
    expect(computePriority(true, "interesado")).toBe("alta");
    expect(computePriority(true, "en_seguimiento")).toBe("alta");
  });

  it("media: vencido en cualquier otro estado", () => {
    expect(computePriority(true, "nuevo")).toBe("media");
    expect(computePriority(true, "inactivo")).toBe("media");
    expect(computePriority(true, "compro")).toBe("media");
    expect(computePriority(true, "no_interesado")).toBe("media");
  });

  it("baja: no vencido, sin importar el estado", () => {
    expect(computePriority(false, "interesado")).toBe("baja");
    expect(computePriority(false, "nuevo")).toBe("baja");
  });
});
