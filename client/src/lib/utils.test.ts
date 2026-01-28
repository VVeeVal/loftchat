import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('merges class names and de-duplicates tailwind utilities', () => {
    expect(cn('p-2', 'p-4', 'text-sm')).toBe('p-4 text-sm');
  });

  it('handles falsy values', () => {
    expect(cn('flex', false && 'hidden', null, undefined, 'items-center')).toBe('flex items-center');
  });
});
