import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  scrollToElement,
  getScrollPosition,
  scrollToTop,
  throttle,
} from './scroll';

describe('Scroll utilities', () => {
  beforeEach(() => {
    // Reset document
    document.body.innerHTML = '';
  });

  describe('scrollToElement', () => {
    it('should return false when targetId is empty', () => {
      const result = scrollToElement('');
      expect(result).toBe(false);
    });

    it('should return false when element does not exist', () => {
      const result = scrollToElement('non-existent');
      expect(result).toBe(false);
    });

    it('should return true when element exists', () => {
      const element = document.createElement('div');
      element.id = 'test-element';
      document.body.appendChild(element);

      const result = scrollToElement('test-element');
      expect(result).toBe(true);
    });

    it('should handle custom container with scrollTo mock', () => {
      const container = document.createElement('div');
      container.className = 'custom-container';
      container.scrollTo = vi.fn();
      document.body.appendChild(container);

      const element = document.createElement('div');
      element.id = 'test-element';
      container.appendChild(element);

      const result = scrollToElement('test-element', { container });
      expect(result).toBe(true);
    });
  });

  describe('getScrollPosition', () => {
    it('should return window scroll position', () => {
      const position = getScrollPosition();
      expect(typeof position).toBe('number');
      expect(position).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 initially', () => {
      const position = getScrollPosition();
      expect(position).toBe(0);
    });
  });

  describe('scrollToTop', () => {
    it('should execute without errors', () => {
      expect(() => scrollToTop()).not.toThrow();
    });

    it('should accept options', () => {
      expect(() =>
        scrollToTop({ behavior: 'smooth' }),
      ).not.toThrow();
    });
  });

  describe('throttle', () => {
    it('should call function immediately on first invocation', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should debounce subsequent calls within delay', async () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled();
      throttled();
      throttled();

      expect(fn).toHaveBeenCalledTimes(1);

      await new Promise((resolve) => setTimeout(resolve, 110));
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should pass arguments to function', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled('arg1', 'arg2');
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should handle multiple throttled calls with proper timing', async () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 50);

      throttled('a');
      expect(fn).toHaveBeenCalledWith('a');

      throttled('b');
      throttled('c');

      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
