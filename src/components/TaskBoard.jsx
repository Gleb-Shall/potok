import { createPortal } from 'preact/compat';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { usePressDrag, touchDropTarget } from '../hooks/usePressDrag.js';
import { ActionMenu } from './ActionMenu.jsx';
import { Icon } from './Icon.jsx';
import { Button, dateLabel } from './UI.jsx';
import { eventTitle, findOccurrence } from '../lib/events.js';
import { TASK_COLUMNS } from '../lib/tasks.js';

const BOARD_COLUMNS = [['pending', 'Ждут переноса'], ...TASK_COLUMNS];

function TaskMovePicker({ drag, hover, ghostRef }) {
  const picker = useRef(null);
  const { x, y } = drag.point;
  useLayoutEffect(() => {
    const node = picker.current;
    const { width, height } = node.getBoundingClientRect();
    const gutter = 12, gap = 20;
    const left = Math.max(gutter, Math.min(x - width / 2, window.innerWidth - width - gutter));
    const top = y + gap + height <= window.innerHeight - gutter ? y + gap : y - height - gap;
    node.style.left = `${left}px`;
    node.style.top = `${Math.max(gutter, top)}px`;
  }, [x,y]);
  return createPortal(<div class="task-move-overlay" aria-hidden="true">
    <section ref={picker} class="task-move-picker">
      <strong>Перенести стикер</strong>
      {TASK_COLUMNS.map(([status,label]) => <div key={status} data-task-drop={status}
        class={status === drag.item.status ? 'is-source' : hover === status ? 'is-target' : ''}>
        <span>{label}</span>
        <Icon name={status === drag.item.status ? 'check' : 'arrow'}/>
      </div>)}
    </section>
    <div ref={ghostRef} class="press-drag-ghost task-drag-ghost" style={{transform:`translate3d(${x}px,${y}px,0)`}}>{drag.item.title}</div>
  </div>, document.body);
}

export function TaskBoard({ data, pending, renderPending, onAdd, onEdit, onOpenEvent, onStatus, onArchive, mobile = false }) {
  const [drag, setDrag] = useState(null);
  const [showArchive, setShowArchive] = useState(false);
  const [activeColumn, setActiveColumn] = useState('todo');
  const columns = useRef(null);
  const tasks = data.tasks || [];
  const archived = tasks.filter(task => task.archived);
  const completed = tasks.filter(task => !task.archived && task.status === 'done');
  const touch = usePressDrag({
    root: columns, enabled: !showArchive, selector: '[data-task-id]', dragButton: '.task-title',
    holdDragMode: 'board', touchOnly: !mobile,
    getItem: node => tasks.find(task => !task.archived && task.id === node.dataset.taskId),
    hitTest: point => touchDropTarget(point, '[data-task-drop]', 'data-task-drop'),
    onDrop: (task, status) => {
      if (status !== task.status) onStatus(task.id, status);
    },
  });

  const card = task => {
    const linked = findOccurrence(data, task.eventId);
    const actions = task.archived
      ? [{ id:'restore', label:'Вернуть в «Готово»', onSelect:()=>onArchive([task.id], false) }]
      : [
        ...TASK_COLUMNS.filter(([status]) => task.status !== status).map(([status, label]) => ({
          id:status, label:`Переместить в «${label}»`, onSelect:()=>onStatus(task.id, status),
        })),
        task.status === 'done' && { id:'archive', label:'В архив', onSelect:()=>onArchive([task.id], true) },
      ];
    return <article class="task-note" key={task.id} data-task-id={task.archived ? undefined : task.id} draggable={!mobile && !task.archived}
      onDragStart={event=>{
        if (mobile || task.archived || touch.drag) { event.preventDefault(); return; }
        event.dataTransfer.setData('text/plain', task.id);
        event.dataTransfer.effectAllowed = 'move';
        setDrag({ id:task.id, status:task.status });
      }} onDragEnd={()=>setDrag(null)}>
      <div class="task-note-top"><button type="button" class="task-title" onClick={()=>onEdit(task)}>{task.title}</button>
        <ActionMenu compact label={`Действия: ${task.title}`} items={actions}/>
      </div>
      {linked ? <Button icon="calendar" class="button text-button task-event-link" onClick={()=>onOpenEvent(linked.id)}>
        {eventTitle(data, linked)}{linked.date && ` · ${dateLabel(linked.date)}`}
      </Button> : task.eventId && <small>Связанное событие недоступно</small>}
    </article>;
  };

  return <section class="task-board" aria-label="Доска задач">
    <header class="task-board-bar">
      <h2>{showArchive ? 'Архив задач' : 'Доска'}</h2>
      <div><Button aria-pressed={showArchive} onClick={()=>setShowArchive(value=>!value)}>{showArchive ? 'Вернуться к доске' : `Архив · ${archived.length}`}</Button>
        {!showArchive && <Button kind="primary" icon="plus" onClick={onAdd}>Добавить стикер</Button>}</div>
    </header>
    {showArchive ? <div class="task-archive">{archived.length ? archived.map(card) : <p>В архиве пока пусто</p>}</div> : <>
      {mobile && <div class="task-column-tabs" role="group" aria-label="Колонки доски">
        {BOARD_COLUMNS.map(([status,title]) => <button type="button" key={status}
          aria-pressed={activeColumn === status} onClick={()=>setActiveColumn(status)}>{title}</button>)}
      </div>}
      <div ref={columns} class={`task-board-columns${mobile ? ' is-single-column' : ''}`}>
        {(!mobile || activeColumn === 'pending') && <section class="task-lane task-lane-pending">
          <header><h3>Ждут переноса <span class="section-count">{pending.length}</span></h3></header>
          <div class="task-lane-cards">{pending.length ? pending.map(renderPending) : <p>Все события на своих местах</p>}</div>
        </section>}
        {TASK_COLUMNS.filter(([status]) => !mobile || activeColumn === status).map(([status, title]) => {
          const items = tasks.filter(task => !task.archived && task.status === status);
          const canDrop = drag && drag.status !== status;
          return <section key={status} data-task-status={status}
            class={`task-lane task-lane-${status}${canDrop ? ' is-drop-ready' : ''}`}
            onDragOver={event=>{ if (drag && canDrop) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } }}
            onDrop={event=>{ if (drag && canDrop) { event.preventDefault(); onStatus(drag.id, status); setDrag(null); } }}>
            <header><h3>{title} <span class="section-count">{items.length}</span></h3></header>
            <div class="task-lane-cards">{items.length ? items.map(card) : <p>Пока пусто</p>}</div>
            {status === 'done' && completed.length > 0 && <Button kind="text-button" onClick={()=>onArchive(completed.map(task=>task.id), true)}>Архивировать выполненные</Button>}
          </section>;
        })}
      </div></>}
    {touch.drag && <TaskMovePicker drag={touch.drag} hover={touch.hover} ghostRef={touch.ghostRef}/>}
  </section>;
}
