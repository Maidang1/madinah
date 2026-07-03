declare module "*?raw" {
  const source: string;
  export default source;
}

interface Window {
  MathJax?: {
    tex?: unknown;
    options?: unknown;
    startup?: {
      pageReady?: () => Promise<void>;
    };
    typesetPromise?: (elements?: Element[]) => Promise<void>;
    typesetClear?: (elements?: Element[]) => void;
  };
}
