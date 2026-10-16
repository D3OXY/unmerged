import { describe, expect, it } from 'vitest';
import { pickerOptions } from './PrSidebar';

const ada = { value: 'U1', label: 'ada' };
const bob = { value: 'U2', label: 'bob' };
const cy = { value: 'U3', label: 'cy' };

describe('pickerOptions', () => {
  it('lists the selection first, then candidates, each once', () => {
    expect(pickerOptions([bob], [ada, bob, cy], '', [])).toEqual([bob, ada, cy]);
  });

  it('only lists matches while searching, selected or not', () => {
    expect(pickerOptions([bob], [cy], 'c', [])).toEqual([cy]);
  });

  it('leaves out hidden labels, even when selected', () => {
    expect(pickerOptions([ada], [ada, bob, cy], '', ['ada', 'cy', undefined])).toEqual([bob]);
  });
});
