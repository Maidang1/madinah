/// <reference types="vite/client" />

interface Window {
  MathJax?: {
    typesetPromise?: (elements?: Element[]) => Promise<void>;
    typesetClear?: (elements?: Element[]) => void;
  };
}
