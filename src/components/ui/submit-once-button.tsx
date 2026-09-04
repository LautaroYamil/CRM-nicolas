"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

type SubmitOnceButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel?: string;
};

/**
 * Boton de submit que se deshabilita mientras la accion esta en curso -evita
 * que un doble-tap en tablet (ej. cargando gente rapido en un evento) dispare
 * la misma carga dos veces. Tiene que estar DENTRO del <form>, no ser el form.
 */
export function SubmitOnceButton({ children, pendingLabel, disabled, ...props }: SubmitOnceButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" {...props} disabled={pending || disabled} aria-busy={pending}>
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
