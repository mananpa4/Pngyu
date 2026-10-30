import type { Metadata } from "next";
import { ToolShell } from "@/components/ToolShell";
import { ConversionPanel } from "@/components/ConversionPanel";

export const metadata: Metadata = { title: "WebM conversion options" };
export default async function Options({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ToolShell title="Choose output format and settings" description="Review the source, select an output format and tune quality, codec, dimensions, frame rate, crop and audio."><ConversionPanel id={id} /></ToolShell>;
}
