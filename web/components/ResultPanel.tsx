"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PublicJob } from "@/lib/types";
import { formatBytes } from "./ConversionPanel";
import { OUTPUT_BY_ID } from "@/lib/formats";

export function ResultPanel({ id }: { id: string }) {
  const [job, setJob] = useState<PublicJob | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch(`/api/jobs/${id}`, { cache: "no-store" }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok || !payload.job?.output) throw new Error(payload.error || "Conversion result not found.");
      setJob(payload.job);
    }).catch((reason) => setError(reason.message));
  }, [id]);
  if (error) return <section className="utility-card"><p className="error">{error}</p></section>;
  if (!job?.output) return <section className="utility-card loading">Loading result…</section>;
  const difference = job.originalSize - job.output.size;
  const percentage = job.originalSize ? difference / job.originalSize * 100 : 0;
  return (
    <>
      <section className="utility-card result-card">
        <div className="success-mark">✓</div><div><div className="card-label">CONVERSION COMPLETE</div><h2>Your {OUTPUT_BY_ID[job.output.format].label} is ready</h2></div>
        {OUTPUT_BY_ID[job.output.format].kind === "video"
          ? <video controls loop autoPlay muted playsInline src={job.output.url} />
          // eslint-disable-next-line @next/next/no-img-element
          : <img className="result-media" src={job.output.url} alt={`Converted ${job.output.format} result`} />}
        <div className="size-comparison"><div><span>Original</span><strong>{formatBytes(job.originalSize)}</strong></div><div className="arrow">→</div><div><span>WebM</span><strong>{formatBytes(job.output.size)}</strong></div><div className={difference >= 0 ? "saving" : "growth"}>{difference >= 0 ? `${percentage.toFixed(1)}% smaller` : `${Math.abs(percentage).toFixed(1)}% larger`}</div></div>
        <div className="result-actions"><a className="primary-button" href={job.output.url} download>Download {OUTPUT_BY_ID[job.output.format].label}</a><Link className="secondary-button" href="/convert">Convert another file</Link></div>
      </section>
      <SimilarTools />
    </>
  );
}

function SimilarTools() {
  const tools = [["WebP to WebM","/convert"],["APNG to WebM","/convert"],["GIF to MP4","/convert"],["Video to GIF","/convert"]];
  return <section id="tools" className="similar"><h2>Similar tools</h2><div>{tools.map(([name, href]) => <Link href={href} key={href}>{name}<span>→</span></Link>)}</div></section>;
}
