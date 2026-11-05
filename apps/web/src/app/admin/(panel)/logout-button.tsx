"use client";

import { useState } from "react";

export function LogoutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        setError("No se pudo cerrar la sesión.");
        setPending(false);
        return;
      }
      window.location.assign("/admin/login");
    } catch {
      setError("No se pudo conectar con el servidor.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-md border border-rule px-3 py-1.5 text-sm text-ink hover:bg-page disabled:opacity-60"
      >
        {pending ? "Saliendo…" : "Cerrar sesión"}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
