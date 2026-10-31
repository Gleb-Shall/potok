import { useState } from 'preact/hooks';
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
  const motion = useMotionVisibility();
  const person = PEOPLE[kind];
  const name = names[kind] || person.name;
  return <section class={`record-experiment motion-scene ${motion.active?'scene-active':''}`} id="connections" ref={motion.ref}>
    <div class="experiment-heading"><h2>Одна запись.<br/>Сколько угодно встреч.</h2><p>Измени имя или общую ссылку.<br/>Они обновятся в обеих карточках.</p></div>
    <div class="network-stage" data-ui><div class="network-grid" aria-hidden="true"/><svg class="network-wires" viewBox="0 0 1100 510" preserveAspectRatio="none" fill="none" aria-hidden="true"><path d="M390 255H510Q550 255 550 210V130Q550 110 590 110H700"/><path d="M390 255H510Q550 255 550 300V380Q550 400 590 400H700"/><path class="network-signal" d="M390 255H510Q550 255 550 210V130Q550 110 590 110H700"/><path class="network-signal network-signal-second" d="M390 255H510Q550 255 550 300V380Q550 400 590 400H700"/></svg>
      <div class="network-source"><div class="network-switch" role="group" aria-label="Пример общей записи">{Object.entries(PEOPLE).map(([id,item]) => <button key={id} onClick={() => { setKind(id); setVersion(0); }} aria-pressed={kind===id}>{item.label}</button>)}</div><div class="network-identity"><span class="network-avatar">{initials(name)}</span><label><span>Имя в записи</span><input aria-label="Имя в общей записи" value={names[kind]} maxLength={40} onInput={input => setNames(previous => ({...previous,[kind]:input.currentTarget.value}))}/></label></div><p>{person.detail}</p><button class="network-link-change" onClick={() => setVersion(value => value+1)}><Icon name="external"/><span>{person.link}<small>Изменить ссылку</small></span><Icon name="repeat"/></button></div>
      <div class="network-targets">{person.events.map((title,index) => <article key={`${kind}-${index}`} class={`network-event network-event-${index}`}><div><span>{person.times[index]}</span><Icon name="calendar"/></div><h3>{title}</h3><p class="network-inherited"><span class="network-mini-avatar">{initials(name)}</span>{name}</p><a key={`${kind}-${version}`} class="network-inherited-link" href={`https://example.com/${kind}/materials-${version+1}`} target="_blank" rel="noopener noreferrer"><Icon name="external"/><span>{person.link}</span><span>v{version+1}</span></a></article>)}</div>
    </div>
  </section>;
}
