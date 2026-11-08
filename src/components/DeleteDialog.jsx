import { useState } from 'preact/hooks';
import { Modal, Select, Button, ErrorMessage } from './UI.jsx';
import { eventTitle, deleteEvent, deleteRecord, deleteRecordTemplate, deleteType, recordTemplateUsage, RECORD_KINDS } from '../lib/events.js';
import { Icon } from './Icon.jsx';

export function DeleteDialog({ data, target, onSave, onClose }) {
  const [scope, setScope] = useState('one');
  const [removeEvents, setRemoveEvents] = useState('keep');
  const [error, setError] = useState('');
  const item = target.value;
  if (target.kind === 'record-template') {
    const {records,eventTemplates} = recordTemplateUsage(data,item);
    const inUse = records>0 || eventTemplates>0;
    return <Modal title="Удалить шаблон записи?" subtitle={RECORD_KINDS[item] || item} onClose={onClose} className="delete-modal">
      <form onSubmit={event=>{
        event.preventDefault();
        try {onSave(deleteRecordTemplate(data,item),'Шаблон записи удалён');}
        catch (error) {setError(error.message);}
      }}>
        <p>{inUse ? `Шаблон используется. Записей: ${records}. Связанных шаблонов событий: ${eventTemplates}.` : 'Шаблон и его поля исчезнут из редактора.'}</p>
        {inUse && <p class="quiet-note">Сначала поменяй шаблон у записей и убери связи из шаблонов событий.</p>}
        <ErrorMessage error={error}/>
        <div class="modal-footer"><Button onClick={onClose}>{inUse ? 'Закрыть' : 'Оставить'}</Button>
          <button type="submit" class="button danger" disabled={inUse}>Удалить</button>
        </div>
      </form>
    </Modal>;
  }
  const name = target.kind === 'event' ? eventTitle(data, item) : item.name;
  const linked = value => target.kind === 'type' ? value.typeId === item.id : value.recordId === item.id || value.studentId === item.id;
  const related = [...data.series, ...data.events].some(linked);
  const cascade = target.kind === 'type' && related || target.kind === 'record' && removeEvents === 'remove';
  const submit = event => {
    event.preventDefault();
    try {
      const next = target.kind === 'event' ? deleteEvent(data, item, scope) : target.kind === 'record' ? deleteRecord(data, item, removeEvents === 'remove') : deleteType(data, item.id);
      onSave(next, target.kind === 'event' ? 'Событие удалено' : target.kind === 'record' ? 'Запись удалена' : 'Шаблон удалён');
    } catch (error) { setError(error.message); }
  };
  return <Modal title={target.kind === 'event' ? 'Удалить событие?' : target.kind === 'record' ? 'Удалить запись?' : 'Удалить шаблон?'} subtitle={name} onClose={onClose} className="delete-modal">
    <form onSubmit={submit}>
      {target.kind === 'event' && item.seriesId && <Select label="Что удалить" value={scope} onChange={setScope}><option value="one">Только это событие</option><option value="all">Всю серию, включая переносы</option></Select>}
      {target.kind === 'record' && related && <Select label="Связанные события" value={removeEvents} onChange={setRemoveEvents}><option value="keep">Оставить события, удалить только запись</option><option value="remove">Удалить запись вместе со всеми её событиями</option></Select>}
      <div class={`delete-explanation ${cascade ? 'has-cascade' : ''}`}><Icon name="trash"/><p>{cascade ? target.kind === 'type' ? 'Удалятся шаблон, все события этого шаблона, их повторы, переносы и история проведённых событий.' : 'Удалятся запись и все связанные с ней события, повторы, переносы и история проведения.' : target.kind === 'record' ? 'Общие сведения исчезнут из базы. Связанные события останутся самостоятельными.' : target.kind === 'event' && scope === 'one' ? 'Событие исчезнет из расписания и истории. Остальные повторы останутся на месте.' : target.kind === 'event' && scope === 'all' ? 'Будут полностью удалены вся серия и её история, включая проведённые события. Чтобы сохранить прошлое, закрой это окно и выбери «Завершить повторы с сохранением истории» в событии.' : 'Удалённые данные исчезнут из приложения.'}</p></div>
      <p class="quiet-note">Сразу после удаления можно нажать «Отменить» в уведомлении.</p>
      <ErrorMessage error={error}/><div class="modal-footer"><Button onClick={onClose}>Оставить</Button><button type="submit" class="button danger">{cascade ? 'Удалить вместе с событиями' : 'Удалить'}</button></div>
    </form>
  </Modal>;
}
