import { vi } from 'vitest';
import React from 'react';
import '@testing-library/jest-dom';

// Set React act environment for testing-library
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Polyfill React.act for React 19
// React 19 moved act to the JSX runtime, but react-dom test-utils still expects it
if (typeof React.act !== 'function') {
  // Create a simple act wrapper that handles async operations
  const act = (callback: () => void | Promise<void>): Promise<void> | void => {
    const result = callback();
    if (result && typeof (result as Promise<void>).then === 'function') {
      return result as Promise<void>;
    }
    return result;
  };
  
  // @ts-ignore - Polyfill act on React
  React.act = act;
}

// Mock clipboard API for tests
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
  },
});

// Mock window.isSecureContext
Object.defineProperty(window, 'isSecureContext', {
  writable: true,
  value: true,
});

// Mock document.execCommand for fallback tests
document.execCommand = vi.fn(() => true);