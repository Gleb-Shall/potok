import { ActionMenu } from './ActionMenu.jsx';
import { useEffect, useMemo, useRef } from 'preact/hooks';
import { lazy, Suspense } from 'preact/compat';
import { cardComposition, readCardStyle } from '../lib/card-style.js';
import { eventType, isEventMoved, getRecord, eventTitle, eventColor, fieldDisplay } from '../lib/events.js';
import { minutesToTime } from '../lib/domain.js';
import { LinkedValue, ExternalLink, LinkedText } from './LinkedValue.jsx';
import { linkHref, eventLinks } from '../lib/links.js';
import { eventAppearance } from '../lib/state-appearance.js';
import { dateLabel } from './UI.jsx';
import { MarkerPaint } from './MarkerPaint.jsx';
import { Icon } from './Icon.jsx';
import { cardBackground } from '../lib/card-backgrounds.js';

const SelectedCardMotion = lazy(() => import('./SelectedCardMotion.jsx'));
const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('ru') : null;
const animatedTitle = title => title.split(/(\s+)/u).map((word,index) =>
  /^\s+$/u.test(word) ? word : <span class="card-motion-word" key={index}>{(segmenter ? Array.from(segmenter.segment(word),part=>part.segment) : Array.from(word)).map((letter,i)=><span key={i} data-motion-letter>{letter}</span>)}</span>);

