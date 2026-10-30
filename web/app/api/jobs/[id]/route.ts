import { errorResponse } from "@/lib/errors";
import { cleanupExpired, getJob, toPublicJob } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await cleanupExpired();
    const { id } = await context.params;
    return Response.json({ job: toPublicJob(await getJob(id)) });
  } catch (error) {
    return errorResponse(error);
  }
}
