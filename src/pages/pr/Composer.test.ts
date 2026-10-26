import { describe, expect, it } from 'vitest';
import { quoteOf } from './Composer';

describe('quoteOf', () => {
  it('quotes every line, blank ones too, and leaves a blank line for the reply', () => {
    expect(quoteOf('First line\n\nSecond line\n')).toBe('> First line\n> \n> Second line\n\n');
  });
});
