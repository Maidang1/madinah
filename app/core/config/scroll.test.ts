import { describe, it, expect } from 'vitest';
import { SCROLL_CONFIG, type ScrollConfig } from './scroll';

describe('Scroll config', () => {
  it('should export SCROLL_CONFIG object', () => {
    expect(SCROLL_CONFIG).toBeDefined();
  });

  it('should have SCROLL_TO_TOP_THRESHOLD', () => {
    expect(SCROLL_CONFIG.SCROLL_TO_TOP_THRESHOLD).toBe(500);
  });

  it('should have HEADING_HIGHLIGHT_OFFSET', () => {
    expect(SCROLL_CONFIG.HEADING_HIGHLIGHT_OFFSET).toBe(120);
  });

  it('should have HIGHLIGHT_BUFFER', () => {
    expect(SCROLL_CONFIG.HIGHLIGHT_BUFFER).toBe(50);
  });

  it('should have SCROLL_BEHAVIOR set to smooth', () => {
    expect(SCROLL_CONFIG.SCROLL_BEHAVIOR).toBe('smooth');
  });

  it('should have all expected properties', () => {
    const expectedKeys = [
      'SCROLL_TO_TOP_THRESHOLD',
      'HEADING_HIGHLIGHT_OFFSET',
      'HIGHLIGHT_BUFFER',
      'SCROLL_BEHAVIOR',
    ];
    expectedKeys.forEach((key) => {
      expect(key in SCROLL_CONFIG).toBe(true);
    });
  });

  it('all values should be non-negative', () => {
    expect(SCROLL_CONFIG.SCROLL_TO_TOP_THRESHOLD).toBeGreaterThanOrEqual(0);
    expect(SCROLL_CONFIG.HEADING_HIGHLIGHT_OFFSET).toBeGreaterThanOrEqual(0);
    expect(SCROLL_CONFIG.HIGHLIGHT_BUFFER).toBeGreaterThanOrEqual(0);
  });
});
