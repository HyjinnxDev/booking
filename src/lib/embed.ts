// Embeddable booking widgets. `public/embed.js` drops an <iframe> (inline) or a
// button that opens one (popup), pointed at a normal public page with ?embed=1.
// Site chrome is hidden by isEmbed() in middleware — either the ?embed=1 param
// or the browser's Sec-Fetch-Dest:iframe on every in-frame navigation, so the
// whole flow (/, /s, /g, /book, /booked) stays chrome-less with no per-page code.
// ponytail: Safari <16.4 sends no Sec-Fetch-Dest — those users see the site
// header after the first in-frame navigation. Add link-level ?embed propagation
// only if that ~2% matters.

export type EmbedMode = 'inline' | 'popup';

export interface EmbedOpts {
  origin: string; // e.g. https://bookings.technicourt.com
  path: string; // /  |  /s/<id>  |  /g/<slug>
  mode?: EmbedMode;
  label?: string; // popup button text
  accent?: string; // popup button background (any CSS colour)
}

const esc = (v: string) => v.replace(/"/g, '&quot;');

/** The <script> tag a site owner pastes into their page. */
export function embedSnippet(o: EmbedOpts): string {
  let s = `<script src="${o.origin}/embed.js" data-path="${esc(o.path)}"`;
  if (o.mode === 'popup') {
    s += ' data-mode="popup"';
    if (o.label) s += ` data-label="${esc(o.label)}"`;
    if (o.accent) s += ` data-accent="${esc(o.accent)}"`;
  }
  return s + ' async><\/script>';
}

/** True when this request should render without site chrome. */
export function isEmbed(req: Request, url: URL): boolean {
  return url.searchParams.get('embed') === '1' || req.headers.get('sec-fetch-dest') === 'iframe';
}
