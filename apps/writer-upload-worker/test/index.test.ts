import { describe, expect, it } from "vitest";
import { handleRequest } from "../src/index";

describe("writer upload worker", () => {
  it("requires the API key for health checks", async () => {
    const response = await handleRequest(
      new Request("https://upload.example.com/health"),
      fakeEnv(),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      message: "Unauthorized",
    });
  });

  it("stores uploaded objects in R2", async () => {
    const bucket = fakeBucket();
    const response = await handleRequest(
      new Request("https://upload.example.com/images/writer/test.png", {
        method: "PUT",
        headers: {
          "cache-control": "public, max-age=31536000, immutable",
          "content-type": "image/png",
          "x-api-key": "secret",
        },
        body: new Uint8Array([1, 2, 3]),
      }),
      fakeEnv(bucket),
    );

    expect(response.status).toBe(200);
    expect(bucket.objects.get("images/writer/test.png")).toMatchObject({
      contentType: "image/png",
      cacheControl: "public, max-age=31536000, immutable",
    });
  });

  it("serves stored objects with HTTP metadata", async () => {
    const bucket = fakeBucket();
    bucket.objects.set("images/writer/test.png", {
      body: new Uint8Array([1, 2, 3]),
      cacheControl: "public, max-age=31536000, immutable",
      contentType: "image/png",
      etag: "etag",
    });

    const response = await handleRequest(
      new Request("https://upload.example.com/images/writer/test.png", {
        headers: {
          "x-api-key": "secret",
        },
      }),
      fakeEnv(bucket),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
    await expect(response.arrayBuffer()).resolves.toHaveProperty("byteLength", 3);
  });

  it("rejects path traversal keys", async () => {
    const response = await handleRequest(
      new Request("https://upload.example.com/images/..%2Fsecret.png", {
        method: "PUT",
        headers: {
          "x-api-key": "secret",
        },
        body: new Uint8Array([1]),
      }),
      fakeEnv(),
    );

    expect(response.status).toBe(400);
  });
});

interface StoredObject {
  body: Uint8Array;
  cacheControl: string;
  contentType: string;
  etag: string;
}

function fakeEnv(bucket = fakeBucket()): Env {
  return {
    AUTH_KEY_SECRET: "secret",
    R2_BUCKET: bucket as unknown as R2Bucket,
  };
}

function fakeBucket() {
  const objects = new Map<string, StoredObject>();

  return {
    objects,
    async put(
      key: string,
      value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob | null,
      options?: R2PutOptions,
    ) {
      const body = await valueToBytes(value);
      const contentType = metadataValue(options?.httpMetadata, "contentType");
      const cacheControl = metadataValue(options?.httpMetadata, "cacheControl");
      const object = {
        body,
        cacheControl,
        contentType,
        etag: `"${key}"`,
      };
      objects.set(key, object);
      return {
        httpEtag: object.etag,
        key,
        size: body.byteLength,
      };
    },
    async get(key: string) {
      const object = objects.get(key);
      if (!object) return null;
      return {
        body: object.body,
        httpEtag: object.etag,
        writeHttpMetadata(headers: Headers) {
          headers.set("content-type", object.contentType);
          headers.set("cache-control", object.cacheControl);
        },
      };
    },
    async delete(key: string) {
      objects.delete(key);
    },
  };
}

async function valueToBytes(
  value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob | null,
): Promise<Uint8Array> {
  if (!value) return new Uint8Array();
  if (typeof value === "string") return new TextEncoder().encode(value);
  if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer());
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }

  const response = new Response(value);
  return new Uint8Array(await response.arrayBuffer());
}

function metadataValue(
  metadata: R2HTTPMetadata | Headers | undefined,
  key: "cacheControl" | "contentType",
): string {
  if (!metadata) return "";
  if (metadata instanceof Headers) {
    return metadata.get(key === "cacheControl" ? "cache-control" : "content-type") ?? "";
  }
  return metadata[key] ?? "";
}
