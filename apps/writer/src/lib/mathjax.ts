const MATHJAX_SCRIPT_ID = "MathJax-script";
// Vendored from the mathjax npm package into public/mathjax (see package.json
// dependency); loaded from disk so the app works offline and the initial page
// load never waits on it.
const MATHJAX_SCRIPT_SRC = "./mathjax/tex-mml-chtml.js";

// Cheap pre-check so documents without math never load the 1MB runtime.
const MATH_DELIMITER_PATTERN = /\$|\\\(|\\\[/;

let mathJaxPromise: Promise<void> | null = null;

export function sourceMayContainMath(source: string): boolean {
  return MATH_DELIMITER_PATTERN.test(source);
}

export function loadMathJax(): Promise<void> {
  mathJaxPromise ??= new Promise<void>((resolve, reject) => {
    window.MathJax = {
      tex: {
        inlineMath: [
          ["$", "$"],
          ["\\(", "\\)"],
        ],
        displayMath: [
          ["$$", "$$"],
          ["\\[", "\\]"],
        ],
        processEscapes: true,
        processEnvironments: true,
      },
      options: {
        skipHtmlTags: ["script", "noscript", "style", "textarea", "pre"],
      },
    };

    const script = document.createElement("script");
    script.id = MATHJAX_SCRIPT_ID;
    script.async = true;
    script.src = MATHJAX_SCRIPT_SRC;
    script.onload = () => {
      // Wait for MathJax's own async startup before callers typeset.
      const startup = (window.MathJax as { startup?: { promise?: Promise<void> } })
        .startup;
      void Promise.resolve(startup?.promise).then(() => resolve());
    };
    script.onerror = () => {
      mathJaxPromise = null;
      script.remove();
      reject(new Error("Failed to load MathJax"));
    };
    document.head.appendChild(script);
  });

  return mathJaxPromise;
}
