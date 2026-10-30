import { useState } from 'preact/hooks';
import { ThemeControl } from './ThemeControl.jsx';
import { FlipBoard } from './FlipBoard.jsx';
import { useSpotlight } from '../hooks/useSpotlight.js';
import { Brand } from './Brand.jsx';
import { Icon } from './Icon.jsx';

const examples = {
  lesson: { name: 'Занятие с учеником', type: 'Урок', color: 'violet', icon: '✎', details: ['Тема · Производные', 'Телемост ↗', 'Доска ↗'] },
  course: { name: 'Линейная алгебра', type: 'Пара', color: 'blue', icon: '▤', details: ['Преподаватель · Ирина', 'Аудитория · 204', 'Формат · Семинар'] },
  personal: { name: 'Время для себя', type: 'Личное', color: 'green', icon: '◇', details: ['Место · Парк', 'Продолжительность · 1 час', 'Заметка · Оставить телефон дома'] }
};
function PreviewCard({ title, time, type, color = 'violet', children, className = '' }) {
  return <div class={`lp-preview-card color-${color} ${className}`}><div class="lp-card-time">{time}<span>⠿</span></div><strong>{title}</strong><small>{type}</small>{children}</div>;
}
function CalendarPreview() {
  return <div class="lp-preview-wrap"><div class="lp-orbit lp-orbit-one"/><div class="lp-orbit lp-orbit-two"/>
    <figure class="lp-calendar" aria-label="Пример: занятия, пары и личные события в одном расписании">
      <div class="lp-window-bar"><span class="lp-window-dots"><i/><i/><i/></span><span>МОЁ ПРОСТРАНСТВО</span><Icon name="calendar"/></div>
      <div class="lp-cal-heading"><div><span>Всё под рукой</span><strong>Твоя неделя</strong></div><span class="lp-week-badge">Неделя <Icon name="down"/></span></div>
      <div class="lp-preview-days"><div class="lp-preview-day"><header><span>ПОНЕДЕЛЬНИК</span><b>26</b></header><PreviewCard title="Линейная алгебра" time="09:00–10:30" type="▤ Пара" color="blue"/><div class="lp-preview-ghost">14:00 · Урок<small>Перенесено на вторник →</small></div><PreviewCard title="Прогулка в парке" time="18:00–19:00" type="◇ Личное" color="green"/></div>
      <div class="lp-preview-day is-current"><header><span>ВТОРНИК <i/></span><b>27</b></header><PreviewCard title="Занятие с учеником" time="15:00–16:00" type="✎ Урок"><div class="lp-preview-links"><span>Телемост ↗</span><span>Доска ↗</span></div></PreviewCard><div class="lp-free-time"><span>✧</span>Время для твоих планов</div></div>
      <div class="lp-preview-day"><header><span>СРЕДА</span><b>28</b></header><PreviewCard title="Встреча с друзьями" time="12:30–14:00" type="◇ Личное" color="peach"/><PreviewCard title="Практика" time="16:00–17:30" type="▤ Пара" color="blue"/></div></div>
      <figcaption><span class="lp-online-dot"/>Пример расписания · события, записи и время</figcaption>
    </figure>
    <div class="lp-floating-note"><span><Icon name="check"/></span><div><strong>Планы поменялись? Всё в порядке.</strong><small>Один перенос. Остальные недели на месте.</small></div></div>
  </div>;
}

