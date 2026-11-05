"use client";

import type { CatalogProduct } from "@fmc/shared";
import { useSyncExternalStore } from "react";
import { ProductCard } from "../product-card";

type Vista = "grilla" | "fila";

const STORAGE_KEY = "fmc-catalog-vista";

let vista: Vista = "grilla";
let ready = false;
const listeners = new Set<() => void>();

function readStored(): Vista {
  if (ready) return vista;
  ready = true;
  try {
    vista = sessionStorage.getItem(STORAGE_KEY) === "fila" ? "fila" : "grilla";
  } catch {
    vista = "grilla";
  }
  return vista;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return readStored();
}

function getServerSnapshot(): Vista {
  return "grilla";
}

function choose(next: Vista) {
  vista = next;
  ready = true;
  try {
    sessionStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private mode can block storage; the choice still applies for this visit.
  }
  for (const listener of listeners) listener();
}

function buttonClass(pressed: boolean) {
  return `inline-flex h-9 items-center px-3 text-sm ${pressed ? "bg-gold text-page" : "text-reason hover:text-ink"}`;
}

export function VistaCatalogo({ label, items }: { label: string; items: CatalogProduct[] }) {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const row = current === "fila";

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{label}</p>
        <div role="group" aria-label="Vista" className="inline-flex shrink-0 border border-rule sm:hidden">
          <button type="button" aria-pressed={current === "grilla"} onClick={() => choose("grilla")} className={buttonClass(current === "grilla")}>
            Grilla
          </button>
          <button type="button" aria-pressed={current === "fila"} onClick={() => choose("fila")} className={buttonClass(current === "fila")}>
            Fila
          </button>
        </div>
      </div>
      <ul
        className={
          row
            ? "flex flex-col gap-4 sm:grid sm:grid-cols-3 sm:gap-x-4 sm:gap-y-8 lg:grid-cols-4"
            : "grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4"
        }
      >
        {items.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} layout={row ? "row" : "grid"} />
          </li>
        ))}
      </ul>
    </>
  );
}
