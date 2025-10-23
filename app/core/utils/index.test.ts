import { describe, it, expect } from 'vitest';
import { cn } from './cn';
import { scrollToElement, getScrollPosition, throttle } from './scroll';
import { assertResponse, jsonError } from './http';

describe('Utils index exports', () => {
  it('should export cn utility', () => {
    expect(cn).toBeDefined();
    expect(typeof cn).toBe('function');
  });

  it('should export scrollToElement', () => {
    expect(scrollToElement).toBeDefined();
    expect(typeof scrollToElement).toBe('function');
  });

  it('should export getScrollPosition', () => {
    expect(getScrollPosition).toBeDefined();
    expect(typeof getScrollPosition).toBe('function');
  });

  it('should export throttle', () => {
    expect(throttle).toBeDefined();
    expect(typeof throttle).toBe('function');
  });

  it('should export assertResponse', () => {
    expect(assertResponse).toBeDefined();
    expect(typeof assertResponse).toBe('function');
  });

  it('should export jsonError', () => {
    expect(jsonError).toBeDefined();
    expect(typeof jsonError).toBe('function');
  });
});
