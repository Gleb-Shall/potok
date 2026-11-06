// jsdom has no OS media queries; use a light, no-preference environment.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = query => ({ media: query, matches: false, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return true; } });
}
