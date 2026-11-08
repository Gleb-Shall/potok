import { useId, useRef, useState } from 'preact/hooks';
import { Icon } from './Icon.jsx';
import { GuideExample } from './GuideExamples.jsx';
import '../guide.css';

const chapters = [
  {title:'Расписание',intro:'Создавай события, меняй их время и выбирай удобный вид календаря.',tasks:[
    ['Создать событие','Нажми «Добавить событие» или дважды щёлкни по свободному времени в часовой сетке. Выбери шаблон, укажи время и сохрани.'],
    ['Открыть и изменить карточку','На компьютере один клик выделяет карточку, а двойной открывает детали. Потяни за верхнюю или нижнюю границу выделенной карточки, чтобы изменить длительность. На телефоне детали открываются касанием.'],
    ['Перенести одну встречу','Перетащи карточку на другое время в сетке. Чтобы выбрать дату из месяца, удерживай карточку или нажми «Перенести» в деталях. Остальные встречи серии сохраняют своё время.','Перенести','move'],
    ['Добавить место','В редакторе события нажми кнопку места и выбери адрес на карте. Значок места на карточке открывает карту этого события.'],
  ]},
  {title:'Записи',intro:'Храни общие сведения об ученике, проекте или хобби в одном месте.',tasks:[
    ['Создать запись','Открой «Записи» и нажми «Добавить запись». Выбери категорию или введи своё название категории. Добавь контакты, ссылки и другие постоянные сведения.'],
    ['Повторно использовать поле','Если поле уже есть в другой записи той же категории, выбери «Добавить поле из категории». Заполни своё значение. Шаблон события сможет использовать это поле в обеих записях.'],
    ['Связать событие с записью','В редакторе события выбери запись в поле «Связанная запись». Если шаблон берёт контакт из записи, он появится в карточке занятия.','Связанная запись','linked'],
  ]},
  {title:'Шаблоны',intro:'Настрой поля события и то, как они выглядят в календаре.',tasks:[
    ['Добавить свои поля','Открой «Шаблоны» и выбери «Поля шаблона». Укажи категорию связанной записи и добавь поля нужного формата, например число, ссылку, список или флажок.'],
    ['Подставить значение из записи','У поля события выбери «Источник значения». «Брать из записи» показывает актуальное значение, а «Подставить при создании» сохраняет копию в событии. При необходимости введи своё значение для одной встречи.','Источник значения','source'],
    ['Настроить вид карточки','Открой «Оформление карточки», выбери вид и укажи, какие поля в нём показывать. Порядок меняется перетаскиванием за ручку.'],
  ]},
  {title:'Журнал',intro:'Здесь собраны встречи, которые ждут действия, и завершённые события.',tasks:[
    ['Подтвердить встречу','Когда время закончится, событие появится в «Ждут подтверждения». Выбери «Проведён» или «Отменён». Действие относится к этой встрече.','Ждут подтверждения','confirm'],
    ['Отложить выбор даты','В меню события выбери «Отложить перенос». В журнале оно появится в «Ждут новой даты». Там можно назначить дату, поставить напоминание или вернуть встречу на исходное время.','Отложить перенос','defer'],
    ['Посмотреть историю','В архиве переключайся между итогами событий и историей переносов. В мини-окне встречи история переносов раскрывается отдельной строкой.'],
  ]},
  {title:'Статистика',intro:'Собери свой отчёт по проведённым событиям, времени или значениям из шаблонов.',tasks:[
    ['Выбрать период и события','Укажи месяц или даты начала и конца. Выбери запись, тип события или оба фильтра. Число рядом с вариантом показывает, сколько событий подходит с учётом другого фильтра.'],
    ['Уточнить выборку','Раскрой «Уточнить выборку» и добавь условия. Если в шаблоне урока есть поле «Формат», можно оставить только занятия с выбранным форматом. Несколько условий применяются вместе.'],
    ['Посчитать сумму или среднее','В разделе «Свой отчёт» выбери в поле «Что считать» нужное значение, например «Урок → Стоимость, ₽». Затем в поле «Как считать» выбери «Сумма» или «Среднее». Нули учитываются, а пустые значения показаны отдельным счётчиком.','Как считать','report'],
    ['Разбить результат и посмотреть события','В поле «Разбить по» выбери запись, тип, день, место или поле события. Нажми на группу, чтобы открыть её список. Во вкладке «Карта» события с одинаковыми координатами собираются в одну метку.'],
  ]},
  {title:'Внешний вид',intro:'Выбери тему и качество анимаций для этого устройства.',tasks:[
    ['Сменить тему','Открой «Внешний вид» и выбери тему оформления по миниатюре. Новая тема применяется сразу.'],
    ['Изменить качество анимаций','В разделе «Качество анимаций» выбери подходящий режим. Экономный режим отключает декоративные эффекты. На компьютере и телефоне настройки могут отличаться.'],
  ]},
  {title:'Настройки и данные',intro:'Управляй хранением расписания, резервными копиями и синхронизацией.',tasks:[
    ['Сохранить резервную копию','В «Настройках» нажми «Скачать резервную копию». Чтобы загрузить расписание из сохранённого файла, выбери «Восстановить из копии».'],
    ['Обновить расписание на устройстве','Если подключено облако, нажми на значок синхронизации рядом со временем последнего обновления. Открой то же облачное расписание на другом устройстве, чтобы увидеть сохранённые изменения.'],
  ]},
];

