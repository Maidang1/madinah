import { describe, it, expect } from 'vitest';
import { cn } from './cn';

describe('cn utility', () => {
  it('should merge class names', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
  });

  it('should handle Tailwind conflicts correctly', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('should handle undefined and false values', () => {
    expect(cn('px-2', undefined, false, 'py-1')).toBe('px-2 py-1');
  });

  it('should merge complex Tailwind classes', () => {
    const result = cn(
      'inline-flex items-center justify-center',
      'rounded-md text-sm font-medium',
      'px-4 py-2',
    );
    expect(result).toContain('inline-flex');
    expect(result).toContain('rounded-md');
    expect(result).toContain('px-4');
  });

  it('should handle conditional classes with objects', () => {
    const isActive = true;
    expect(cn('base', isActive && 'active')).toContain('active');
    expect(cn('base', !isActive && 'inactive')).not.toContain('inactive');
  });
});
