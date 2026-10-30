export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown) {
  const status = error instanceof AppError ? error.status : 500;
  const message =
    error instanceof Error ? error.message : "An unexpected error occurred.";
  if (status === 500) console.error(error);
  return Response.json({ error: message }, { status });
}
