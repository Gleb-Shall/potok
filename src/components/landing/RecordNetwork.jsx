import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../Icon.jsx';
import { initials } from '../UI.jsx';
import { useMotionVisibility } from '../../hooks/useMotionVisibility.js';

const PEOPLE = {
  student:{ label:'Ученик', name:'Анна', detail:'Математика · ЕГЭ', link:'Доска для занятий', events:['Производные','Практика к экзамену'], times:['Вт · 15:00','Пт · 17:00'] },
  project:{ label:'Проект', name:'Новый сайт', detail:'Дизайн и разработка', link:'Материалы проекта', events:['Обсуждение макета','Показ первой версии'], times:['Ср · 11:00','Пт · 16:00'] },
};
export function RecordNetwork() {
  const [kind,setKind] = useState('student');
  const [names,setNames] = useState({student:'Анна',project:'Новый сайт'});
  const [version,setVersion] = useState(0);
  const stage = useRef(null);
  const [drawing,setDrawing] = useState({width:1100,height:510,paths:[]});
  const motion = useMotionVisibility();
  const person = PEOPLE[kind];
  const name = names[kind] || person.name;
  useLayoutEffect(() => {
    const node = stage.current;
    const measure = () => {
      const bounds = node.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const source = node.querySelector('.network-source').getBoundingClientRect();
      const paths = [...node.querySelectorAll('.network-event')].map((target, index) => {
        const end = target.getBoundingClientRect(), right = end.left > source.left;
        if (end.top >= source.bottom) {
          const x1 = source.left + source.width * (index ? .75 : .25) - bounds.left;
          const y1 = source.bottom - bounds.top;
          const x2 = end.left + end.width / 2 - bounds.left, y2 = end.top - bounds.top;
          const mid = (y1 + y2) / 2;
          return `M${x1} ${y1}C${x1} ${mid} ${x2} ${mid} ${x2} ${y2}`;
        }
        const x1 = (right ? source.right : source.left) - bounds.left, y1 = source.top + source.height / 2 - bounds.top;
        const x2 = (right ? end.left : end.right) - bounds.left, y2 = end.top + end.height / 2 - bounds.top;
        const mid = (x1 + x2) / 2;
        return `M${x1} ${y1}C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`;
      });
      const next = {width:bounds.width,height:bounds.height,paths};
      setDrawing(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(node);
    node.querySelectorAll('.network-source,.network-event').forEach(child => observer?.observe(child));
    return () => observer?.disconnect();
  }, [kind,name,version]);
  return <section class={`record-experiment motion-scene ${motion.active?'scene-active':''}`} id="connections" ref={motion.ref}>
    <div class="experiment-heading"><h2>Одна запись. <br/>Несколько встреч.</h2><p>Измени имя или общую ссылку.<br/>Они обновятся в обеих карточках.</p></div>
    <div class="network-stage" data-ui ref={stage}><div class="network-grid" aria-hidden="true"/><svg class="network-wires" viewBox={`0 0 ${drawing.width} ${drawing.height}`} preserveAspectRatio="none" fill="none" aria-hidden="true">{drawing.paths.map((path,index) => <g key={index}><path d={path}/><path key={`${kind}-${name}-${version}`} class={`network-signal ${index?'network-signal-second':''}`} d={path} pathLength="1"/></g>)}</svg>
      <div class="network-source"><div class="network-switch" role="group" aria-label="Пример общей записи">{Object.entries(PEOPLE).map(([id,item]) => <button key={id} onClick={() => { setKind(id); setVersion(0); }} aria-pressed={kind===id}>{item.label}</button>)}</div><div class="network-identity"><span class="network-avatar">{initials(name)}</span><label><span>Имя в записи</span><input aria-label="Имя в общей записи" value={names[kind]} maxLength={40} onInput={input => setNames(previous => ({...previous,[kind]:input.currentTarget.value}))}/></label></div><p>{person.detail}</p><button class="network-link-change" onClick={() => setVersion(value => value+1)}><Icon name="external"/><span>{person.link}<small>Изменить ссылку</small></span><Icon name="repeat"/></button></div>
      <div class="network-targets">{person.events.map((title,index) => <article key={`${kind}-${index}`} class={`network-event network-event-${index}`}><div><span>{person.times[index]}</span><Icon name="calendar"/></div><h3>{title}</h3><p class="network-inherited"><span class="network-mini-avatar">{initials(name)}</span>{name}</p><a key={`${kind}-${version}`} class="network-inherited-link" href={`https://example.com/${kind}/materials-${version+1}`} target="_blank" rel="noopener noreferrer"><Icon name="external"/><span>{person.link}</span><span>v{version+1}</span></a></article>)}</div>
    </div>
  </section>;
}
