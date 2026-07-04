import {
  compileMdxPreviewCode,
  createBuiltinPreviewCompileProfile,
} from "./mdx-preview-compiler";

interface PreviewWorkerRequest {
  requestId: number;
  source: string;
  profileId: string;
}

interface PreviewWorkerSuccess {
  requestId: number;
  ok: true;
  code: string;
}

interface PreviewWorkerFailure {
  requestId: number;
  ok: false;
  error: string;
}

type PreviewWorkerResponse = PreviewWorkerSuccess | PreviewWorkerFailure;

self.onmessage = (event: MessageEvent<PreviewWorkerRequest>) => {
  const { requestId, source, profileId } = event.data;
  void compileMdxPreviewCode(source, {
    profile: createBuiltinPreviewCompileProfile(profileId),
  })
    .then((code) => {
      postWorkerMessage({
        requestId,
        ok: true,
        code,
      });
    })
    .catch((error: unknown) => {
      postWorkerMessage({
        requestId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    });
};

function postWorkerMessage(message: PreviewWorkerResponse) {
  self.postMessage(message);
}
