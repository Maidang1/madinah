import { json } from "@remix-run/cloudflare";

interface ErrorResponseOptions extends ResponseInit {
  message?: string;
}

/**
 * Ensures the provided value exists, otherwise throws a Remix Response with the given status.
 */
export function assertResponse<T>(
  value: T | null | undefined,
  message: string,
  status = 400,
): T {
  if (value === null || value === undefined || value === "") {
    throw new Response(message, { status });
  }

  return value;
}

/**
 * Normalizes thrown errors into JSON responses for API-like loaders/actions.
 */
export function jsonError(
  message: string,
  { status = 500, headers, message: overrideMessage }: ErrorResponseOptions = {},
) {
  return json(
    { error: overrideMessage ?? message },
    { status, headers },
  );
}
