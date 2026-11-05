"use client";

import { whatsappHref } from "@/lib/site";
import { sendEvent } from "../../track-event";

export function WhatsappLink({
  productId,
  phone,
  name,
  brand,
  pageUrl,
}: {
  productId: number;
  phone: string;
  name: string;
  brand: string;
  pageUrl: string;
}) {
  const href = whatsappHref(phone, `Hola, quiero consultar por ${name} (${brand}). ${pageUrl}`);

  return (
    <a
      href={href}
      onClick={() => sendEvent({ type: "whatsapp_click", productId })}
      className="inline-flex h-12 items-center bg-gold px-6 text-sm font-medium text-page hover:bg-gold-bright"
    >
      Consultar por WhatsApp
    </a>
  );
}
