import { useState } from 'preact/hooks';
import { TaskBoard } from './TaskBoard.jsx';
import { TaskEditor } from './TaskEditor.jsx';
import { Modal } from './UI.jsx';
import { archiveTasks, setTaskStatus } from '../lib/tasks.js';

const event = {
  id:'guide-review', title:'Обсуждение макета', date:'2026-11-12', start:900, duration:45, status:'planned',
};
const initial = {
  events:[event], students:[], records:[], series:[],
  tasks:[{ id:'guide-task', title:'Проверить макет', eventId:event.id, status:'todo', archived:false }],
};

export function GuideBoardExample() {
  const [data,setData] = useState(initial);
  const [editor,setEditor] = useState(null);
  const [eventOpen,setEventOpen] = useState(false);
  const linked = data.tasks.filter(task=>task.eventId === event.id && !task.archived);

  return <>
    <p>Перемести «Проверить макет» в «Готово» и отправь в архив. По ссылке на стикере можно открыть связанное событие.</p>
    <TaskBoard data={data} pending={[]} onAdd={()=>setEditor({})} onEdit={task=>setEditor({task})}
      onOpenEvent={()=>setEventOpen(true)} onStatus={(id,status)=>setData(previous=>setTaskStatus(previous,id,status))}
      onArchive={(ids,archived)=>setData(previous=>archiveTasks(previous,ids,archived))}/>
    {editor && <TaskEditor data={data} task={editor.task} today={event.date} now={0}
      onClose={()=>setEditor(null)} onSave={next=>{ setData(next); setEditor(null); }}/>}
    {eventOpen && <Modal title={event.title} onClose={()=>setEventOpen(false)} className="product-dialog compact-dialog">
      <h3 class="detail-section-title">Задачи</h3>
      {linked.length ? <ul>{linked.map(task=><li key={task.id}>{task.title}{task.status==='done' && ' · Готово'}</li>)}</ul>
        : <p>Нет активных стикеров</p>}
    </Modal>}
  </>;
}
