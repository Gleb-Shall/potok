import { useState } from 'preact/hooks';
import { Brand } from './Brand.jsx';
import { Icon } from './Icon.jsx';
import { ThemeControl } from './ThemeControl.jsx';
import { ProductDemo } from './landing/ProductDemo.jsx';
import { EventStudio } from './landing/EventStudio.jsx';
import { RecordNetwork } from './landing/RecordNetwork.jsx';
import { Atmosphere } from './landing/Atmosphere.jsx';
import { FlipBoard } from './FlipBoard.jsx';
import { useMotionVisibility } from '../hooks/useMotionVisibility.js';
import { useLandingScenes } from '../hooks/useLandingScenes.js';

const QUESTIONS = [
  ['Можно попробовать без входа?','Да. Все примеры на этой странице работают без аккаунта. Полную демоверсию можно открыть отдельно. Личное расписание они не меняют.'],
  ['А с телефона это работает?','Да. Войди через Google на телефоне и компьютере — расписание будет общим. В примере дни можно листать, а карточку переносить кнопкой со стрелкой.'],
  ['Что будет с прошлыми занятиями?','Их можно оставить в истории и отметить проведёнными. Завершение повторов сохраняет прошлые встречи; полное удаление — отдельное действие.'],
  ['Можно сделать свои карточки?','Да. В шаблоне события настраиваются поля, цвет и видимость сведений. Постоянные данные людей, предметов и проектов хранятся в связанных записях.'],
];
export function Landing({navigate}) {
  const [paused,setPaused]=useState(false);
  const [background,setBackground]=useState('ribbons');
  const board=useMotionVisibility();
  const journey=useLandingScenes();
  const go=path=>event=>{if(event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();navigate(path);};
  return <div ref={journey} class={`potok-home home-experiment landing-journey ${paused?'ambient-paused':''}`}>
    <div class="journey-progress" aria-hidden="true"/>
    <a class="skip-link" href="#landing-main">К содержимому</a>
    <header class="home-nav"><Brand/><nav aria-label="О приложении"><a href="#calendar">Попробовать</a><a href="#editor">Карточки</a><a href="#connections">Как устроено</a></nav><div><ThemeControl/><a class="home-login" href="/app" onClick={go('/app')}>Войти <Icon name="right"/></a></div></header>
    <main id="landing-main"><section class="home-opening"><Atmosphere paused={paused} variant={background}/><div class="hero-core"><h1><span>Планы меняются.</span><span>Поток остаётся.</span></h1><p>Занятия, встречи и время для себя.<br/>Планируй день и меняй его на ходу.</p><div class="hero-actions"><a class="home-primary" href="/app" onClick={go('/app')}>Создать своё расписание <Icon name="arrow"/></a><a class="home-secondary" href="/demo" onClick={go('/demo')}>Открыть полную демоверсию</a></div></div>
      <div class="hero-bottom"><a class="hero-scroll-cue" href="#calendar"><span>Попробуй ниже</span><i><Icon name="down"/></i></a><div class="hero-background-controls" role="group" aria-label="Фон первого экрана">{[['ribbons','Ленты'],['contours','Контуры']].map(([id,label])=><button key={id} aria-pressed={background===id} onClick={()=>setBackground(id)}>{label}</button>)}<button onClick={()=>setPaused(!paused)} aria-pressed={paused} aria-label={paused?'Продолжить анимацию фона':'Остановить анимацию фона'}><Icon name={paused?'play':'pause'}/></button></div></div>
    </section>
    <section class="calendar-chapter" id="calendar"><div class="calendar-chapter-heading"><h2 data-reveal>Переноси встречи.</h2><p data-reveal data-reveal-delay="90">Перетащи встречу в другой день.<br/>Верни назад — перенос отменится.</p></div><div class="calendar-scroll-stage" data-scroll-stage="calendar"><ProductDemo/></div></section>
    <EventStudio/>
    <RecordNetwork/>
    <section class={`board-experiment motion-scene ${board.active?'scene-active':''}`} ref={board.ref}><div class="board-scenery" aria-hidden="true"><span/><span/><span/><i/></div><h2 data-reveal>Твой день.<br/>Твоими буквами.</h2><div class="board-scroll-stage" data-scroll-stage="board"><FlipBoard allowCustom/></div></section>
    <section class="experiment-faq" id="questions"><div><h2>Что ещё<br/>нужно знать</h2><span class="faq-orbit" aria-hidden="true"><Icon name="info"/><i/><i/></span></div><div>{QUESTIONS.map(([question,answer])=><details key={question}><summary>{question}<span><Icon name="plus"/></span></summary><p>{answer}</p></details>)}</div></section>
    <section class="experiment-close"><svg viewBox="0 0 1440 300" preserveAspectRatio="none" aria-hidden="true"><path d="M-100 250C200 -100 350 450 720 130S1200 -60 1540 200"/><path d="M-100 270C200 -80 350 470 720 150S1200 -40 1540 220"/></svg><h2>А дальше —<br/>твой день.</h2><div><a class="home-primary" href="/app" onClick={go('/app')}>Открыть Поток <Icon name="arrow"/></a><a class="home-secondary" href="/demo" onClick={go('/demo')}>Ещё немного поиграть в демо</a></div><p>Вход через Google. Твои планы доступны только тебе.</p></section>
    </main><footer class="home-footer"><Brand/><span>Календарь, записи и время.</span><a href="#landing-main">К началу <Icon name="arrow"/></a></footer>
  </div>;
}
