import type { ComponentType } from "react";
import { Fragment } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { run } from "@mdx-js/mdx";
import type { EngineProfile } from "../domain/engine";
import {
  compileMdxPreviewCode,
  createBuiltinPreviewCompileProfile,
} from "./mdx-preview-compiler";

export type MdxPreviewContent = ComponentType<{
  components?: Record<string, ComponentType<Record<string, unknown>>>;
}>;

interface CompileMdxPreviewOptions {
  profile?: EngineProfile;
}

interface PreviewWorkerRequest {
  requestId: number;
  source: string;
  profileId: string;
}

type PreviewWorkerResponse =
  | {
      requestId: number;
      ok: true;
      code: string;
    }
  | {
      requestId: number;
      ok: false;
      error: string;
    };

const previewWorkerRequests = new Map<
  number,
  {
    resolve: (code: string) => void;
    reject: (error: Error) => void;
  }
>();
let previewWorker: Worker | null = null;
let previewWorkerRequestId = 0;

export async function compileMdxPreview(
  source: string,
  options: CompileMdxPreviewOptions = {},
): Promise<MdxPreviewContent> {
  const code =
    (await compileMdxPreviewCodeInWorker(source, options.profile).catch(() => null)) ??
    (await compileMdxPreviewCode(source, {
      profile: options.profile,
    }));
  const mod = await run(code, {
    Fragment,
    jsx,
    jsxs,
    baseUrl: import.meta.url,
  });

  return mod.default as MdxPreviewContent;
}

function compileMdxPreviewCodeInWorker(
  source: string,
  profile: EngineProfile | undefined,
): Promise<string> {
  if (!canCompileInPreviewWorker(profile)) {
    return Promise.reject(new Error("Preview worker does not support this profile"));
  }
  if (typeof Worker === "undefined") {
    return Promise.reject(new Error("Preview worker is unavailable"));
  }

  const worker = getPreviewWorker();
  const requestId = ++previewWorkerRequestId;
  return new Promise((resolve, reject) => {
    previewWorkerRequests.set(requestId, { resolve, reject });
    worker.postMessage({
      requestId,
      source,
      profileId: profile.id,
    } satisfies PreviewWorkerRequest);
  });
}

function canCompileInPreviewWorker(
  profile: EngineProfile | undefined,
): profile is EngineProfile {
  if (!profile) return false;
  return createBuiltinPreviewCompileProfile(profile.id) !== null;
}

function getPreviewWorker(): Worker {
  if (previewWorker) return previewWorker;

  previewWorker = new Worker(new URL("./mdx-preview.worker.ts", import.meta.url), {
    type: "module",
  });
  previewWorker.addEventListener("message", handlePreviewWorkerMessage);
  previewWorker.addEventListener("error", handlePreviewWorkerFailure);
  return previewWorker;
}

function handlePreviewWorkerMessage(event: MessageEvent<PreviewWorkerResponse>) {
  const payload = event.data;
  const request = previewWorkerRequests.get(payload.requestId);
  if (!request) return;
  previewWorkerRequests.delete(payload.requestId);

  if (payload.ok) {
    request.resolve(payload.code);
    return;
  }

  request.reject(new Error(payload.error));
}

function handlePreviewWorkerFailure(event: ErrorEvent) {
  const error = new Error(event.message || "Preview worker failed");
  for (const [requestId, request] of previewWorkerRequests) {
    previewWorkerRequests.delete(requestId);
    request.reject(error);
  }
  previewWorker?.terminate();
  previewWorker = null;
}
