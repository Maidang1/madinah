import { ReactNode, useState, useRef, useEffect } from 'react';
import { cn } from '~/core/utils';

// TypeScript interfaces for code block props and state
export interface CodeBlockProps {
  children: ReactNode;
  className?: string;
  'data-language'?: string;
  'data-theme'?: string;
  [key: string]: any;
}

export interface CodeBlockState {
  copied: boolean;
  language: string;
  showCopyButton: boolean;
}

export interface CopyButtonProps {
  code: string;
  onCopy?: (success: boolean) => void;
  className?: string;
}

export interface LanguageBadgeProps {
  language: string;
  className?: string;
}

export interface CodeBlockMetadata {
  language: string;
  content: string;
  lineCount: number;
  hasLineNumbers?: boolean;
  theme: 'light' | 'dark';
}

// Language detection utility function
function detectLanguage(className?: string, dataLanguage?: string): string {
  // Priority 1: Explicit data-language attribute
  if (dataLanguage && dataLanguage.trim()) {
    return normalizeLanguageName(dataLanguage.trim());
  }

  // Priority 2: Extract from className patterns
  if (className) {
    // Match various className patterns: language-*, lang-*, hljs-*
    const patterns = [
      /language-(\w+)/,
      /lang-(\w+)/,
      /hljs-(\w+)/,
      /shiki-(\w+)/,
    ];

    for (const pattern of patterns) {
      const match = className.match(pattern);
      if (match && match[1]) {
        return normalizeLanguageName(match[1]);
      }
    }

    // Check for shiki theme classes that might indicate syntax highlighting
    if (className.includes('shiki')) {
      // If it's a shiki block but no specific language found, it might be plaintext
      return 'text';
    }
  }

  // Default to plaintext
  return 'text';
}

// Language name normalization and mapping
function normalizeLanguageName(lang: string): string {
  const languageMap: Record<string, string> = {
    // Common aliases and normalizations
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    rb: 'ruby',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    fish: 'shell',
    ps1: 'powershell',
    psm1: 'powershell',
    md: 'markdown',
    yml: 'yaml',
    toml: 'toml',
    json5: 'json',
    jsonc: 'json',
    htm: 'html',
    xml: 'html',
    svg: 'html',
    vue: 'html',
    svelte: 'html',
    astro: 'html',
    'c++': 'cpp',
    cxx: 'cpp',
    cc: 'cpp',
    h: 'cpp',
    hpp: 'cpp',
    hxx: 'cpp',
    cs: 'csharp',
    fs: 'fsharp',
    vb: 'vbnet',
    kt: 'kotlin',
    kts: 'kotlin',
    scala: 'scala',
    sc: 'scala',
    clj: 'clojure',
    cljs: 'clojure',
    edn: 'clojure',
    hs: 'haskell',
    lhs: 'haskell',
    elm: 'elm',
    ex: 'elixir',
    exs: 'elixir',
    erl: 'erlang',
    hrl: 'erlang',
    ml: 'ocaml',
    mli: 'ocaml',
    rs: 'rust',
    go: 'go',
    mod: 'go',
    sum: 'go',
    dart: 'dart',
    swift: 'swift',
    r: 'r',
    R: 'r',
    rmd: 'r',
    Rmd: 'r',
    matlab: 'matlab',
    m: 'matlab',
    tex: 'latex',
    latex: 'latex',
    bib: 'bibtex',
    sql: 'sql',
    mysql: 'sql',
    postgresql: 'sql',
    sqlite: 'sql',
    plsql: 'sql',
    tsql: 'sql',
    dockerfile: 'docker',
    dockerignore: 'docker',
    makefile: 'makefile',
    make: 'makefile',
    cmake: 'cmake',
    gradle: 'gradle',
    groovy: 'groovy',
    properties: 'properties',
    ini: 'ini',
    cfg: 'ini',
    conf: 'ini',
    config: 'ini',
    env: 'dotenv',
    gitignore: 'gitignore',
    gitattributes: 'gitignore',
    editorconfig: 'editorconfig',
    prettierrc: 'json',
    eslintrc: 'json',
    babelrc: 'json',
    tsconfig: 'json',
    package: 'json',
    lock: 'json',
    log: 'log',
    txt: 'text',
    text: 'text',
    plain: 'text',
    plaintext: 'text',
  };

  const normalized = lang.toLowerCase();
  return languageMap[normalized] || normalized;
}

