declare module "*?raw" {
  const source: string;
  export default source;
}

interface Window {
  MathJax?: {
    typesetPromise?: (elements?: Element[]) => Promise<void>;
    typesetClear?: (elements?: Element[]) => void;
  };
}
