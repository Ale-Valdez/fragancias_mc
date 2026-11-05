"use client";

import { useEffect, useState, type MouseEvent } from "react";

type Theme = "dark" | "light";

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function CatalogDownloadLink({ className, children }: { className: string; children: string }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const sync = () => setTheme(readTheme());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    event.currentTarget.search = `theme=${readTheme()}`;
  }

  return (
    <a target="_blank" href={`/api/catalog/download?theme=${theme}`} onClick={onClick} className={className}>
      {children}
    </a>
  );
}
