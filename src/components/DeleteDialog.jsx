import { useState } from 'preact/hooks';
import { Modal, Select, Button, ErrorMessage } from './UI.jsx';
import { clearEventArchive, eventTitle, deleteEvent, deleteRecord, deleteRecordTemplate, deleteType, recordTemplateUsage, RECORD_KINDS } from '../lib/events.js';
import { Icon } from './Icon.jsx';

export function DeleteDialog({ data, target, onSave, onClose }) {
  const [scope, setScope] = useState('one');
  const [removeEvents, setRemoveEvents] = useState('keep');
  const [error, setError] = useState('');
  const item = target.value;
  if (target.kind === 'event-archive') {
    return <Modal title={item ? 'Удалить из архива?' : 'Очистить архив удалённых шаблонов?'} subtitle={item && eventTitle(data,item)} onClose={onClose} className="delete-modal">
      <form onSubmit={event=>{
        event.preventDefault();
        try {onSave(clearEventArchive(data,item),item ? 'Удалено из архива' : 'Архив очищен',{permanent:true});}
        catch (error) {setError(error.message);}
      }}>
        <p>{item ? 'Эта запись исчезнет из архива без возможности восстановления.' : 'Все события и серии в разделе «Из удалённых шаблонов» будут удалены окончательно.'}</p>
        <ErrorMessage error={error}/>
        <div class="modal-footer"><Button onClick={onClose}>Отмена</Button><button type="submit" class="button danger">{item ? 'Удалить окончательно' : 'Очистить архив'}</button></div>
      </form>
    </Modal>;
  }
  if (target.kind === 'record-template') {
    const {records,eventTemplates} = recordTemplateUsage(data,item);
    return <Modal title="Удалить шаблон записи?" subtitle={RECORD_KINDS[item] || item} onClose={onClose} className="delete-modal">
      <form onSubmit={event=>{
        event.preventDefault();
        try {onSave(deleteRecordTemplate(data,item,{removeRecords:true}),'Шаблон записи удалён',{permanent:true});}
        catch (error) {setError(error.message);}
      }}>
        <div class={`delete-explanation${records ? ' has-cascade' : ''}`}><Icon name="trash"/>
          <p>{records ? `Шаблон и его записи (${records}) будут удалены. ` : 'Шаблон будет удалён. '}Связанные события и серии уйдут в архив без возможности возврата в расписание.</p>
        </div>
        {eventTemplates>0 && <p class="quiet-note">Связь с записью будет убрана из шаблонов событий ({eventTemplates}).</p>}
        <ErrorMessage error={error}/>
        <div class="modal-footer"><Button onClick={onClose}>Оставить</Button>
          <button type="submit" class="button danger">{records ? 'Удалить вместе с записями' : 'Удалить'}</button>
        </div>
      </form>
    </Modal>;
  }
  if (target.kind === 'type') {
    return <Modal title="Удалить шаблон?" subtitle={item.name} onClose={onClose} className="delete-modal">
      <form onSubmit={event=>{
        event.preventDefault();
        try {onSave(deleteType(data,item.id),'Шаблон события удалён',{permanent:true});}
        catch (error) {setError(error.message);}
      }}>
        <div class="delete-explanation has-cascade"><Icon name="trash"/><p>Шаблон будет удалён. Все события этого шаблона, их повторы, переносы и история уйдут в архив без возможности возврата в расписание.</p></div>
        <ErrorMessage error={error}/>
        <div class="modal-footer"><Button onClick={onClose}>Оставить</Button><button type="submit" class="button danger">Удалить шаблон</button></div>
      </form>
    </Modal>;
  }
  const name = target.kind === 'event' ? eventTitle(data, item) : item.name;
  const linked = value => value.recordId === item.id || value.studentId === item.id;
  const related = [...data.series, ...data.events].some(linked);
  const cascade = target.kind === 'record' && removeEvents === 'remove';
  const submit = event => {
    event.preventDefault();
    try {
      const next = target.kind === 'event' ? deleteEvent(data, item, scope) : deleteRecord(data, item, removeEvents === 'remove');
      onSave(next, target.kind === 'event' ? 'Событие удалено' : 'Запись удалена');
    } catch (error) { setError(error.message); }
  };
  return <Modal title={target.kind === 'event' ? 'Удалить событие?' : 'Удалить запись?'} subtitle={name} onClose={onClose} className="delete-modal">
    <form onSubmit={submit}>
      {target.kind === 'event' && item.seriesId && <Select label="Что удалить" value={scope} onChange={setScope}><option value="one">Только это событие</option><option value="all">Всю серию, включая переносы</option></Select>}
      {target.kind === 'record' && related && <Select label="Связанные события" value={removeEvents} onChange={setRemoveEvents}><option value="keep">Оставить события, удалить только запись</option><option value="remove">Удалить запись вместе со всеми её событиями</option></Select>}
      <div class={`delete-explanation ${cascade ? 'has-cascade' : ''}`}><Icon name="trash"/><p>{cascade ? 'Удалятся запись и все связанные с ней события, повторы, переносы и история проведения.' : target.kind === 'record' ? 'Общие сведения исчезнут из базы. Связанные события останутся самостоятельными.' : scope === 'one' ? 'Событие исчезнет из расписания и истории. Остальные повторы останутся на месте.' : 'Будут полностью удалены вся серия и её история, включая проведённые события. Чтобы сохранить прошлое, закрой это окно и выбери «Завершить повторы с сохранением истории» в событии.'}</p></div>
      <p class="quiet-note">Сразу после удаления можно нажать «Отменить» в уведомлении.</p>
      <ErrorMessage error={error}/><div class="modal-footer"><Button onClick={onClose}>Оставить</Button><button type="submit" class="button danger">{cascade ? 'Удалить вместе с событиями' : 'Удалить'}</button></div>
    </form>
  </Modal>;
}
