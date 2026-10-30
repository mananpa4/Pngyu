import type { ReactNode } from "react";

export function ToolShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className="page-width tool-page">
      <div className="eyebrow">UNIVERSAL MEDIA CONVERTER</div>
      <h1>{title}</h1>
      <p className="lede">{description}</p>
      {children}
    </main>
  );
}
