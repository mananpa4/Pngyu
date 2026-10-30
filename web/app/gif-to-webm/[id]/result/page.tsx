import type { Metadata } from "next";
import { ToolShell } from "@/components/ToolShell";
import { ResultPanel } from "@/components/ResultPanel";

export const metadata: Metadata = { title: "WebM conversion result", robots: { index: false, follow: false } };
export default async function Result({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ToolShell title="Conversion result" description="Preview the converted media, compare file sizes and download it before automatic cleanup."><ResultPanel id={id} /></ToolShell>;
}