// Enhanced Code Block Component
export function EnhancedCodeBlock({
  children,
  className,
  'data-language': dataLanguage,
  'data-theme': dataTheme,
  ...props
}: CodeBlockProps) {
  const [state, setState] = useState<CodeBlockState>({
    copied: false,
    language: '',
    showCopyButton: false,
  });

  const preRef = useRef<HTMLPreElement>(null);
  const [codeContent, setCodeContent] = useState<string>('');

  // Enhanced language detection
  useEffect(() => {
    const detectedLanguage = detectLanguage(className, dataLanguage);
    setState((prev) => ({ ...prev, language: detectedLanguage }));
  }, [className, dataLanguage]);

  // Extract code content for copying, excluding line numbers
  useEffect(() => {
    if (preRef.current) {
      const codeElement = preRef.current.querySelector('code');
      if (codeElement) {
        // Clone the code element to avoid modifying the original
        const clonedCode = codeElement.cloneNode(true) as HTMLElement;

        // Remove line number elements if they exist
        const lineNumbers = clonedCode.querySelectorAll(
          '.line-number, .line-numbers-rows, [data-line-number]',
        );
        lineNumbers.forEach((el) => el.remove());

        // Remove any elements with classes that typically contain line numbers
        const lineNumberClasses = clonedCode.querySelectorAll(
          '.token.number, .hljs-number',
        );
        lineNumberClasses.forEach((el) => {
          // Only remove if it's actually a line number (at start of line)
          const parent = el.parentElement;
          if (parent && parent.textContent?.trim().match(/^\d+/)) {
            el.remove();
          }
        });

        // Extract clean text content
        let textContent = clonedCode.textContent || '';

        // Clean up any remaining line number artifacts
        textContent = textContent
          .split('\n')
          .map((line) => {
            // Remove leading line numbers (digits followed by optional spaces/tabs)
            return line.replace(/^\s*\d+\s*/, '');
          })
          .join('\n')
          .trim();

        setCodeContent(textContent);
      }
    }
  }, [children]);

  // Handle copy success/failure callback
  const handleCopyResult = (success: boolean) => {
    setState((prev) => ({ ...prev, copied: success }));
    if (success) {
      setTimeout(() => {
        setState((prev) => ({ ...prev, copied: false }));
      }, 2000);
    }
  };

  // Handle mouse events for copy button visibility
  const handleMouseEnter = () => {
    setState((prev) => ({ ...prev, showCopyButton: true }));
  };

  const handleMouseLeave = () => {
    setState((prev) => ({ ...prev, showCopyButton: false }));
  };

  return (
    <div
      className={cn(
        'enhanced-code-block group relative mb-6',
        'overflow-hidden',
        // Remove Tailwind classes that conflict with CSS variables
        // 'border border-zinc-200 dark:border-zinc-700',
        // 'shadow-sm transition-shadow duration-200 hover:shadow-md',
        // 'bg-zinc-50 dark:bg-zinc-900',
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="region"
      aria-label={`Code block${state.language !== 'text' ? ` in ${state.language}` : ''}`}
    >
      {/* Language Badge - positioned to avoid copy button interference */}
      {shouldShowLanguageBadge(state.language) && (
        <LanguageBadge
          language={state.language}
          className="absolute top-3 left-3 z-10"
        />
      )}

      {/* Copy Button - positioned to avoid language badge interference */}
      <div
        className={cn(
          'copy-button-container absolute top-3 right-3 z-10',
          'transition-all duration-200 ease-out',
          'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100',
          state.showCopyButton ? 'opacity-100' : '',
          // Ensure proper spacing when language badge is present
          shouldShowLanguageBadge(state.language) && 'mr-0',
        )}
      >
        <CopyButton
          code={codeContent}
          onCopy={handleCopyResult}
          className="shadow-sm"
        />
      </div>

      {/* Code Block */}
      <pre
        ref={preRef}
        className={cn(
          'relative overflow-x-auto',
          'm-0',
          // Enhanced styling for plaintext blocks will be handled by CSS variables
          !className?.includes('shiki') && 'code-block-plaintext',
          className,
        )}
        tabIndex={0}
        role="code"
        aria-label="Code content"
        {...props}
      >
        {children}
      </pre>
    </div>
  );
}

// Copy Button Component (can be used independently)
export function CopyButton({ code, onCopy, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  const handleCopy = async () => {
    try {
      // Reset any previous error state
      setError(false);

      // Check if Clipboard API is available
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        onCopy?.(true);
      } else {
        // Fallback for browsers without Clipboard API or non-secure contexts
        await fallbackCopyTextToClipboard(code);
        setCopied(true);
        onCopy?.(true);
      }

      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
      setError(true);
      onCopy?.(false);

      // Reset error state after 2 seconds
      setTimeout(() => setError(false), 2000);
    }
  };

  // Fallback copy method for browsers without Clipboard API
  const fallbackCopyTextToClipboard = (text: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const textArea = document.createElement('textarea');
      textArea.value = text;

      // Make the textarea out of viewport
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (successful) {
          resolve();
        } else {
          reject(new Error('Copy command was unsuccessful'));
        }
      } catch (err) {
        document.body.removeChild(textArea);
        reject(err);
      }
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCopy();
    }
  };

  return (
    <button
      onClick={handleCopy}
      onKeyDown={handleKeyDown}
      className={cn(
        'copy-button',
        // Success state with animation
        copied && 'success',
        // Error state with animation
        error && 'error',
        className,
      )}
      aria-label={
        copied
          ? 'Code copied to clipboard'
          : error
            ? 'Failed to copy code'
            : 'Copy code to clipboard'
      }
      title={copied ? 'Copied!' : error ? 'Copy failed' : 'Copy code'}
      disabled={copied || error}
    >
      {copied ? 'Copied!' : error ? 'Failed' : 'Copy'}
    </button>
  );
}

