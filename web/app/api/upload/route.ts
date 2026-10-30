import { writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { AppError, errorResponse } from "@/lib/errors";
import { MAX_BYTES, probe, validateFilename, validateFileSignature, validateRemoteUrl } from "@/lib/media";
import { cleanupExpired, createJobDirectory, expiryDate, saveJob, toPublicJob } from "@/lib/storage";
import type { JobRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function remoteFile(rawUrl: string) {
  let url = await validateRemoteUrl(rawUrl);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(30_000) });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirects === 3) throw new AppError("Too many or invalid URL redirects.");
      url = await validateRemoteUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new AppError(`The remote server returned ${response.status}.`);
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > MAX_BYTES) throw new AppError("The remote file exceeds the upload limit.", 413);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) throw new AppError("The remote file exceeds the upload limit.", 413);
    const mime = response.headers.get("content-type")?.split(";")[0] || "application/octet-stream";
    let name: string;
    try { name = path.basename(decodeURIComponent(url.pathname)) || "remote"; }
    catch { name = "remote"; }
    if (!/\.[a-z0-9]{1,10}$/i.test(name)) {
      const inferred: Record<string, string> = {
        "image/gif": ".gif", "image/apng": ".apng", "image/webp": ".webp",
        "image/png": ".png", "image/jpeg": ".jpg", "image/avif": ".avif",
        "image/heic": ".heic", "image/heif": ".heif", "image/jxl": ".jxl",
        "image/bmp": ".bmp", "image/tiff": ".tiff", "video/x-mng": ".mng",
        "video/mp4": ".mp4", "video/quicktime": ".mov", "video/webm": ".webm",
        "video/x-matroska": ".mkv", "video/x-msvideo": ".avi", "video/mpeg": ".mpeg",
        "video/x-ms-wmv": ".wmv", "video/x-flv": ".flv", "video/mp2t": ".ts",
        "video/3gpp": ".3gp", "video/ogg": ".ogv",
      };
      const extension = inferred[mime];
      if (!extension) throw new AppError("The URL does not identify a supported animated image.");
      name += extension;
    }
    return { bytes, name, mime };
  }
  throw new AppError("Unable to download the remote file.");
}

export async function POST(request: Request) {
  let directory = "";
  try {
    await cleanupExpired();
    const form = await request.formData();
    const file = form.get("file");
    const url = String(form.get("url") || "").trim();
    if (!(file instanceof File) && !url) throw new AppError("Choose a file or enter a direct URL.");
    if (file instanceof File && url) throw new AppError("Use either a file or a URL, not both.");

    const source = file instanceof File
      ? { bytes: new Uint8Array(await file.arrayBuffer()), name: file.name, mime: file.type || "application/octet-stream" }
      : await remoteFile(url);
    if (!source.bytes.byteLength) throw new AppError("The uploaded file is empty.");
    if (source.bytes.byteLength > MAX_BYTES) throw new AppError("The file exceeds the upload limit.", 413);
    const extension = validateFilename(source.name);
    validateFileSignature(source.bytes, extension);
    const created = await createJobDirectory();
    directory = created.directory;
    const inputPath = path.join(directory, `input${extension}`);
    await writeFile(inputPath, source.bytes);
    const metadata = await probe(inputPath);
    const now = new Date().toISOString();
    const job: JobRecord = {
      id: created.id,
      inputName: path.basename(source.name),
      inputPath,
      mime: ({
        ".gif": "image/gif", ".apng": "image/apng", ".png": "image/png",
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
        ".avif": "image/avif", ".heic": "image/heic", ".heif": "image/heif",
        ".jxl": "image/jxl", ".mng": "video/x-mng", ".bmp": "image/bmp",
        ".tif": "image/tiff", ".tiff": "image/tiff", ".mp4": "video/mp4",
        ".m4v": "video/mp4", ".mov": "video/quicktime", ".mkv": "video/x-matroska",
        ".webm": "video/webm", ".avi": "video/x-msvideo", ".mpeg": "video/mpeg",
        ".mpg": "video/mpeg", ".wmv": "video/x-ms-wmv", ".flv": "video/x-flv",
        ".ts": "video/mp2t", ".mts": "video/mp2t", ".m2ts": "video/mp2t",
        ".3gp": "video/3gpp", ".3g2": "video/3gpp2", ".ogv": "video/ogg",
      } as Record<string, string>)[extension] || "application/octet-stream",
      originalSize: source.bytes.byteLength,
      createdAt: now,
      expiresAt: expiryDate(),
      metadata,
    };
    await saveJob(job);
    return Response.json({ job: toPublicJob(job) }, { status: 201 });
  } catch (error) {
    if (directory) await rm(directory, { recursive: true, force: true });
    return errorResponse(error);
  }
}
