import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { highlight, Highlighted } from './highlight';

describe('highlight', () => {
  it('splits a fragment around its matches', () => {
    expect(highlight({ fragment: 'const [a, setA] = useState(0);', matches: [{ indices: [18, 26] }] })).toEqual([
      { text: 'const [a, setA] = ', match: false },
      { text: 'useState', match: true },
      { text: '(0);', match: false },
    ]);
  });

  // Seen on api.github.com: "✓" is 3 bytes, and the indices after it count all three.
  it('reads indices as UTF-8 byte offsets', () => {
    expect(highlight({ fragment: "log('✓') console", matches: [{ indices: [5, 8] }, { indices: [11, 18] }] })).toEqual([
      { text: "log('", match: false },
      { text: '✓', match: true },
      { text: "') ", match: false },
      { text: 'console', match: true },
    ]);
  });

  it('sorts matches and skips overlapping or out-of-range ones', () => {
    expect(highlight({ fragment: 'abcdef', matches: [{ indices: [4, 6] }, { indices: [0, 2] }, { indices: [1, 3] }, { indices: [5, 99] }] })).toEqual([
      { text: 'ab', match: true },
      { text: 'cd', match: false },
      { text: 'ef', match: true },
    ]);
  });

  it('renders code as text, never as markup', () => {
    const html = renderToStaticMarkup(<Highlighted match={{ fragment: '<img src=x onerror=alert(1)>', matches: [{ indices: [1, 4] }] }} />);
    expect(html).toBe('&lt;<mark class="rounded-sm bg-warning/25 text-fg">img</mark> src=x onerror=alert(1)&gt;');
  });
});
