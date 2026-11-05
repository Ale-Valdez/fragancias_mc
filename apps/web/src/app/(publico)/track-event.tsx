"use client";

import type { PublicEvent } from "@fmc/shared";
import { useEffect } from "react";

const DEDUPE_MS = 2000;

export function sendEvent(event: PublicEvent): void {
  const body = JSON.stringify(event);
  void fetch("/api/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    keepalive: true,
    body,
  }).catch(() => undefined);
}

/** Una vista por ficha. La ventana corta evita el doble aviso del modo estricto. */
export function TrackProductView({ productId }: { productId: number }) {
  useEffect(() => {
    const key = `fmc_view_${productId}`;
    try {
      const previous = Number(sessionStorage.getItem(key));
      if (Number.isFinite(previous) && Date.now() - previous < DEDUPE_MS) return;
      sessionStorage.setItem(key, String(Date.now()));
    } catch {
      // sessionStorage puede estar bloqueado; igual se anota la vista.
    }
    sendEvent({ type: "product_view", productId });
  }, [productId]);

  return null;
}
