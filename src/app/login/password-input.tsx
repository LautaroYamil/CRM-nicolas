"use client";

import { useState } from "react";

export function PasswordInput() {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
        <span className="material-symbols-outlined text-on-surface-variant/70">lock</span>
      </div>
      <input
        id="password"
        name="password"
        type={visible ? "text" : "password"}
        required
        autoComplete="current-password"
        placeholder="Tu contrasena"
        className="w-full rounded-lg border border-outline-variant bg-surface py-4 pr-12 pl-12 text-body-md transition-all focus:border-primary focus:ring-0 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        title={visible ? "Ocultar contrasena" : "Mostrar contrasena"}
        className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-4 text-on-surface-variant/70 transition-colors hover:text-primary"
      >
        <span className="material-symbols-outlined">{visible ? "visibility_off" : "visibility"}</span>
      </button>
    </div>
  );
}
