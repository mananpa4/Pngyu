"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function UploadPanel() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const choose = (candidate?: File) => {
    if (!candidate) return;
    setError(""); setUrl(""); setFile(candidate);
  };

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const pasted = Array.from(event.clipboardData?.files || [])[0];
      if (pasted) choose(pasted);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const submit = () => {
    if (!file && !url.trim()) { setError("Choose a file or enter a direct URL."); return; }
    setBusy(true); setError(""); setProgress(0);
    const form = new FormData();
    if (file) form.set("file", file); else form.set("url", url.trim());
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (event) => event.lengthComputable && setProgress(Math.round(event.loaded / event.total * 100));
    xhr.onload = () => {
      setBusy(false);
      try {
        const payload = JSON.parse(xhr.responseText) as { job?: { id: string }; error?: string };
        if (xhr.status >= 200 && xhr.status < 300 && payload.job) router.push(`/convert/${payload.job.id}`);
        else setError(payload.error || "Upload failed.");
      } catch { setError("The server returned an invalid response."); }
    };
    xhr.onerror = () => { setBusy(false); setError("Network error during upload."); };
    xhr.send(form);
  };

  return (
    <section className="utility-card upload-card">
      <div
        className={`dropzone ${dragging ? "dragging" : ""}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files[0]); }}
        onClick={() => input.current?.click()}
        role="button" tabIndex={0}
        onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && input.current?.click()}
      >
        <div className="upload-icon">↥</div>
        <strong>{file ? file.name : "Drop an image or video here"}</strong>
        <span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "or click to choose a file · paste also works"}</span>
        <input ref={input} hidden type="file" onChange={(event) => choose(event.target.files?.[0])} />
      </div>
      <div className="or"><span>OR USE A DIRECT URL</span></div>
      <input className="text-input" type="url" value={url} disabled={!!file || busy} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/animation.gif" />
      {file && <button className="text-button" type="button" onClick={() => setFile(null)}>Remove selected file</button>}
      {error && <p className="error" role="alert">{error}</p>}
      {busy && <div className="progress"><span style={{ width: `${Math.max(progress, 8)}%` }} /></div>}
      <button className="primary-button" type="button" disabled={busy} onClick={submit}>{busy ? `Uploading… ${progress || ""}` : "Upload image"}</button>
      <p className="fine-print">Common image and video formats · maximum 200 MB · files are deleted automatically after 1 hour.</p>
    </section>
  );
}