export function Landing({ navigate }) {
  const spotlight = useSpotlight();
  const [example, setExample] = useState('lesson');
  const selected = examples[example];
  const go = path => event => { if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); navigate(path); };
  return <div class="landing" id="top"><a class="skip-link" href="#landing-main">К содержимому</a>
    <header class="lp-header"><Brand/><nav aria-label="О приложении"><a href="#possibilities">Возможности</a><a href="#how-it-works">Как это работает</a><a href="#questions">Вопросы</a></nav><div class="lp-header-actions"><ThemeControl/><a class="lp-login" href="/app" onClick={go('/app')}>Войти <Icon name="right"/></a></div></header>
    <main id="landing-main"><section class="lp-hero"><div class="lp-hero-copy"><h1>Твоё время.<br/>Всё на своих<br/><em>местах.</em></h1><p>Занятия, пары и личные встречи — в одном календаре. Нужные сведения рядом, а перемены в планах больше не превращаются в путаницу.</p><div class="lp-hero-actions"><a class="lp-cta" href="/app" onClick={go('/app')}>Начать с Потоком <Icon name="arrow"/></a><a class="lp-demo-link" href="/demo" onClick={go('/demo')}>Попробовать демо <Icon name="right"/></a></div><span class="lp-reassurance"><Icon name="check"/>Google-аккаунт · Компьютер и телефон</span></div><CalendarPreview/></section>
      <FlipBoard/><section class="lp-use-cases" aria-label="Для разных сторон твоей жизни"><span>ОДНО МЕСТО ДЛЯ</span><div><span><Icon name="users"/>Занятий</span><span><Icon name="book"/>Учёбы</span><span><Icon name="sun"/>Личных планов</span><span><Icon name="spark"/>Твоих идей</span></div></section>
      <section class="lp-features" id="possibilities"><div class="lp-section-heading"><span class="lp-eyebrow">МЕНЬШЕ ДЕРЖАТЬ В ГОЛОВЕ</span><h2>Весь контекст.<br/>В одном потоке.</h2><p>Не только когда и во сколько.<br/>Ещё с кем, о чём и где всё нужное.</p></div>
        <div class="lp-bento"><article class="lp-feature lp-feature-move lp-spotlight" onPointerMove={spotlight}><span class="lp-feature-icon"><Icon name="arrows"/></span><h3>Планы могут меняться.</h3><p>Перенеси одну встречу, выбери новое время. Регулярное расписание останется прежним, а история сохранится.</p><div class="lp-transfer-demo"><div><span>БЫЛО</span><strong>Пн, 14:00</strong></div><span class="lp-transfer-arrow"><Icon name="arrow"/></span><div><span>СТАЛО</span><strong>Вт, 15:00</strong><small>Только это занятие</small></div></div></article>
          <article class="lp-feature lp-feature-record lp-spotlight" onPointerMove={spotlight}><span class="lp-feature-icon"><Icon name="users"/></span><h3>Знакомые люди.<br/>Все детали рядом.</h3><p>Одна запись для ученика, предмета или проекта. Контакты, преподаватель, адрес и ссылки доступны в связанных событиях.</p><div class="lp-person-preview"><span class="lp-person-avatar">АК</span><div><strong>Алексей</strong><small>Ученик · Математика</small></div><span class="lp-record-tag">Запись</span><div class="lp-person-links"><span>↗ Интерактивная доска</span><span>↗ Ссылка на встречу</span></div></div></article>
          <article class="lp-feature lp-feature-templates lp-spotlight" onPointerMove={spotlight}><div><span class="lp-feature-icon"><Icon name="sliders"/></span><h3>Карточки под твою жизнь.</h3><p>У пары — аудитория и преподаватель. У занятия — тема и ссылка на доску. Выбирай поля и решай, что видно прямо в календаре.</p><div class="lp-example-tabs" aria-label="Пример карточки">{[['lesson','Занятие'],['course','Пара'],['personal','Личное']].map(([id,label])=><button key={id} aria-pressed={example===id} onClick={()=>setExample(id)}>{label}</button>)}</div></div><div class="lp-template-example" aria-live="polite"><PreviewCard key={example} title={selected.name} time="15:00–16:00" type={`${selected.icon} ${selected.type}`} color={selected.color}><div class="lp-example-fields">{selected.details.map(text=><span key={text}>{text}</span>)}</div></PreviewCard></div></article>
        </div>
      </section>
      <section class="lp-how" id="how-it-works"><div class="lp-section-heading"><span class="lp-eyebrow">НАЧАТЬ ПРОЩЕ, ЧЕМ КАЖЕТСЯ</span><h2>От мысли —<br/>к понятному плану.</h2></div><div class="lp-steps">{[['01','Добавь нужные записи','Людей, предметы и другие сведения, которые пригодятся не один раз.'],['02','Собери своё расписание','Создай события, выбери время и настрой повторения.'],['03','Живи в своём ритме','Открывай ссылки из карточек, переноси встречи и возвращайся к истории.']].map(([n,title,text])=><article key={n}><span>{n}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
      <section class="lp-faq" id="questions"><div><span class="lp-eyebrow">ЕЩЁ ПАРА ДЕТАЛЕЙ</span><h2>Хорошие<br/>вопросы.</h2></div><div class="lp-faq-list"><details><summary>Можно посмотреть без регистрации?<span>+</span></summary><p>Да. В демо есть вымышленное расписание: можно попробовать карточки, записи, шаблоны и переносы. Демо хранится отдельно от твоего аккаунта.</p><a href="/demo" onClick={go('/demo')}>Открыть демо →</a></details><details><summary>Будут ли планы доступны с телефона?<span>+</span></summary><p>Личное расписание сохраняется в Google-аккаунте. Войди в тот же аккаунт на другом устройстве, чтобы открыть свои события и записи.</p></details><details><summary>Что произойдёт, если занятия закончатся?<span>+</span></summary><p>Можно завершить будущие повторы, сохранив прошедшие события. Отметки о проведении доступны в истории по месяцам.</p></details><details><summary>Это только для репетиторов?<span>+</span></summary><p>Для занятий, университетских пар, встреч и личных событий. В шаблоне события можно выбрать свои поля и настроить отображение карточки.</p></details></div></section>
      <section class="lp-closing"><div class="lp-closing-spark">✳</div><span class="lp-eyebrow">ОСТАВЬ МЕСТО ДЛЯ ГЛАВНОГО</span><h2>Планы здесь.<br/>Ты — в своём ритме.</h2><a class="lp-cta" href="/app" onClick={go('/app')}>Открыть Поток <Icon name="arrow"/></a><p>Или <a href="/demo" onClick={go('/demo')}>сначала заглянуть в демо</a></p></section>
    </main><footer class="lp-footer"><Brand/><span>События, записи и время.</span><a href="#top">Наверх ↑</a></footer>
  </div>;
}
