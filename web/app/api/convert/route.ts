import { stat } from "node:fs/promises";
import path from "node:path";
import { errorResponse, AppError } from "@/lib/errors";
import { convert, parseOptions } from "@/lib/media";
import { OUTPUT_BY_ID } from "@/lib/formats";
import { cleanupExpired, getJob, saveJob, toPublicJob } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await cleanupExpired();
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.id !== "string") throw new AppError("Missing job ID.");
    const job = await getJob(body.id);
    const options = parseOptions(body.options);
    const definition = OUTPUT_BY_ID[options.format];
    const output = path.join(path.dirname(job.inputPath), `output.${options.format}`);
    await convert(job.inputPath, output, options, job.metadata);
    const info = await stat(output);
    job.output = {
      path: output,
      size: info.size,
      createdAt: new Date().toISOString(),
      format: options.format,
      mime: definition.mime,
    };
    await saveJob(job);
    return Response.json({ job: toPublicJob(job) });
  } catch (error) {
    return errorResponse(error);
  }
}
