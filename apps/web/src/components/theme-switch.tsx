"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

const STORAGE_KEY = "fmc-theme";

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode can block storage; the choice still applies for this visit.
  }
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.8 4.8l1.6 1.6M17.6 17.6l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.8 19.2l1.6-1.6M17.6 6.4l1.6-1.6" />
    </svg>
  );
}

export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(currentTheme());
  }, []);

  function choose(next: Theme) {
    applyTheme(next);
    setTheme(next);
  }

  const buttonClass = (pressed: boolean) =>
    `inline-flex h-9 w-9 items-center justify-center ${pressed ? "bg-gold text-page" : "text-reason hover:text-ink"}`;

  return (
    <div role="group" aria-label="Tema" className="inline-flex border border-rule">
      <button
        type="button"
        aria-pressed={theme === "dark"}
        aria-label="Tema oscuro"
        onClick={() => choose("dark")}
        className={buttonClass(theme === "dark")}
      >
        <MoonIcon />
      </button>
      <button
        type="button"
        aria-pressed={theme === "light"}
        aria-label="Tema claro"
        onClick={() => choose("light")}
        className={buttonClass(theme === "light")}
      >
        <SunIcon />
      </button>
    </div>
  );
}
