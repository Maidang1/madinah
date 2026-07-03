const API_KEY_HEADER = "x-api-key";
const DEFAULT_CACHE_CONTROL = "public, max-age=31536000, immutable";
const JSON_HEADERS = {
  "access-control-allow-origin": "*",
  "content-type": "application/json; charset=utf-8",
};
const CORS_HEADERS = {
  "access-control-allow-headers": "content-type, cache-control, x-api-key",
  "access-control-allow-methods": "GET, PUT, DELETE, OPTIONS",
  "access-control-allow-origin": "*",
  "access-control-max-age": "86400",
};

export default {
  async fetch(request, env): Promise<Response> {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      return json(
        {
          ok: false,
          message: error instanceof Error ? error.message : "Internal error",
        },
        500,
      );
    }
  },
} satisfies ExportedHandler<Env>;

export async function handleRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  if (url.pathname === "/" && request.method === "GET") {
    return text("Madinah Writer upload worker");
  }

  if (url.pathname === "/health" && request.method === "GET") {
    const auth = await requireApiKey(request, env);
    if (auth) return auth;
    return json({ ok: true, provider: "cloudflare-r2-worker" });
  }

  const auth = await requireApiKey(request, env);
  if (auth) return auth;

  const key = keyFromPath(url.pathname);
  if (!key) return json({ ok: false, message: "Object key is required" }, 400);

  if (request.method === "PUT") {
    return putObject(request, env, key);
  }

  if (request.method === "GET") {
    return getObject(env, key);
  }

  if (request.method === "DELETE") {
    await env.R2_BUCKET.delete(key);
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  return json({ ok: false, message: "Method not allowed" }, 405, {
    allow: "GET, PUT, DELETE, OPTIONS",
  });
}

async function putObject(
  request: Request,
  env: Env,
  key: string,
): Promise<Response> {
  if (!request.body) {
    return json({ ok: false, message: "Request body is required" }, 400);
  }

  const object = await env.R2_BUCKET.put(key, request.body, {
    httpMetadata: {
      cacheControl: request.headers.get("cache-control") || DEFAULT_CACHE_CONTROL,
      contentType:
        request.headers.get("content-type") || "application/octet-stream",
    },
  });

  return json({
    ok: true,
    key,
    etag: object?.httpEtag ?? null,
    size: object?.size ?? null,
  });
}

async function getObject(env: Env, key: string): Promise<Response> {
  const object = await env.R2_BUCKET.get(key);
  if (!object) {
    return json({ ok: false, message: "Object not found" }, 404);
  }

  const headers = new Headers(CORS_HEADERS);
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
}

async function requireApiKey(
  request: Request,
  env: Env,
): Promise<Response | null> {
  if (!env.AUTH_KEY_SECRET) {
    return json({ ok: false, message: "AUTH_KEY_SECRET is not configured" }, 500);
  }

  const provided = request.headers.get(API_KEY_HEADER) ?? "";
  if (await secureEqual(provided, env.AUTH_KEY_SECRET)) {
    return null;
  }

  return json({ ok: false, message: "Unauthorized" }, 401);
}

async function secureEqual(left: string, right: string): Promise<boolean> {
  if (!left || !right) return false;

  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  return bytesEqual(new Uint8Array(leftHash), new Uint8Array(rightHash));
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index];
  }
  return diff === 0;
}

function keyFromPath(pathname: string): string | null {
  let key = "";
  try {
    key = pathname
      .replace(/^\/+/u, "")
      .split("/")
      .filter(Boolean)
      .map((part) => decodeURIComponent(part))
      .join("/");
  } catch {
    return null;
  }

  if (!key) return null;
  if (key.includes("\0")) return null;
  if (
    key
      .split("/")
      .some((segment) => segment === "." || segment === ".." || segment.includes(".."))
  ) {
    return null;
  }
  return key;
}

function json(
  value: unknown,
  status = 200,
  headers?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...headers,
    },
  });
}

function text(value: string, status = 200): Response {
  return new Response(value, {
    status,
    headers: {
      "access-control-allow-origin": "*",
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
