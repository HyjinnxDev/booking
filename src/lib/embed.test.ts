import { describe, it, expect } from 'vitest';
import { embedSnippet, isEmbed } from './embed';

const O = 'https://bookings.technicourt.com';

describe('embedSnippet', () => {
  it('inline: just src + path, no popup attrs', () => {
    expect(embedSnippet({ origin: O, path: '/s/abc', mode: 'inline', label: 'x', accent: '#000' })).toBe(
      `<script src="${O}/embed.js" data-path="/s/abc" async><\/script>`,
    );
  });
  it('popup: carries label + accent, escapes quotes', () => {
    expect(embedSnippet({ origin: O, path: '/', mode: 'popup', label: 'Say "hi"', accent: '#d8ed57' })).toBe(
      `<script src="${O}/embed.js" data-path="/" data-mode="popup" data-label="Say &quot;hi&quot;" data-accent="#d8ed57" async><\/script>`,
    );
  });
});

describe('isEmbed', () => {
  const url = (s: string) => new URL(s, O);
  const req = (h: Record<string, string> = {}) => new Request(O, { headers: h });

  it('true on ?embed=1', () => expect(isEmbed(req(), url('/s/x?embed=1'))).toBe(true));
  it('true on Sec-Fetch-Dest: iframe', () =>
    expect(isEmbed(req({ 'sec-fetch-dest': 'iframe' }), url('/s/x'))).toBe(true));
  it('false for a normal top-level request', () =>
    expect(isEmbed(req({ 'sec-fetch-dest': 'document' }), url('/s/x'))).toBe(false));
});
