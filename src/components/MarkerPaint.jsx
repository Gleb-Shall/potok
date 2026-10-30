// One continuous route: across, diagonally back, then across again.
// A normalized path length lets CSS draw it without timers or layout reads.
const ROUTE = 'M3 8 L197 10 L4 33 L196 35 L3 58 L197 60 L4 83 L196 85 L3 109 L197 111';

export function MarkerPaint() {
  return <svg class="marker-paint" viewBox="0 0 200 120" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <path class="marker-stroke" d={ROUTE} pathLength="1"/>
    <path class="marker-grain" d={ROUTE} pathLength="1" transform="translate(0 -4)"/>
    <path class="marker-grain fine" d={ROUTE} pathLength="1" transform="translate(0 5)"/>
  </svg>;
}
