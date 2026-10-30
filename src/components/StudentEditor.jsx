import { RecordFields } from './RecordFields.jsx';
import { LinkedText } from './LinkedValue.jsx';
import { useState } from 'preact/hooks';
import { Modal, Field, Colors, FormFooter, ErrorMessage, Button, initials, money, longDays } from './UI.jsx';
import { saveStudent } from '../lib/events.js';
import { minutesToTime, todayISO } from '../lib/domain.js';

export function StudentEditor({ data, original, onSave, onClose, onDelete }) {
  const [student, setStudent] = useState(() => ({ name: '', subject: '', rate: '', contact: '', notes: '', color: 'violet', id: crypto.randomUUID(), ...original }));
  const [error, setError] = useState('');
  const change = (key, value) => setStudent(previous => ({ ...previous, [key]: value }));
  return <Modal title={original ? 'Редактор ученика' : 'Новый ученик'} eyebrow="БАЗА УЧЕНИКОВ" onClose={onClose}><form onSubmit={event => {
    event.preventDefault(); try { onSave(saveStudent(data, student), 'Карточка ученика сохранена', student); } catch (error) { setError(error.message); }
  }}><Field label="Имя" value={student.name} onChange={value => change('name', value)} required maxLength="100"/><Field label="Направление" value={student.subject} onChange={value => change('subject', value)} maxLength="100"/><div class="form-row"><Field label="Стоимость урока, ₽" type="number" value={student.rate} onChange={value => change('rate', value)} min="0" max="1000000" required/><Field label="Контакт" value={student.contact} onChange={value => change('contact', value)} maxLength="500"/></div><RecordFields value={student.details} onChange={value => change('details', value)}/><Colors value={student.color} onChange={value => change('color', value)}/><Field label="Заметки" type="textarea" rows="3" value={student.notes} onChange={value => change('notes', value)} maxLength="5000"/><ErrorMessage error={error}/><FormFooter onClose={onClose}>{original && onDelete && <Button icon="trash" kind="text-button danger-text delete-action" onClick={onDelete}>Удалить запись</Button>}</FormFooter></form></Modal>;
}
export function StudentDetails({ data, student, onEdit, onEvent, onClose, onDelete }) {
  const slots = data.series.filter(series => !series.archived && series.studentId === student.id && (!series.until || series.until >= todayISO()));
  return <Modal title={student.name} subtitle={student.subject} eyebrow="КАРТОЧКА УЧЕНИКА" onClose={onClose}><div class="profile-facts"><div><span>Стоимость урока</span><strong>{money(student.rate)}</strong></div><div><span>Контакт</span><strong><LinkedText value={student.contact || 'Не указан'}/></strong></div></div><dl class="detail-fields">{(student.details || []).map((item, index) => <div key={item.id || index}><dt>{item.label}</dt><dd><LinkedText value={item.value}/></dd></div>)}</dl><h3 class="detail-section-title">Постоянное расписание</h3>{slots.length ? slots.map(series => <div key={series.id} class="profile-slot"><span>{longDays[series.weekday]}{series.intervalWeeks > 1 && ` · каждые ${series.intervalWeeks} нед.`}</span><strong>{minutesToTime(series.start)}–{minutesToTime(series.start + series.duration)}</strong></div>) : <p class="empty-copy">Постоянных событий пока нет.</p>}{student.notes && <p class="notes-text"><LinkedText value={student.notes}/></p>}<div class="modal-footer">{onDelete && <Button icon="trash" kind="text-button danger-text delete-action" onClick={onDelete}>Удалить запись</Button>}<Button onClick={onEdit}>Редактировать</Button><Button kind="primary" icon="plus" onClick={onEvent}>Назначить урок</Button></div></Modal>;
}
