import { useId, useRef, useState } from 'preact/hooks';
import { GuideExample } from './GuideExamples.jsx';
import { chapters } from './guide-content.js';
import { Icon } from './Icon.jsx';
import { Select } from './UI.jsx';
import '../guide.css';

function GuideStep({text,phrase,exampleOpen,panelId,onExample}) {
  const position = phrase ? text.indexOf(phrase) : -1;
  if (position<0) return <li>{text}</li>;
  return <li>{text.slice(0,position)}
    <button type="button" class="guide-keyword" aria-expanded={exampleOpen} aria-controls={panelId} onClick={onExample}>
      {phrase}<Icon name={exampleOpen ? 'down' : 'play'}/>
    </button>{text.slice(position+phrase.length)}
  </li>;
}

export function GuideView({initialChapter = 0}) {
  const [[chapterIndex,topicIndex],setPage] = useState([initialChapter,0]);
  const [exampleOpen,setExampleOpen] = useState(false);
  const content = useRef(null);
  const panelId = useId();
  const chapter = chapters[chapterIndex];
  const topic = chapter.topics[topicIndex];
  const [keyword,example] = topic.example || [];
  const phrase = keyword && `«${keyword}»`;
  const open = (chapterNumber,topicNumber = 0) => {
    setPage([chapterNumber,topicNumber]);
    setExampleOpen(false);
    content.current?.scrollIntoView?.({block:'nearest'});
    content.current?.focus({preventScroll:true});
  };
  const adjacent = offset => {
    const nextTopic = topicIndex+offset;
    if (chapter.topics[nextTopic]) return [chapterIndex,nextTopic];
    const nextChapter = chapters[chapterIndex+offset];
    if (nextChapter) return [chapterIndex+offset,offset<0 ? nextChapter.topics.length-1 : 0];
  };
  return <section class="user-guide" aria-label="Руководство пользователя">
    <div class="guide-masthead"><Icon name="book"/><span>Руководство Потока</span></div>
    <div class="user-guide-layout">
      <nav class="guide-contents" aria-label="Оглавление руководства">
        <ul>{chapters.map((item,i)=><li key={item.title}>
          <button class="guide-chapter-button" type="button" aria-current={i===chapterIndex?'true':undefined} onClick={()=>open(i)}>{item.title}<Icon name={i===chapterIndex ? 'down' : 'right'}/></button>
          {i===chapterIndex && <ul class="guide-chapter-topics">{item.topics.map(({title},j)=><li key={title}>
            <button type="button" aria-current={j===topicIndex?'page':undefined} onClick={()=>open(i,j)}>{title}</button>
          </li>)}</ul>}
        </li>)}</ul>
      </nav>
      <nav class="guide-mobile-contents" aria-label="Оглавление на телефоне">
        <Select label="Раздел" value={String(chapterIndex)} onChange={value=>open(Number(value))}>
          {chapters.map(({title},i)=><option key={title} value={String(i)}>{title}</option>)}
        </Select>
        <Select label="Тема" aria-label="Тема" value={String(topicIndex)} onChange={value=>open(chapterIndex,Number(value))}>
          {chapter.topics.map(({title},i)=><option key={title} value={String(i)}>{title}</option>)}
        </Select>
      </nav>
      <article ref={content} tabIndex={-1} class="user-guide-article">
        <header class="guide-article-heading"><p>{chapter.title}</p><h2>{topic.title}</h2><p class="user-guide-intro">{topic.summary}</p></header>
        <ol class="guide-steps">{topic.steps.map(text=><GuideStep key={text} text={text} phrase={phrase} exampleOpen={exampleOpen}
          panelId={panelId} onExample={()=>setExampleOpen(value=>!value)}/>)}</ol>
        {example && <div id={panelId} hidden={!exampleOpen}>{exampleOpen && <GuideExample name={example}/>}</div>}
        <footer class="guide-chapter-navigation">
          {[-1,1].map(offset=>{
            const target = adjacent(offset);
            return target && <button key={offset} type="button" data-next={offset>0?'true':undefined} onClick={()=>open(...target)}>
              {offset<0 && <Icon name="left"/>}
              <span><small>{offset<0 ? 'Назад' : 'Далее'}</small>{chapters[target[0]].topics[target[1]].title}</span>
              {offset>0 && <Icon name="right"/>}
            </button>;
          })}
        </footer>
      </article>
    </div>
  </section>;
}
