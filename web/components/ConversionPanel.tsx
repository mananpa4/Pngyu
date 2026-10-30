"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { OUTPUT_BY_ID, OUTPUT_FORMATS } from "@/lib/formats";
import type { OutputFormat, PublicJob } from "@/lib/types";

export function ConversionPanel({ id }: { id: string }) {
  const router = useRouter();
  const [job, setJob] = useState<PublicJob | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [format, setFormat] = useState<OutputFormat>("webm");
  const definition = OUTPUT_BY_ID[format];
  const [codec, setCodec] = useState("vp9");
  const [bitrate, setBitrate] = useState(1200);
  const [quality, setQuality] = useState(80);
  const [width, setWidth] = useState("");
  const [fps, setFps] = useState("");
  const [crop, setCrop] = useState("");
  const [loop, setLoop] = useState(true);
  const [includeAudio, setIncludeAudio] = useState(true);
  const [stillDuration, setStillDuration] = useState(3);
  const sourceIsStill = useMemo(
    () => job?.metadata.mediaType === "image" && (!job.metadata.frames || job.metadata.frames <= 1),
    [job],
  );

  useEffect(() => {
    fetch(`/api/jobs/${id}`, { cache: "no-store" }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Upload not found.");
      setJob(payload.job);
    }).catch((reason) => setError(reason.message));
  }, [id]);

  const changeFormat = (next: OutputFormat) => {
    setFormat(next);
    setCodec(OUTPUT_BY_ID[next].codecs[0].id);
  };

  const convert = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/convert", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          options: {
            format, codec, bitrate, quality, width: width || null, fps: fps || null,
            crop: crop || null, loop, includeAudio, stillDuration,
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Conversion failed.");
      router.push(`/convert/${id}/result`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Conversion failed.");
      setBusy(false);
    }
  };

  if (error && !job) return <div className="utility-card"><p className="error">{error}</p></div>;
  if (!job) return <div className="utility-card loading">Loading upload…</div>;
  return (
    <div className="conversion-grid">
      <section className="utility-card preview-card">
        <div className="card-label">ORIGINAL · {job.metadata.mediaType.toUpperCase()}</div>
        {job.metadata.mediaType === "video"
          ? <video controls muted playsInline src={job.inputUrl} />
          // eslint-disable-next-line @next/next/no-img-element
          : <img src={job.inputUrl} alt={`Preview of ${job.inputName}`} />}
        <h2>{job.inputName}</h2>
        <dl className="metadata">
          <div><dt>Size</dt><dd>{formatBytes(job.originalSize)}</dd></div>
          <div><dt>Container</dt><dd>{job.metadata.format}</dd></div>
          <div><dt>Dimensions</dt><dd>{job.metadata.width && job.metadata.height ? `${job.metadata.width} × ${job.metadata.height}` : "Unknown"}</dd></div>
          <div><dt>Frames</dt><dd>{job.metadata.frames ?? "Unknown"}</dd></div>
          <div><dt>Duration</dt><dd>{job.metadata.duration ? `${job.metadata.duration.toFixed(2)} s` : "Still image"}</dd></div>
          <div><dt>Audio</dt><dd>{job.metadata.hasAudio ? "Yes" : "No"}</dd></div>
        </dl>
      </section>
      <section className="utility-card options-card">
        <div className="card-label">OUTPUT SETTINGS</div>
        <label>Output format
          <select value={format} onChange={(event) => changeFormat(event.target.value as OutputFormat)}>
            <optgroup label="Video">{OUTPUT_FORMATS.filter((item) => item.kind === "video").map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</optgroup>
            <optgroup label="Animated image">{OUTPUT_FORMATS.filter((item) => item.kind === "animated").map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</optgroup>
            <optgroup label="Still image">{OUTPUT_FORMATS.filter((item) => item.kind === "still").map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</optgroup>
          </select>
        </label>
        {definition.kind === "video" && <label>Codec
          <select value={codec} onChange={(event) => setCodec(event.target.value)}>{definition.codecs.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select>
        </label>}
        <label>Quality <span>{quality}%</span><input type="range" min="1" max="100" value={quality} onChange={(event) => setQuality(Number(event.target.value))} /></label>
        {definition.kind === "video" && <label>Video bitrate <span>{bitrate === 0 ? "Auto" : `${bitrate} kbps`}</span><input type="range" min="0" max="20000" step="100" value={bitrate} onChange={(event) => setBitrate(Number(event.target.value))} /></label>}
        <div className="two-fields"><label>Width (px)<input type="number" min="16" max="16384" placeholder="Original" value={width} onChange={(event) => setWidth(event.target.value)} /></label><label>Maximum FPS<select value={fps} onChange={(event) => setFps(event.target.value)}><option value="">Original</option>{[8,10,12,15,20,24,25,30,50,60].map((value) => <option key={value}>{value}</option>)}</select></label></div>
        <label>Crop (optional)<input value={crop} onChange={(event) => setCrop(event.target.value)} placeholder="width:height:x:y" /></label>
        {sourceIsStill && definition.kind === "video" && <label>Video duration (seconds)<input type="number" min="0.1" max="3600" step="0.1" value={stillDuration} onChange={(event) => setStillDuration(Number(event.target.value))} /></label>}
        {(definition.kind === "video" || definition.kind === "animated") && <label className="check"><input type="checkbox" checked={loop} onChange={(event) => setLoop(event.target.checked)} /> Playback loop hint</label>}
        {definition.kind === "video" && job.metadata.hasAudio && <label className="check"><input type="checkbox" checked={includeAudio} onChange={(event) => setIncludeAudio(event.target.checked)} /> Preserve audio</label>}
        {definition.kind === "still" && job.metadata.frames && job.metadata.frames > 1 && <p className="fine-print">Still-image output uses the first visual frame.</p>}
        {error && <p className="error">{error}</p>}
        {busy && <div className="indeterminate" aria-label="Converting" />}
        <button className="primary-button" type="button" disabled={busy} onClick={convert}>{busy ? "Converting with FFmpeg…" : `Convert to ${definition.label}`}</button>
      </section>
    </div>
  );
}

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
