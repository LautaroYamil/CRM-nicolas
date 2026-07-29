// Plantillas de mensaje para WhatsApp. El sistema NUNCA envia nada solo:
// el link wa.me abre el chat con el texto precargado y el vendedor decide si lo manda o lo edita.

export function waLink(phoneNormalized: string, text?: string) {
  const digits = phoneNormalized.replace(/\D+/g, "");

  if (!digits) {
    return "https://wa.me/";
  }

  return text ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : `https://wa.me/${digits}`;
}

type TemplateContext = {
  clientFirstName: string;
  sellerName: string;
  /** Primer interes cargado del cliente, si tiene */
  interest?: string;
};

export type MessageTemplate = {
  id: string;
  label: string;
  description: string;
  text: string;
};

export function buildMessageTemplates({ clientFirstName, sellerName, interest }: TemplateContext): MessageTemplate[] {
  const producto = interest ? interest.toLowerCase() : "lo que estabas buscando";

  return [
    {
      id: "primer-contacto",
      label: "Primer contacto",
      description: "Para presentarte despues de que visito el local",
      text: `Hola ${clientFirstName}! Soy ${sellerName}, de Muebleria El Gallego. Un gusto haberte atendido. Cualquier consulta sobre ${producto}, escribime por aca y te ayudo.`,
    },
    {
      id: "seguimiento",
      label: "Seguimiento",
      description: "Para retomar una consulta que quedo abierta",
      text: `Hola ${clientFirstName}! Te escribo de Muebleria El Gallego. Pudiste pensar lo de ${producto}? Si queres te paso mas opciones o precios, sin compromiso.`,
    },
    {
      id: "posventa",
      label: "Posventa",
      description: "Para clientes que ya compraron",
      text: `Hola ${clientFirstName}! Como llego todo? Espero que lo estes disfrutando. Ante cualquier detalle escribime y lo resolvemos. Gracias por elegirnos!`,
    },
    {
      id: "novedades",
      label: "Novedades",
      description: "Para reactivar un cliente frio con una promo o ingreso",
      text: `Hola ${clientFirstName}! Te escribo de Muebleria El Gallego. Nos entraron novedades en ${producto} que te pueden interesar. Queres que te pase fotos y precios?`,
    },
  ];
}
