import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-start justify-center gap-4 py-24">
      <p className="text-xs tracking-[0.28em] text-gold uppercase">404</p>
      <h1 className="text-3xl font-light">No encontramos esa página</h1>
      <Link href="/catalogo" className="text-sm text-gold-bright underline underline-offset-4">
        Volver al catálogo
      </Link>
    </div>
  );
}