const chapterIcons = ['calendar','users','sliders','history','chart','sun','settings'];

function GuideTask({task,id,number,expanded,onToggle}) {
  const [title,body,keyword,example] = task;
  const panelId = useId();
  const phrase = keyword && `«${keyword}»`;
  const position = phrase ? body.indexOf(phrase) : -1;
  return <section class="guide-task" id={id} tabIndex={-1}>
    <span class="guide-task-number" aria-hidden="true">{number}</span>
    <div><h4>{title}</h4>
    <p>{position<0 ? body : <>
      {body.slice(0,position)}
      <button type="button" class="guide-keyword" aria-expanded={expanded} aria-controls={panelId} onClick={onToggle}>{phrase}<Icon name={expanded ? 'down' : 'play'}/></button>
      {body.slice(position+phrase.length)}
    </>}</p>
    {example && <div id={panelId} hidden={!expanded}>{expanded && <GuideExample name={example}/>}</div>}</div>
  </section>;
}

export function GuideView({initialChapter = 0}) {
  const [index,setIndex] = useState(initialChapter);
  const [activeExample,setActiveExample] = useState(null);
  const content = useRef(null);
  const chapter = chapters[index];
  const open = next => {
    setIndex(next);
    setActiveExample(null);
    content.current?.scrollIntoView?.({block:'start'});
    content.current?.focus?.({preventScroll:true});
  };
  const articleId = useId();
  const taskId = i => `${articleId}-task-${i}`;
  const goToTask = i => {
    const target = document.getElementById(taskId(i));
    target?.scrollIntoView?.({block:'start'});
    target?.focus({preventScroll:true});
  };
  return <section class="user-guide" aria-label="Руководство пользователя">
    <div class="user-guide-layout">
      <nav class="guide-contents" aria-label="Оглавление руководства">
        <p class="guide-masthead"><Icon name="book"/><span>Руководство<span class="guide-product">Поток</span></span></p>
        <ul>
          {chapters.map((item,i)=><li key={item.title}>
            <button class="guide-chapter-button" type="button" aria-current={i===index?'page':undefined} onClick={()=>open(i)}>
              <Icon name={chapterIcons[i]}/>{item.title}
            </button>
            {i===index && <ul class="guide-chapter-topics">
              {item.tasks.map(([title],i)=><li key={title}><button type="button" onClick={()=>goToTask(i)}>{title}</button></li>)}
            </ul>}
          </li>)}
        </ul>
      </nav>
      <article ref={content} tabIndex={-1} class="user-guide-article">
        <header class="guide-article-heading">
          <h2>Руководство пользователя</h2>
          <h3>{chapter.title}</h3><p class="user-guide-intro">{chapter.intro}</p>
        </header>
        {chapter.tasks.map((task,i)=><GuideTask key={task[0]} task={task} id={taskId(i)} number={String(i+1).padStart(2,'0')} expanded={activeExample===task[0]}
          onToggle={()=>setActiveExample(activeExample===task[0] ? null : task[0])}/>)}
        <footer class="guide-chapter-navigation">
          {index>0 && <button type="button" onClick={()=>open(index-1)}><Icon name="left"/><span><small>Предыдущая глава</small>{chapters[index-1].title}</span></button>}
          {index<chapters.length-1 && <button type="button" data-next onClick={()=>open(index+1)}><span><small>Следующая глава</small>{chapters[index+1].title}</span><Icon name="right"/></button>}
        </footer>
      </article>
    </div>
  </section>;
}
