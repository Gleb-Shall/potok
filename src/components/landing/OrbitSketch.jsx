const ellipse = angle => Array.from({length:65}, (_, index) => {
  const t = index / 64 * Math.PI * 2, x = Math.cos(t) * 230, y = Math.sin(t) * 100;
  return `${index?'L':'M'}${300 + x * Math.cos(angle) - y * Math.sin(angle)} ${300 + x * Math.sin(angle) + y * Math.cos(angle)}`;
}).join(' ') + 'Z';

// A third calendar card sheds its content and becomes this orbital background.
export function OrbitSketch() {
  return <div class="studio-orbit" aria-hidden="true"><svg viewBox="0 0 600 600" fill="none">
    {[0,Math.PI/3,-Math.PI/3].map(angle => <path key={angle} d={ellipse(angle)}/>)}
    <path d="M70 300a230 230 0 1 0 460 0a230 230 0 1 0-460 0"/>
    <g class="orbit-runner"><circle cx="530" cy="300" r="9"/></g>
    <g class="orbit-runner orbit-runner-second"><circle cx="70" cy="300" r="5"/></g>
  </svg></div>;
}
