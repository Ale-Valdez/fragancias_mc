"use client";

import { authUserSchema, loginInputSchema } from "@fmc/shared";
import { useState, type FormEvent } from "react";
import { ThemeSwitch } from "@/components/theme-switch";

type FieldErrors = {
  email?: string;
  password?: string;
};

const inputClassName =
  "rounded-md border border-rule bg-elevated px-3 py-2 text-base text-ink outline-none focus:border-gold disabled:opacity-60";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setFormError(null);
    const parsed = loginInputSchema.safeParse({ email, password });
    if (!parsed.success) {
      const fields = new Set(parsed.error.issues.map((issue) => String(issue.path[0])));
      setFieldErrors({
        email: fields.has("email") ? "Ingresá un email válido." : undefined,
        password: fields.has("password")
          ? password.length > 200
            ? "La contraseña puede tener hasta 200 caracteres."
            : "Ingresá la contraseña."
          : undefined,
      });
      return;
    }

    setFieldErrors({});
    setPending(true);
    let signedIn = false;
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(parsed.data),
      });

      if (response.status === 401) {
        setFormError("Email o contraseña incorrectos.");
        return;
      }
      if (response.status === 429) {
        setFormError("Demasiados intentos. Esperá unos minutos y volvé a probar.");
        return;
      }
      if (!response.ok) {
        setFormError("No se pudo iniciar sesión.");
        return;
      }

      const me = await fetch("/api/auth/me", { credentials: "include" });
      const body: unknown = await me.json().catch(() => null);
      const session = authUserSchema.safeParse(body);
      if (!me.ok || !session.success) {
        setFormError("La sesión no quedó guardada. Volvé a intentar.");
        return;
      }

      signedIn = true;
      window.location.assign("/admin");
    } catch {
      setFormError("No se pudo conectar con el servidor.");
    } finally {
      if (!signedIn) setPending(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <ThemeSwitch />
      <h1 className="mt-6 text-2xl font-semibold">Ingresar</h1>
      <p className="mt-2 text-sm text-muted">Panel de administración.</p>
      <form method="post" onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          Email
          <input
            type="email"
            name="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={pending}
            aria-invalid={fieldErrors.email ? true : undefined}
            className={inputClassName}
          />
          {fieldErrors.email ? (
            <span className="text-danger">{fieldErrors.email}</span>
          ) : null}
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          Contraseña
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={pending}
            aria-invalid={fieldErrors.password ? true : undefined}
            className={inputClassName}
          />
          {fieldErrors.password ? (
            <span className="text-danger">{fieldErrors.password}</span>
          ) : null}
        </label>
        {formError ? (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-md bg-gold px-3 py-2 text-sm font-medium text-page hover:bg-gold-bright disabled:opacity-60"
        >
          {pending ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
