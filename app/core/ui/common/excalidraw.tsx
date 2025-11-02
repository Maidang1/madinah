import { lazy, Suspense, type ComponentType } from 'react';
import { ClientOnly } from 'remix-utils/client-only';

const EXCALIDRAW_CDN_URL = 'https://images.felixwliu.cn/excalidraw-CZS1DkOt.js';

const loadExcalidraw = async (): Promise<ComponentType<unknown> | undefined> => {
  const mod = await import(/* @vite-ignore */ EXCALIDRAW_CDN_URL);
  return mod.default ?? mod.Excalidraw;
};

const ExcalidrawLazy = lazy(async () => {
  const Component = await loadExcalidraw();
  if (!Component) {
    throw new Error('Excalidraw bundle did not export a component.');
  }
  return { default: Component };
});

type ExcalidrawElement = Record<string, unknown>;

type ExcalidrawData = {
  appState?: Record<string, unknown>;
  elements: ExcalidrawElement[];
};

type ExcalidrawProps = {
  data: ExcalidrawData;
};

const DEFAULT_HEIGHT = 500;

const UIOptions = {
  canvasActions: {
    changeViewBackgroundColor: true,
    clearCanvas: false,
    loadScene: false,
  },
};

export default function ExcalidrawViewer({ data }: ExcalidrawProps) {
  const { appState = {}, elements = [] } = data;

  return (
    <ClientOnly>
      {() => (
        <Suspense fallback={null}>
          <div className="w-full" style={{ height: DEFAULT_HEIGHT }}>
            <ExcalidrawLazy
              UIOptions={UIOptions}
              viewModeEnabled={true}
              initialData={{
                appState: {
                  ...appState,
                  theme: 'dark',
                },
                elements,
                scrollToContent: true,
              }}
            />
          </div>
        </Suspense>
      )}
    </ClientOnly>
  );
}
