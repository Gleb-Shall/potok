import { useRef, useState } from 'preact/hooks';
import { Brand } from './Brand.jsx';
import { Icon } from './Icon.jsx';
import { ProductDemo, landingData } from './landing/ProductDemo.jsx';
import { EventStudio } from './landing/EventStudio.jsx';
import { RecordNetwork } from './landing/RecordNetwork.jsx';
import { LandingWorld } from './landing/world/LandingWorld.jsx';
import { saveEvent } from '../lib/events.js';

function RibbonPoster() {
  return <svg class="flow-poster" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="none" stroke="#ff602c" strokeWidth="100"><path d="M-180 250C260 -100 430 1030 920 650S1330 0 1620 210"/><path d="M-160 425C290 45 500 1160 1010 780S1480 120 1700 360"/><path d="M-150 70C240 -280 360 850 840 480S1250 -180 1520 30"/></g></svg>;
}

export function Landing({ navigate }) {
  const root=useRef(null);
  const [data,setData]=useState(landingData);
  const [selectedId,setSelectedId]=useState('lesson');
  const [selectionVersion,setSelectionVersion]=useState(0);
  const [paused,setPaused]=useState(false);
  const [preview,setPreview]=useState(null);
  const selected=data.events.find(event=>event.id===selectedId)||data.events[1];
  const go=path=>event=>{if(event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();navigate(path);};
  const anchor=id=>event=>{
    if(event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const target=root.current.querySelector(`#${id}`);
    const flight=target?.closest('[data-flight]');
    if(!target)return;
    event.preventDefault();
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sticky=flight&&getComputedStyle(flight.querySelector('.flow-sticky-stage')).position==='sticky';
    const destination=sticky&&root.current.dataset.world==='ready'&&!reduced?flight.offsetTop+Math.max(0,flight.offsetHeight-window.innerHeight):target.getBoundingClientRect().top+window.scrollY;
    history.replaceState({},'',`#${id}`);
    window.scrollTo({top:destination,behavior:'auto'});
    target.focus({preventScroll:true});
  };
  const apply=({event,types})=>setData(current=>saveEvent({...current,types},{values:event,original:current.events.find(item=>item.id===event.id),scope:'one',repeat:null}));
  return <div class="flow-landing" ref={root} data-world="pending">
    <LandingWorld root={root} paused={paused} event={preview||selected}/>
    <a class="skip-link" href="#calendar" onClick={anchor('calendar')}>Перейти к календарю</a>
    <header class="flow-nav"><Brand/><nav aria-label="О Потоке"><a href="#calendar" onClick={anchor('calendar')}>Календарь</a><a href="#editor" onClick={anchor('editor')}>Карточки</a></nav><a class="flow-nav-open" href="/app" onClick={go('/app')}>Открыть Поток <Icon name="right"/></a></header>
    <main>
      <section class="flow-hero" id="landing-main" aria-label="Поток — личный календарь">
        <RibbonPoster/>
        <div class="flow-hero-copy"><h1>ПОТОК</h1><p>Личный календарь событий<br/>и связанных записей.</p><a class="flow-primary" href="/app" onClick={go('/app')}>Открыть Поток <Icon name="arrow"/></a></div>
        <div class="flow-hero-bottom"><a href="#calendar" onClick={anchor('calendar')}>Планы можно двигать <Icon name="down"/></a><button aria-label={paused?'Продолжить движение':'Остановить движение'} aria-pressed={paused} onClick={()=>setPaused(value=>!value)}><Icon name={paused?'play':'pause'}/></button></div>
      </section>
      <section class="flow-flight flow-calendar-flight" data-flight="calendar" aria-label="Переход к календарю">
        <div class="flow-sticky-stage"><div class="flow-flight-caption" aria-hidden="true"><span>Всё на своих местах.</span><span>Пока ты не решишь иначе.</span></div>
          <div class="flow-calendar-panel flow-content" data-flight-panel id="calendar" tabIndex={-1}>
            <div class="flow-section-heading"><h2>Планы можно <br/>двигать.</h2><p>Перенеси карточку в другой день.<br/>Верни обратно — перенос отменится.</p></div>
            <ProductDemo data={data} onChange={setData} onMove={id=>{setSelectedId(id);setSelectionVersion(value=>value+1);setPreview(null);}}/>
            <a class="flow-next" href="#editor" onClick={anchor('editor')}>А теперь — своя карточка <Icon name="arrow"/></a>
          </div>
        </div>
      </section>
      <section class="flow-flight flow-editor-flight" data-flight="editor" aria-label="Карточка крупным планом">
        <div class="flow-sticky-stage"><div class="flow-flight-caption flow-card-caption" aria-hidden="true"><span>Внутри —</span><span>только нужное.</span></div>
          <div class="flow-editor-panel flow-content" data-flight-panel id="editor" tabIndex={-1}>
            <EventStudio key={`${selected.id}:${selectionVersion}`} data={data} selectedEvent={selected} onApply={apply} onPreview={setPreview}/>
          </div>
        </div>
      </section>
      <div class="flow-connections flow-content"><RecordNetwork/></div>
      <section class="flow-close flow-content"><div><h2>Освободи место<br/>для своих планов.</h2><a class="flow-primary" href="/app" onClick={go('/app')}>Открыть Поток <Icon name="arrow"/></a><a class="flow-demo-link" href="/demo" onClick={go('/demo')}>Открыть полную демоверсию <Icon name="right"/></a></div><div class="flow-close-object" aria-hidden="true"><span/><span/><span/></div></section>
    </main>
    <footer class="flow-footer flow-content"><span class="flow-footer-name">ПОТОК</span><div><span>События, записи и время.</span><a href="#landing-main">К началу <Icon name="down"/></a></div></footer>
  </div>;
}
