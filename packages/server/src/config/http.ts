import { ZodError, ZodSchema } from "zod";

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function parseWithSchema<T>(schema: ZodSchema<T>, input: unknown): T {
  return schema.parse(input);
}

function formatZodPath(path: Array<string | number>) {
  return path.length > 0 ? path.join(".") : "request";
}

function formatZodError(error: ZodError) {
  const details = error.issues
    .map((issue) => `${formatZodPath(issue.path)}: ${issue.message}`)
    .join("; ");

  return details ? `Invalid request: ${details}` : "Invalid request";
}

export function getErrorMessage(error: unknown, fallback = "Internal server error"): string {
  if (error instanceof ZodError) {
    return formatZodError(error);
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export function getErrorStatus(error: unknown): number {
  if (error instanceof HttpError) {
    return error.statusCode;
  }

  return error instanceof ZodError ? 400 : 500;
}
