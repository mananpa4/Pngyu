import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { AppError, errorResponse } from "@/lib/errors";
import { getJob } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string; kind: string }> }) {
  try {
    const { id, kind } = await context.params;
    const job = await getJob(id);
    if (kind !== "input" && kind !== "output") throw new AppError("File not found.", 404);
    if (kind === "output" && !job.output) throw new AppError("Conversion result not found.", 404);
    const filePath = kind === "input" ? job.inputPath : job.output!.path;
    const info = await stat(filePath);
    const contentType = kind === "output" ? job.output!.mime : job.mime;
    const range = request.headers.get("range");
    let start = 0;
    let end = info.size - 1;
    let status = 200;
    const headers = new Headers({
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${kind === "output" ? `converted.${job.output!.format}` : job.inputName.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
    });
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match) throw new AppError("Invalid byte range.", 416);
      start = match[1] ? Number(match[1]) : 0;
      end = match[2] ? Math.min(Number(match[2]), info.size - 1) : info.size - 1;
      if (start > end || start >= info.size) throw new AppError("Invalid byte range.", 416);
      status = 206;
      headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
    }
    headers.set("Content-Length", String(end - start + 1));
    const stream = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream;
    return new Response(stream, { status, headers });
  } catch (error) {
    return errorResponse(error);
  }
}