export function EventCard({ event, data, onOpen, onSelect, selected = false, motionPaused = false, onDragStart, onDragEnd, preview = false, timeline = false, onDelete, onMove, onDefer, expanded = preview, onToggle, now = Date.now(), stateEffects, isDragging = false, canRestore = false, onRestoreDrop }) {
  const nativePreview=useRef(null), cardRef=useRef(null);
  const releasePreview=()=>{
    if(!nativePreview.current) return;
    cancelAnimationFrame(nativePreview.current.frame);
    nativePreview.current.node.remove();nativePreview.current=null;
  };
  useEffect(()=>releasePreview,[]);
  const type = eventType(data, event);
  const background = cardBackground(data, type);
  const appearance = eventAppearance(event, { now, preview, effects: stateEffects });
  const record = getRecord(data, event);
  const style = useMemo(()=>readCardStyle(type),[type]);
  if (event.ghost) return <button class={`ghost-card ${canRestore ? 'is-return-target' : ''}`} onDragOver={input => { if (canRestore) { input.preventDefault(); input.stopPropagation(); input.dataTransfer.dropEffect = 'move'; } }} onDrop={input => { if (canRestore) { input.preventDefault(); input.stopPropagation(); onRestoreDrop?.(); } }} type="button" onClick={() => onOpen(event.id)}>{canRestore && <span class="return-hint">↩ Вернуть сюда</span>}<span class="ghost-time">{minutesToTime(event.start)}</span><span>{eventTitle(data, event)}</span><small>{event.status === 'pending' ? 'Ждёт нового времени' : event.status === 'cancelled' ? 'Отменено' : `→ ${dateLabel(event.destinationDate)} · ${minutesToTime(event.destinationStart)}`}</small></button>;
  const view = expanded ? 'expanded' : timeline ? event.duration < 35 ? 'short' : 'grid' : 'board';
  const customized = Object.hasOwn(style.layouts,view);
  const configured = customized ? cardComposition(type,view,style).filter(({field,slot})=>slot!=='hidden' && fieldDisplay(field,event.fields?.[field.id])!=='') : [];
  const title = eventTitle(data,event);
  const activeMotion = selected && (style.smoke || style.liveText);
  const available = type.fields.filter(field => !field.archived && fieldDisplay(field, event.fields?.[field.id]) !== '');
  const meta = available.filter(field => field.showOnCard !== false);
  const compact = available.filter(field => field.showCompact ?? (field.type === 'url' && field.showOnCard !== false));
  const linkFields = (expanded ? meta : compact).filter(field => field.type === 'url' && linkHref(event.fields?.[field.id]));
  const isPlainField = field => !linkFields.includes(field);
  const links = eventLinks(customized ? configured.filter(row=>row.slot==='link').map(row=>row.field) : expanded ? meta : compact,event.fields,record);
  const details = configured.filter(row=>row.slot!=='link');
  const summary = <><span class="card-time">{minutesToTime(event.start)}–{minutesToTime(event.start + event.duration)}<span class="card-time-icons">{preview && event.location && <span class="event-place-mark" role="img" aria-label={`Место: ${event.location.label || event.location.address || 'указано на карте'}`} title={event.location.label || event.location.address || 'Место указано'}><Icon name="pin"/></span>}{appearance.icon && <span class="event-state-mark" role="img" aria-label={appearance.label} title={appearance.label}><Icon name={appearance.icon}/></span>}<span class="card-grip" aria-hidden="true">⠿</span></span></span><strong class="card-name">{activeMotion && style.liveText ? animatedTitle(title) : title}</strong>{!customized && <span class="event-type-label">{timeline && record?.name && record.name!==eventTitle(data,event)?record.name:type.name}{isEventMoved(event) ? ' · ↔' : event.seriesId ? ' · ↻' : ''}</span>}</>;
  return <article ref={cardRef} style={{'--card-tint':style.tint ? `color-mix(in srgb, ${style.tint} 55%, var(--surface) 45%)` : `var(--card-${eventColor(data,event)}, var(--surface-soft))`,'--card-opacity':`${style.opacity}%`}} class={`lesson-card event-card ${timeline?'timeline-card':''} ${selected?'is-card-selected':''} ${type.cardStyle?'has-card-style':''} ${customized?'has-composition':''} ${event.location && !preview ? 'has-place' : ''} color-${eventColor(data, event)} ${expanded ? 'is-expanded' : 'is-compact'} ${isDragging ? 'is-being-dragged' : ''} ${appearance.state === 'confirmed' ? 'is-done' : appearance.state === 'elapsed' ? 'is-past' : ''}`} data-event-id={!preview ? event.id : undefined} data-event-state={appearance.state} data-state-effect={appearance.effect} draggable={!preview && !timeline && event.status !== 'done' && Boolean(onDragStart)} onDragStart={eventObject => {
    if (eventObject.target.closest?.('a,button:not(.card-open)')) { eventObject.preventDefault(); return; }
    const source = eventObject.currentTarget;
    releasePreview();
    const image = source.cloneNode(true);
    image.classList.remove('is-being-dragged'); image.classList.add('event-drag-preview');
    image.style.width = `${Math.min(240, source.getBoundingClientRect().width)}px`;
    image.setAttribute('aria-hidden', 'true'); document.body.append(image);
    eventObject.dataTransfer.setDragImage?.(image, 25, 25);
    const current={node:image,frame:0};nativePreview.current=current;
    current.frame=requestAnimationFrame(releasePreview);
    eventObject.dataTransfer.setData('text/plain', event.id); eventObject.dataTransfer.effectAllowed = 'move'; onDragStart?.(event.id,eventObject);
  }} onDragEnd={input=>{releasePreview();onDragEnd?.(input);}}>
    {!preview && event.location && <button type="button" class="event-place-mark" aria-label={`Открыть событие на карте: ${event.location.label || event.location.address || eventTitle(data, event)}`} aria-haspopup="dialog" title={event.location.label || event.location.address || 'Открыть место события'} onClick={input => { input.stopPropagation(); onOpen?.(event.id, { showPlace:true }); }}><Icon name="pin"/></button>}
    {background && <img class="card-background-image" src={background} alt="" aria-hidden="true" draggable={false} decoding="async" style={{opacity: Math.min(50, Math.max(0, type.cardBackgroundStrength ?? 20)) / 100}}/>}
    {activeMotion && <Suspense fallback={null}><SelectedCardMotion cardRef={cardRef} smoke={style.smoke} liveText={style.liveText} paused={motionPaused || isDragging} title={title}/></Suspense>}
    {appearance.effect === 'marker' && ['elapsed', 'confirmed'].includes(appearance.state) && <MarkerPaint key={appearance.state}/>}
    {preview ? <div class="card-open">{summary}</div> : <button type="button" class="card-open" aria-pressed={onSelect ? selected : undefined} onClick={input => {
      const touch = input.pointerType === 'touch' || window.matchMedia?.('(pointer: coarse)').matches;
      if (onSelect && input.detail > 0 && !touch) onSelect(event.id);
      else onOpen(event.id);
    }} onDblClick={onSelect ? input => { if (!window.matchMedia?.('(pointer: coarse)').matches) {input.stopPropagation();onOpen(event.id, {anchor:cardRef.current});} } : undefined} aria-label={`${eventTitle(data, event)}, ${dateLabel(event.date)}, ${minutesToTime(event.start)}${appearance.icon ? `, ${appearance.label}` : ''}`}>{summary}</button>}
    {customized && details.length > 0 && <div class="card-composition">{details.map(({field,slot})=><span class={slot==='badge'?'composition-badge':'composition-line'} key={field.id} title={field.label}><LinkedValue field={field} value={event.fields[field.id]}/></span>)}</div>}
    {!customized && !expanded && compact.some(isPlainField) && <dl class="card-fields compact-fields">{compact.filter(isPlainField).map(field => <div key={field.id}><dt>{field.label}</dt><dd><LinkedValue field={field} value={event.fields[field.id]}/></dd></div>)}</dl>}
    {links.length > 0 && <div class="card-record-links" aria-label="Ссылки события">{links.map(link=><ExternalLink key={link.id} href={link.href} className="card-link-chip">{link.label}</ExternalLink>)}</div>}

    {expanded && <div class="card-expanded-content">
      {record && record.name !== eventTitle(data, event) && <span class="card-subject">{record.name}{(record.subject || record.subtitle) && ` · ${record.subject || record.subtitle}`}</span>}
      {!customized && meta.some(isPlainField) && <dl class="card-fields">{meta.filter(isPlainField).map(field => <div key={field.id}><dt>{field.label}</dt><dd><LinkedValue field={field} value={event.fields[field.id]}/></dd></div>)}</dl>}
      {event.location && <span class="card-place"><Icon name="pin"/>{event.location.label}</span>}
      {event.notes && <p class="card-note"><LinkedText value={event.notes}/></p>}
      <span class="card-bottom"><span><Icon name={event.status === 'done' ? 'check' : isEventMoved(event) ? 'arrows' : event.seriesId ? 'repeat' : 'calendar'}/>{event.status === 'done' ? 'Проведено' : isEventMoved(event) ? 'Перенос' : event.seriesId ? 'Повторяется' : 'Разовое'}</span><span>{event.duration} мин</span></span>
      {isEventMoved(event) && <span class="transfer-origin">Было {dateLabel(event.originalDate || event.anchorDate || event.date)} · {minutesToTime(event.originalStart ?? event.start)}</span>}
      {event.busy === false && <span class="not-busy-label">Не блокирует время</span>}
    </div>}
    {!preview && (onToggle || onDelete || onMove) && <div class="card-controls">{onToggle && <button type="button" class="card-expand" aria-expanded={expanded} onClick={() => onToggle?.(event.id)}>{expanded ? 'Свернуть ↑' : 'Подробнее ↓'}</button>}{onMove && event.status !== 'done' && <button type="button" class="card-move" aria-label={`Перенести событие «${eventTitle(data, event)}»`} onClick={() => onMove(event)}><Icon name="arrows"/></button>}{(onDelete || onDefer) && <ActionMenu compact label={`Действия · ${eventTitle(data, event)}`} items={[
      onDefer && event.status === 'planned' && {id:'pending',icon:'clock',label:'Отложить перенос',description:'Выбрать новую дату позже',onSelect:()=>onDefer(event)},
      onDelete && {id:'delete',icon:'trash',label:'Удалить событие',danger:true,separate:Boolean(onDefer),onSelect:()=>onDelete(event)},
    ]}/>}</div>}
  </article>;
}
