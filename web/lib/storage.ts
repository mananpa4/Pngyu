import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { JobRecord, PublicJob } from "./types";
import { AppError } from "./errors";

const HOUR = 60 * 60 * 1000;
export const TEMP_ROOT =
  process.env.PNGYU_TEMP_DIR || path.join(os.tmpdir(), "pngyu-webm");

export async function createJobDirectory() {
  await mkdir(TEMP_ROOT, { recursive: true });
  const id = randomUUID();
  const directory = path.join(TEMP_ROOT, id);
  await mkdir(directory, { recursive: true });
  return { id, directory };
}

function assertId(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AppError("Invalid job ID.", 400);
}

export async function saveJob(job: JobRecord) {
  assertId(job.id);
  await writeFile(
    path.join(TEMP_ROOT, job.id, "job.json"),
    JSON.stringify(job, null, 2),
    "utf8",
  );
}

export async function getJob(id: string) {
  assertId(id);
  try {
    const raw = await readFile(path.join(TEMP_ROOT, id, "job.json"), "utf8");
    const job = JSON.parse(raw) as JobRecord;
    if (Date.parse(job.expiresAt) <= Date.now()) {
      await rm(path.join(TEMP_ROOT, id), { recursive: true, force: true });
      throw new AppError("This upload has expired.", 410);
    }
    return job;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("Upload not found or already expired.", 404);
  }
}

export function toPublicJob(job: JobRecord): PublicJob {
  const { inputPath: _inputPath, output, ...safe } = job;
  void _inputPath;
  return {
    ...safe,
    inputUrl: `/api/files/${job.id}/input`,
    output: output
      ? { size: output.size, createdAt: output.createdAt, format: output.format,
          mime: output.mime, url: `/api/files/${job.id}/output` }
      : undefined,
  };
}

export function expiryDate() {
  return new Date(Date.now() + HOUR).toISOString();
}

export async function cleanupExpired() {
  await mkdir(TEMP_ROOT, { recursive: true });
  const entries = await readdir(TEMP_ROOT, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const directory = path.join(TEMP_ROOT, entry.name);
        try {
          const job = JSON.parse(
            await readFile(path.join(directory, "job.json"), "utf8"),
          ) as JobRecord;
          if (Date.parse(job.expiresAt) <= Date.now())
            await rm(directory, { recursive: true, force: true });
        } catch {
          const info = await stat(directory);
          if (Date.now() - info.mtimeMs > HOUR)
            await rm(directory, { recursive: true, force: true });
        }
      }),
  );
}

// Keep one best-effort cleanup timer per Node.js process. Expiry is still
// checked on every read, so a recycled process cannot make stale jobs visible.
const processState = globalThis as typeof globalThis & {
  __pngyuCleanupTimer?: NodeJS.Timeout;
};
if (!processState.__pngyuCleanupTimer) {
  processState.__pngyuCleanupTimer = setInterval(() => {
    cleanupExpired().catch((error) => console.error("Temporary file cleanup failed", error));
  }, 10 * 60 * 1000);
  processState.__pngyuCleanupTimer.unref();
}
