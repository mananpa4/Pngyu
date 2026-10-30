import Link from "next/link";
import { ToolShell } from "@/components/ToolShell";

export default async function Placeholder({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const title = slug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  return <ToolShell title={title} description="This converter is part of the planned tool family and is not available in the current MVP."><section className="utility-card placeholder"><div>◌</div><h2>Coming soon</h2><p>The shared upload, FFmpeg and temporary-storage architecture is ready for this tool to be added without duplicating the application.</p><Link className="primary-button" href="/gif-to-webm">Use GIF to WebM</Link></section></ToolShell>;
}
