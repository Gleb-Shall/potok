import { useEffect, useRef, useState } from 'preact/hooks';
import { useMotionVisibility } from '../hooks/useMotionVisibility.js';
import { Icon } from './Icon.jsx';

// Split-flap construction adapted from Aceternity UI's Text Flipping Board.
// Uses Preact + CSS, Cyrillic glyphs, fewer scramble steps and visibility gates.
const ALPHABET = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ0123456789';
const SCENES = [
  ['09:00  УЧЁБА', '15:00  ЗАНЯТИЕ', '18:00  ДЛЯ СЕБЯ'],
  ['ПЛАНЫ МЕНЯЮТСЯ', 'ПЕРЕНОСИ ЛЕГКО', 'ИСТОРИЯ РЯДОМ'],
  ['ТВОИ СОБЫТИЯ', 'ТВОИ ЗАПИСИ', 'ТВОЙ ПОТОК'],
];
const COLS = 18;
const rowText = text => text.padStart(Math.floor((COLS + text.length) / 2), ' ').padEnd(COLS, ' ').slice(0, COLS);
function FlapCell({ target, index, active }) {
  const current = useRef(target);
  const [frame, setFrame] = useState({ current: target, previous: ' ', tick: 0 });
  useEffect(() => {
    if (!active) { current.current = target; setFrame({ current: target, previous: target, tick: 0 }); return; }
    const timers = [];
    const steps = target === ' ' ? [target] : [ALPHABET[(index * 7 + 3) % ALPHABET.length], ALPHABET[(index * 13 + 9) % ALPHABET.length], target];
    steps.forEach((char, step) => timers.push(setTimeout(() => {
      const previous = current.current;
      current.current = char;
      setFrame(old => ({ current: char, previous, tick: old.tick + 1 }));
    }, index % COLS * 18 + Math.floor(index / COLS) * 80 + step * 140)));
    return () => timers.forEach(clearTimeout);
  }, [target, index, active]);
  const text = char => char === ' ' ? '\u00a0' : char;
  return <span class="flap-cell" aria-hidden="true">
    <span class="flap-half flap-top"><span>{text(frame.current)}</span></span>
    <span class="flap-half flap-bottom"><span>{text(frame.current)}</span></span>
    {active && frame.tick > 0 && <><span key={`t${frame.tick}`} class="flap-half flap-top flap-leaving"><span>{text(frame.previous)}</span></span><span key={`b${frame.tick}`} class="flap-half flap-bottom flap-arriving"><span>{text(frame.current)}</span></span></>}
    <i class="flap-seam"/>
  </span>;
}
export function FlipBoard() {
  const [scene, setScene] = useState(0);
  const [paused, setPaused] = useState(false);
  const motion = useMotionVisibility();
  const active = motion.active && !paused;
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setScene(value => (value + 1) % SCENES.length), 6500);
    return () => clearInterval(timer);
  }, [active]);
  return <section class="lp-board-section" ref={motion.ref} aria-label="Табло планов">
    <div class="lp-board-copy"><span class="lp-eyebrow">МЕСТО ДЛЯ ВСЕХ ПЛАНОВ</span><h2>Каждый день —<br/>новая история.</h2><p>Учёба, занятия и время для себя. Собери свой день, а если планы поменяются — дай им новое время.</p></div>
    <div class="flip-board-wrap"><div class="flip-board" role="img" aria-label={SCENES[scene].join('. ')}><div class="flip-board-grid">{SCENES[scene].flatMap(row => [...rowText(row)]).map((target, index) => <FlapCell key={index} target={target} index={index} active={active}/>)}</div><div class="flip-board-brand"><span>ПОТОК / ТВОЙ ДЕНЬ</span><i/><span>ЕСТЬ МЕСТО ДЛЯ ГЛАВНОГО</span></div></div>
      <div class="flip-board-controls"><div role="group" aria-label="Пример на табло">{['Твой день', 'Перемены', 'Свой ритм'].map((label, index) => <button type="button" key={label} aria-pressed={scene === index} onClick={() => setScene(index)}>{label}</button>)}</div><button type="button" class="board-pause" aria-label={paused ? 'Продолжить анимацию табло' : 'Приостановить анимацию табло'} aria-pressed={paused} onClick={() => setPaused(!paused)}><Icon name={paused ? 'play' : 'pause'}/></button></div>
    </div>
  </section>;
}