// Language display name mapping for better user experience
function getLanguageDisplayName(language: string): string {
  const displayNames: Record<string, string> = {
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    python: 'Python',
    java: 'Java',
    csharp: 'C#',
    cpp: 'C++',
    c: 'C',
    rust: 'Rust',
    go: 'Go',
    php: 'PHP',
    ruby: 'Ruby',
    swift: 'Swift',
    kotlin: 'Kotlin',
    scala: 'Scala',
    clojure: 'Clojure',
    haskell: 'Haskell',
    elixir: 'Elixir',
    erlang: 'Erlang',
    ocaml: 'OCaml',
    fsharp: 'F#',
    dart: 'Dart',
    r: 'R',
    matlab: 'MATLAB',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    sass: 'Sass',
    less: 'Less',
    stylus: 'Stylus',
    json: 'JSON',
    yaml: 'YAML',
    toml: 'TOML',
    xml: 'XML',
    markdown: 'Markdown',
    latex: 'LaTeX',
    bibtex: 'BibTeX',
    sql: 'SQL',
    shell: 'Shell',
    bash: 'Bash',
    powershell: 'PowerShell',
    docker: 'Docker',
    dockerfile: 'Dockerfile',
    makefile: 'Makefile',
    cmake: 'CMake',
    gradle: 'Gradle',
    groovy: 'Groovy',
    properties: 'Properties',
    ini: 'INI',
    dotenv: 'Environment',
    gitignore: 'Git Ignore',
    editorconfig: 'EditorConfig',
    log: 'Log',
    text: 'Text',
    plaintext: 'Text',
    plain: 'Text',
  };

  return (
    displayNames[language.toLowerCase()] ||
    language.charAt(0).toUpperCase() + language.slice(1)
  );
}

// Check if language should show a badge
function shouldShowLanguageBadge(language: string): boolean {
  // Don't show badge for plaintext, empty, or unknown languages
  const hiddenLanguages = ['text', 'plaintext', 'plain', '', 'unknown'];
  return !hiddenLanguages.includes(language.toLowerCase());
}

// Language Badge Component (can be used independently)
export function LanguageBadge({ language, className }: LanguageBadgeProps) {
  // Handle special cases for plaintext and unknown languages
  if (!language || !shouldShowLanguageBadge(language)) {
    return null;
  }

  const displayName = getLanguageDisplayName(language);

  return (
    <span
      className={cn(
        'language-badge',
        // Remove Tailwind classes that conflict with CSS variables
        // These styles are now handled by CSS variables in mdx.css
        className,
      )}
      aria-label={`Programming language: ${displayName}`}
      title={`Programming language: ${displayName}`}
    >
      {displayName}
    </span>
  );
}
