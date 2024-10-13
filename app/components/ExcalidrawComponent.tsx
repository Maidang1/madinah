/* eslint-disable @typescript-eslint/no-explicit-any */

import { ClientOnly } from "remix-utils/client-only"
import { lazy, Suspense } from "react";
const ExcalidrawLazy = lazy(() => import("@excalidraw/excalidraw").then(mod => ({ default: mod.Excalidraw })))
const ExcalidrawComponent = ({ data }: { data: any }) => {
  const { appState, elements } = data;

  const UIOptions = {
    canvasActions: {
      changeViewBackgroundColor: true,
      clearCanvas: false,
      loadScene: false,
    },
  };

  return (
    <ClientOnly>
      {
        () =>
          <Suspense>
            <div className="w-full h-[500px]">
              <ExcalidrawLazy
                UIOptions={UIOptions}
                viewModeEnabled={true}
                initialData={{
                  appState: {
                    ...appState,
                    theme: "dark"
                  },
                  elements,
                  scrollToContent: true
                }}></ExcalidrawLazy>
            </div>

          </Suspense>
      }
    </ClientOnly>

  )
}

export default ExcalidrawComponent