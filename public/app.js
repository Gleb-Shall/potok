import { addDays, mondayOf, todayISO, weekdayOf, minutesToTime, timeToMinutes, validateStudent, validateLesson, projectWeek, moveLesson, findConflict, findRecurringConflict, COLORS } from './domain.js';
import { createLocalStore } from './store.js';
import { createDemo } from './demo.js';

const root = document.querySelector('#app');
const modal = document.querySelector('#modal');
const toast = document.querySelector('#notice');
const today = todayISO();
const state = { view: 'schedule', week: mondayOf(today), selectedDate: today, query: '', mode: 'demo', ghosts: true, data: null, store: null, undo: null, dragId: null, modal: null, noticeTimer: null };
const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const longDays = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const money = value => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value) + ' ₽';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const colorOf = student => COLORS.includes(student?.color) ? student.color : 'violet';
const studentOf = id => state.data.students.find(student => student.id === id) || { name: 'Ученик', subject: '', color: 'violet', rate: 0 };
const emptyData = () => ({ students: [], series: [], lessons: [] });
const dateLabel = (value, options = {}) => value ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC', ...options }).format(new Date(value + 'T00:00:00Z')) : 'без даты';
const interval = lesson => `${minutesToTime(lesson.start)}–${minutesToTime(lesson.start + lesson.duration)}`;
const initials = name => name.split(/\s+/).slice(0, 2).map(part => part[0]).join('');
const days = () => Array.from({ length: 7 }, (_, index) => addDays(state.week, index));
const projected = () => projectWeek(state.data, state.week);
const changed = lesson => Boolean(lesson.history?.length);
const matches = student => `${student.name} ${student.subject}`.toLocaleLowerCase('ru').includes(state.query.toLocaleLowerCase('ru'));

const paths = {
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  arrows: '<path d="M4 7h15l-4-4M20 17H5l4 4M19 7l-4 4M5 17l4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  left: '<path d="m14 6-6 6 6 6"/>', right: '<path d="m10 6 6 6-6 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>', check: '<path d="m5 12 4 4L19 6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
  repeat: '<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.calendar}</svg>`;
const button = (action, label, className = 'button', extra = '') => `<button type="button" class="${className}" data-action="${action}" ${extra}>${label}</button>`;

function notify(message, undo = false) {
  clearTimeout(state.noticeTimer);
  toast.innerHTML = `<span>${esc(message)}</span>${undo ? button('undo', 'Отменить', 'toast-undo') : ''}`;
  toast.classList.add('visible');
  state.noticeTimer = setTimeout(() => toast.classList.remove('visible'), 6500);
}

function loadMode(mode) {
  const initial = mode === 'demo' ? createDemo(today) : emptyData();
  const store = createLocalStore(localStorage, `tutor-schedule:${mode}:v1`, initial);
  state.store = store;
  state.data = store.getState();
  state.mode = mode;
  state.undo = null;
  state.query = '';
  localStorage.setItem('tutor-schedule:mode', mode);
  render();
}

function save(collection, record, message, selectedDate = null) {
  const previous = state.store.getState();
  state.data = state.store.upsert(collection, record);
  state.undo = previous;
  if (selectedDate) { state.week = mondayOf(selectedDate); state.selectedDate = selectedDate; }
  closeModal();
  render();
  notify(message, true);
}

function render() {
  const focusId = document.activeElement?.id;
  const cursor = document.activeElement?.selectionStart;
  const projection = projected();
  const viewTitles = { schedule: 'Расписание', students: 'Ученики', transfers: 'Переносы', settings: 'Настройки' };
  const viewSubtitles = { schedule: 'Каждому уроку — своё время', students: 'Всё важное об учениках в одном месте', transfers: 'Ничего не теряется при смене планов', settings: 'Твоё пространство и данные' };
  root.innerHTML = `<div class="layout">
    <aside class="sidebar">
      <a class="brand" href="#" data-action="view" data-view="schedule"><span class="brand-mark">у</span><span>уроки<span class="brand-dot">.</span></span></a>
      <div class="workspace-label">ЛИЧНОЕ ПРОСТРАНСТВО</div>
      <nav aria-label="Разделы">${[['schedule', 'calendar', 'Расписание'], ['students', 'users', 'Ученики'], ['transfers', 'arrows', 'Переносы']].map(([view, symbol, label]) => `<button class="nav-item ${state.view === view ? 'active' : ''}" data-action="view" data-view="${view}" ${state.view === view ? 'aria-current="page"' : ''}>${icon(symbol)}<span>${label}</span>${view === 'students' ? `<span class="nav-count">${state.data.students.length}</span>` : view === 'transfers' && projection.pending.length ? `<span class="nav-count amber">${projection.pending.length}</span>` : ''}</button>`).join('')}</nav>
      <div class="sidebar-note"><span class="tiny-spark">✳</span><p>Меньше организационных<br>дел. Больше хороших уроков.</p></div>
      <div class="sidebar-bottom">${button('view', `${icon('settings')}<span>Настройки</span>`, `nav-item ${state.view === 'settings' ? 'active' : ''}`, 'data-view="settings"')}
      <div class="account"><span class="account-avatar">Я</span><div><strong>Моё расписание</strong><small><span class="status-dot"></span>На этом устройстве</small></div></div></div>
    </aside>
    <main class="main">
      <header class="page-header"><div><p class="eyebrow">СПОКОЙНО, ВСЁ ПО ПЛАНУ</p><h1>${viewTitles[state.view]}</h1><p class="subtitle">${viewSubtitles[state.view]}</p></div>
        <div class="header-actions"><span class="mode-chip">${state.mode === 'demo' ? 'Демо' : 'Локально'}</span>${button('view', icon('settings'), 'icon-button', 'data-view="settings" aria-label="Настройки"')}${button(state.view === 'students' ? 'new-student' : 'new-lesson', `${icon('plus')}${state.view === 'students' ? 'Добавить ученика' : 'Добавить занятие'}`, 'button primary')}</div>
      </header>
      ${state.mode === 'demo' ? `<div class="demo-banner">${icon('info')}<span>Это пример расписания с вымышленными учениками. Можно всё попробовать.</span>${button('personal', `Создать своё ${icon('arrow')}`, 'text-button')}</div>` : ''}
      ${state.view === 'schedule' ? scheduleView(projection) : state.view === 'students' ? studentsView() : state.view === 'transfers' ? transfersView(projection) : settingsView()}
      <footer class="page-footer"><span><span class="status-dot"></span>Изменения сохраняются в этом браузере</span><span>Московское время · UTC+3</span></footer>
    </main></div>`;
  if (focusId) {
    const input = document.getElementById(focusId);
    input?.focus({ preventScroll: true });
    if (input?.setSelectionRange && typeof cursor === 'number') input.setSelectionRange(cursor, cursor);
  }
}

function searchField(placeholder) {
  return `<label class="search-field">${icon('search')}<input id="search" type="search" placeholder="${placeholder}" aria-label="${placeholder}" value="${esc(state.query)}" autocomplete="off"></label>`;
}

function scheduleView(projection) {
  const hours = projection.lessons.reduce((total, lesson) => total + lesson.duration, 0) / 60;
  const movedCount = projection.lessons.filter(changed).length;
  return `<section class="overview" aria-label="Обзор недели">
    <div class="overview-intro"><span class="section-caption">НА ЭТОЙ НЕДЕЛЕ</span><strong>Есть время для всего<span class="lime-dot">.</span></strong></div>
    <div class="stat"><span class="stat-icon violet-text">${icon('calendar')}</span><div><strong>${projection.lessons.length}</strong><span>занятий</span></div></div>
    <div class="stat"><span class="stat-icon green-text">${icon('clock')}</span><div><strong>${hours.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}<small> ч</small></strong><span>учебного времени</span></div></div>
    <div class="stat"><span class="stat-icon peach-text">${icon('arrows')}</span><div><strong>${movedCount}</strong><span>разовых переносов</span></div></div>
  </section>
  <section class="schedule-panel" aria-label="Недельное расписание">
    <div class="calendar-toolbar"><div class="week-navigation">${button('prev-week', icon('left'), 'icon-button', 'aria-label="Предыдущая неделя"')}<h2>${dateLabel(state.week)} — ${dateLabel(addDays(state.week, 6), { year: 'numeric' })}</h2>${button('next-week', icon('right'), 'icon-button', 'aria-label="Следующая неделя"')}${button('today', 'Сегодня', 'button small secondary')}</div>${searchField('Найти ученика')}</div>
    <div class="mobile-days" role="group" aria-label="День недели">${days().map(date => `<button data-action="select-day" data-date="${date}" class="mobile-day ${date === state.selectedDate ? 'selected' : ''}"><span>${dayNames[weekdayOf(date)]}</span><strong>${Number(date.slice(8))}</strong></button>`).join('')}</div>
    <div class="calendar-grid">${days().map(date => dayColumn(date, projection)).join('')}</div>
    <div class="calendar-bottom"><span class="drag-hint">${icon('arrows')} Перетащи карточку на другой день, чтобы перенести урок</span><label class="check-label"><input type="checkbox" id="show-ghosts" ${state.ghosts ? 'checked' : ''}> Показывать старое время</label></div>
  </section>
  <section class="pending-panel" data-drop="pending"><div class="pending-heading"><span class="pending-symbol">${icon('arrows')}</span><div><h2>Ждут нового времени <span class="count-pill">${projection.pending.length}</span></h2><p>Уроки, которые отменили, но ещё не назначили заново</p></div></div>
    ${projection.pending.length ? `<div class="pending-cards">${projection.pending.map(lesson => pendingCard(lesson)).join('')}</div>` : `<span class="all-good">${icon('check')} Все занятия на своих местах</span>`}
  </section>`;
}

function dayColumn(date, projection) {
  const visible = projection.lessons.filter(lesson => lesson.date === date && matches(studentOf(lesson.studentId)));
  const ghosts = state.ghosts ? projection.ghosts.filter(lesson => lesson.date === date && matches(studentOf(lesson.studentId))) : [];
  const cards = [...visible, ...ghosts].sort((a, b) => a.start - b.start);
  return `<section class="day-column ${date === today ? 'is-today' : ''} ${date === state.selectedDate ? 'mobile-selected' : ''}" data-drop="${date}" aria-label="${longDays[weekdayOf(date)]}, ${dateLabel(date)}">
    <header class="day-header"><span>${longDays[weekdayOf(date)]}</span><div><strong>${Number(date.slice(8))}</strong>${date === today ? '<span class="today-tag">сегодня</span>' : `<span class="day-count">${visible.length ? visible.length + ' зан.' : '—'}</span>`}</div></header>
    <div class="day-body">${cards.map(lesson => lessonCard(lesson)).join('')}${!cards.length ? `<div class="free-day"><span>Свободный день</span><small>Можно оставить для себя</small></div>` : ''}
    ${button('new-lesson', `${icon('plus')}<span>Занятие</span>`, 'add-slot', `data-date="${date}" aria-label="Добавить занятие на ${dateLabel(date)}"`)}</div>
  </section>`;
}

function lessonCard(lesson) {
  const student = studentOf(lesson.studentId);
  if (lesson.ghost) {
    const destination = lesson.status === 'cancelled' ? 'Отменено' : lesson.status === 'pending' ? 'Ждёт нового времени' : `→ ${dateLabel(state.data.lessons.find(item => item.id === lesson.id)?.date)} · ${minutesToTime(state.data.lessons.find(item => item.id === lesson.id)?.start ?? lesson.start)}`;
    return `<button type="button" class="ghost-card" data-action="lesson" data-id="${esc(lesson.id)}"><span class="ghost-time">${minutesToTime(lesson.start)}</span><span>${esc(student.name)}</span><small>${esc(destination)}</small></button>`;
  }
  return `<button type="button" class="lesson-card color-${colorOf(student)} ${lesson.status === 'done' ? 'is-done' : ''}" draggable="${lesson.status !== 'done'}" data-action="lesson" data-id="${esc(lesson.id)}" data-draggable="${esc(lesson.id)}" aria-label="${esc(student.name)}, ${dateLabel(lesson.date)}, ${interval(lesson)}">
    <span class="card-time">${interval(lesson)}<span class="card-grip" aria-hidden="true">⠿</span></span><strong class="card-name">${esc(student.name)}</strong><span class="card-subject">${esc(student.subject || 'Индивидуальное занятие')}</span>
    <span class="card-bottom">${lesson.status === 'done' ? `<span>${icon('check')}Проведено</span>` : changed(lesson) ? `<span>${icon('arrows')}Перенос</span>` : lesson.seriesId ? `<span>${icon('repeat')}Еженедельно</span>` : '<span>Разовое</span>'}<span>${lesson.duration} мин</span></span>
    ${changed(lesson) ? `<span class="transfer-origin">Было ${dateLabel(lesson.originalDate)} · ${minutesToTime(lesson.originalStart)}</span>` : ''}
  </button>`;
}

function pendingCard(lesson) {
  const student = studentOf(lesson.studentId);
  return `<button class="pending-card" data-action="move" data-id="${esc(lesson.id)}"><span class="student-avatar color-${colorOf(student)}">${esc(initials(student.name))}</span><span><strong>${esc(student.name)}</strong><small>Было ${dateLabel(lesson.originalDate || lesson.anchorDate)} · ${minutesToTime(lesson.originalStart ?? lesson.start)}</small></span><span class="pending-choose">Выбрать время ${icon('arrow')}</span></button>`;
}

function studentsView() {
  const students = state.data.students.filter(matches).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  return `<section class="students-panel"><div class="section-toolbar"><h2>Твои ученики <span class="count-pill">${state.data.students.length}</span></h2>${searchField('Имя или направление')}</div><div class="student-grid">${students.map(student => {
    const slots = state.data.series.filter(series => series.studentId === student.id && (!series.until || series.until >= today));
    return `<button class="student-tile" data-action="student" data-id="${esc(student.id)}"><span class="student-avatar large color-${colorOf(student)}">${esc(initials(student.name))}</span><strong>${esc(student.name)}</strong><span>${esc(student.subject || 'Направление не указано')}</span><div class="student-tile-footer"><span>${money(student.rate)} <small>/ урок</small></span><span>${slots.length ? slots.length + ' в неделю' : 'Разовые уроки'}</span></div></button>`;
  }).join('') || `<div class="empty-state"><span class="empty-icon">${icon('users')}</span><h3>${state.query ? 'Никого не нашли' : 'Здесь будут твои ученики'}</h3><p>${state.query ? 'Попробуй другое имя или направление.' : 'Добавь первого ученика, а затем назначь занятие.'}</p>${state.query ? '' : button('new-student', `${icon('plus')}Добавить ученика`, 'button primary')}</div>`}</div></section>`;
}

function transfersView(projection) {
  const history = state.data.lessons.filter(lesson => changed(lesson) || lesson.status === 'cancelled').sort((a, b) => (b.history?.at(-1)?.at || '').localeCompare(a.history?.at(-1)?.at || ''));
  return `<section class="transfer-page"><div class="section-toolbar"><h2>Ждут согласования <span class="count-pill">${projection.pending.length}</span></h2></div><div class="pending-list">${projection.pending.map(pendingCard).join('') || '<p class="empty-copy">Всё согласовано. Занятий без нового времени нет.</p>'}</div>
    <div class="section-toolbar"><h2>История изменений <span class="count-pill">${history.length}</span></h2></div><div class="history-list">${history.map(lesson => `<button class="history-row" data-action="lesson" data-id="${esc(lesson.id)}"><span class="student-avatar color-${colorOf(studentOf(lesson.studentId))}">${esc(initials(studentOf(lesson.studentId).name))}</span><span><strong>${esc(studentOf(lesson.studentId).name)}</strong><small>Было ${dateLabel(lesson.originalDate || lesson.anchorDate)} · ${minutesToTime(lesson.originalStart ?? lesson.start)}</small></span>${icon('arrow')}<span class="history-destination">${lesson.status === 'pending' ? 'Время не выбрано' : lesson.status === 'cancelled' ? 'Отменено' : `${dateLabel(lesson.date)} · ${minutesToTime(lesson.start)}`}</span></button>`).join('') || '<p class="empty-copy">Здесь появятся разовые переносы и отмены.</p>'}</div></section>`;
}

function settingsView() {
  return `<section class="settings-panel"><div class="settings-card"><span class="section-caption">ХРАНЕНИЕ ДАННЫХ</span><h2>Пока всё на этом устройстве</h2><p>Расписание сохраняется в браузере и остаётся после обновления страницы. Синхронизацию через Firebase подключим следующим этапом.</p><div class="settings-actions">${button('export', `${icon('download')}Скачать резервную копию`, 'button secondary')}${button(state.mode === 'demo' ? 'personal' : 'demo', state.mode === 'demo' ? 'Перейти к своему расписанию' : 'Открыть деморасписание', 'button secondary')}</div></div><div class="settings-card"><span class="section-caption">КАК РАБОТАЮТ ПЕРЕНОСЫ</span><h2>Один урок, вся история</h2><p>Перетащи карточку на другой день или выбери «Перенести» внутри занятия. Изменится только этот урок. Постоянное расписание следующих недель останется прежним.</p><p>Если новое время ещё не согласовано, отправь занятие в «Ждут нового времени». Старое время освободится, а запись о нём сохранится.</p></div><div class="settings-card"><span class="section-caption">РЕЖИМ ПРОСМОТРА</span><h2>${state.mode === 'demo' ? 'Деморасписание' : 'Твоё расписание'}</h2><p>${state.mode === 'demo' ? 'Все ученики вымышленные. Изменения примера сохраняются отдельно от твоих данных.' : 'Здесь только записи, которые ты добавил самостоятельно. Демо хранится отдельно.'}</p>${state.mode === 'demo' ? button('reset-demo', 'Восстановить пример', 'text-button') : ''}</div></section>`;
}

function openModal(content, type, record = null) {
  state.modal = { type, record };
  modal.innerHTML = `${button('close', icon('close'), 'modal-close icon-button', 'aria-label="Закрыть окно"')}${content}`;
  if (!modal.open) modal.showModal();
  const autofocus = modal.querySelector('[autofocus]');
  autofocus?.focus();
}
function closeModal() { modal.close(); state.modal = null; }
const formError = () => '<p class="form-error" role="alert" id="form-error"></p>';
const formFooter = label => `<div class="modal-footer">${button('close', 'Отмена', 'button secondary')}<button type="submit" class="button primary">${label}</button></div>`;
const field = (name, label, type, value, extra = '') => `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;

function studentForm(id) {
  const student = state.data.students.find(item => item.id === id) || { name: '', subject: '', contact: '', rate: '', notes: '', color: 'violet' };
  openModal(`<p class="eyebrow">БАЗА УЧЕНИКОВ</p><h2 id="modal-title">${id ? 'Редактировать ученика' : 'Новый ученик'}</h2><p class="modal-subtitle">Данные будут доступны из любого его занятия.</p><form id="student-form">
    ${field('name', 'Имя', 'text', student.name, 'required maxlength="100" autofocus placeholder="Например, Анна"')}${field('subject', 'Направление', 'text', student.subject, 'maxlength="100" placeholder="ЕГЭ · математика"')}
    <div class="form-row">${field('rate', 'Стоимость занятия, ₽', 'number', student.rate, 'required min="0" max="1000000" step="1" placeholder="1500"')}${field('contact', 'Контакт', 'text', student.contact, 'maxlength="500" placeholder="Телефон или Telegram"')}</div>
    <fieldset class="color-field"><legend>Цвет карточек</legend>${COLORS.map((color, index) => `<label class="color-option color-${color}"><input type="radio" name="color" value="${color}" ${student.color === color ? 'checked' : ''}><span class="sr-only">${['Сиреневый', 'Голубой', 'Зелёный', 'Персиковый', 'Розовый'][index]}</span></label>`).join('')}</fieldset>
    <label class="field"><span>Заметки</span><textarea name="notes" maxlength="5000" rows="3" placeholder="Цель занятий, особенности, о чём помнить">${esc(student.notes)}</textarea></label>${formError()}${formFooter(id ? 'Сохранить изменения' : 'Добавить ученика')}</form>`, 'student-form', id ? student : null);
}

function studentDetails(id) {
  const student = state.data.students.find(item => item.id === id);
  if (!student) return;
  const slots = state.data.series.filter(series => series.studentId === id && (!series.until || series.until >= today));
  openModal(`<div class="profile-heading"><span class="student-avatar large color-${colorOf(student)}">${esc(initials(student.name))}</span><p class="eyebrow">КАРТОЧКА УЧЕНИКА</p><h2 id="modal-title">${esc(student.name)}</h2><p>${esc(student.subject || 'Направление не указано')}</p></div><div class="profile-facts"><div><span>Стоимость занятия</span><strong>${money(student.rate)}</strong></div><div><span>Контакт</span><strong>${esc(student.contact || 'Не указан')}</strong></div></div>
    <h3 class="detail-section-title">Постоянное расписание</h3>${slots.length ? slots.map(series => `<div class="profile-slot"><span>${longDays[series.weekday]}</span><strong>${minutesToTime(series.start)}–${minutesToTime(series.start + series.duration)}</strong></div>`).join('') : '<p class="empty-copy">Постоянных занятий пока нет.</p>'}
    ${student.notes ? `<h3 class="detail-section-title">Заметки</h3><p class="notes-text">${esc(student.notes)}</p>` : ''}<div class="modal-footer">${button('edit-student', 'Редактировать', 'button secondary', `data-id="${esc(id)}"`)}${button('new-lesson', `${icon('plus')}Назначить урок`, 'button primary', `data-student="${esc(id)}"`)}</div>`, 'student-details', student);
}

function lessonForm(date = state.selectedDate, studentId = '') {
  if (!state.data.students.length) { studentForm(); notify('Сначала добавь ученика.'); return; }
  openModal(`<p class="eyebrow">РАСПИСАНИЕ</p><h2 id="modal-title">Новое занятие</h2><p class="modal-subtitle">Разовый урок или постоянное время на неделе.</p><form id="lesson-form"><label class="field"><span>Ученик</span><select name="studentId" required autofocus>${state.data.students.map(student => `<option value="${esc(student.id)}" ${student.id === studentId ? 'selected' : ''}>${esc(student.name)}${student.subject ? ' · ' + esc(student.subject) : ''}</option>`).join('')}</select></label>
    ${field('date', 'Дата первого занятия', 'date', date, 'required')}<div class="form-row">${field('start', 'Начало', 'time', '17:00', 'required')}${field('duration', 'Длительность, мин', 'number', 60, 'required min="5" max="480" step="5"')}</div>
    <label class="repeat-option"><input type="checkbox" name="repeat"><span>${icon('repeat')}Повторять каждую неделю<small>В этот день и в это же время</small></span></label><label class="field"><span>Заметка к занятию</span><textarea name="notes" rows="2" maxlength="5000" placeholder="Например, разобрать пробный вариант"></textarea></label>${formError()}${formFooter('Добавить занятие')}</form>`, 'lesson-form');
}

function findLesson(id) { return state.data.lessons.find(lesson => lesson.id === id) || projected().lessons.find(lesson => lesson.id === id); }

function lessonDetails(id) {
  const lesson = findLesson(id);
  if (!lesson) return;
  const student = studentOf(lesson.studentId);
  const statuses = { planned: 'Запланировано', done: 'Проведено', cancelled: 'Отменено', pending: 'Ждёт нового времени' };
  const histories = lesson.history || [];
  openModal(`<p class="eyebrow">${lesson.seriesId ? 'ЕЖЕНЕДЕЛЬНОЕ ЗАНЯТИЕ' : 'РАЗОВОЕ ЗАНЯТИЕ'}</p><h2 id="modal-title">${esc(student.name)}</h2><p class="modal-subtitle">${esc(student.subject)}</p><div class="lesson-detail-time">${icon('calendar')}<strong>${lesson.date ? dateLabel(lesson.date, { weekday: 'long', year: 'numeric' }) : 'Новое время не выбрано'}</strong>${lesson.date ? `<span>${interval(lesson)}</span>` : ''}</div><div class="detail-status">${statuses[lesson.status]}</div>
    ${lesson.seriesId ? '<p class="quiet-note">Изменения в этой карточке относятся только к одному уроку.</p>' : ''}${lesson.notes ? `<p class="notes-text">${esc(lesson.notes)}</p>` : ''}
    ${histories.length ? `<h3 class="detail-section-title">История переносов</h3><ol class="move-history">${histories.map(entry => `<li><span>${entry.fromDate ? dateLabel(entry.fromDate) + ' · ' + minutesToTime(entry.fromStart) : 'Без даты'}</span>${icon('arrow')}<strong>${entry.toDate ? dateLabel(entry.toDate) + ' · ' + minutesToTime(entry.toStart) : 'Ожидает времени'}</strong></li>`).join('')}</ol>` : ''}
    <div class="lesson-actions">${button('student', `${icon('users')}Карточка ученика`, 'button secondary', `data-id="${esc(lesson.studentId)}"`)}${lesson.status !== 'done' && lesson.status !== 'cancelled' ? button('move', `${icon('arrows')}Перенести`, 'button primary', `data-id="${esc(id)}"`) : ''}</div>
    <div class="lesson-secondary-actions">${lesson.status === 'planned' ? `${button('done', `${icon('check')}Отметить проведённым`, 'text-button', `data-id="${esc(id)}"`)}${button('pending', 'Время ещё не согласовано', 'text-button', `data-id="${esc(id)}"`)}${button('cancel', 'Отменить занятие', 'text-button danger-text', `data-id="${esc(id)}"`)}` : lesson.status === 'done' ? button('restore', 'Вернуть в запланированные', 'text-button', `data-id="${esc(id)}"`) : lesson.status === 'cancelled' ? button('restore', 'Восстановить занятие', 'text-button', `data-id="${esc(id)}"`) : ''}</div>`, 'lesson-details', lesson);
}

function moveForm(id, date) {
  const lesson = findLesson(id);
  if (!lesson) return;
  const student = studentOf(lesson.studentId);
  openModal(`<p class="eyebrow">РАЗОВЫЙ ПЕРЕНОС</p><h2 id="modal-title">Новое время занятия</h2><p class="modal-subtitle">${esc(student.name)} · ${lesson.date ? `Сейчас: ${dateLabel(lesson.date)} · ${interval(lesson)}` : 'Выбери дату и время.'}</p><form id="move-form">${field('date', 'Новая дата', 'date', date || lesson.date || today, 'required autofocus')}<div class="form-row">${field('start', 'Начало', 'time', minutesToTime(lesson.start), 'required')}${field('duration', 'Длительность, мин', 'number', lesson.duration, 'required min="5" max="480" step="5"')}</div><div class="form-info">${icon('info')}<span>Поменяется только этот урок. На следующей неделе останется обычное расписание.</span></div>${formError()}${formFooter('Сохранить перенос')}</form>`, 'move-form', lesson);
}

function checkConflict(lesson) {
  const week = projectWeek(state.data, mondayOf(lesson.date));
  const overlap = findConflict(lesson, week.lessons);
  if (overlap) throw new Error(`Это время пересекается с занятием: ${studentOf(overlap.studentId).name}, ${interval(overlap)}. Выбери другое время.`);
}

function submitForm(event) {
  if (!['student-form', 'lesson-form', 'move-form'].includes(event.target.id)) return;
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.target));
  try {
    if (event.target.id === 'student-form') {
      const record = validateStudent({ ...values, id: state.modal.record?.id || crypto.randomUUID() });
      save('students', record, state.modal.record ? 'Карточка ученика обновлена' : 'Ученик добавлен');
    } else if (event.target.id === 'lesson-form') {
      const lesson = validateLesson({ id: crypto.randomUUID(), studentId: values.studentId, date: values.date, start: timeToMinutes(values.start), duration: Number(values.duration), notes: values.notes.trim() }, state.data.students);
      checkConflict(lesson);
      if (values.repeat) {
        const conflictingSeries = findRecurringConflict(lesson, state.data);
        if (conflictingSeries) throw new Error(`Постоянное время уже занято: ${studentOf(conflictingSeries.studentId).name}. Выбери другое время.`);
        const series = { id: lesson.id, studentId: lesson.studentId, from: lesson.date, until: '', weekday: weekdayOf(lesson.date), start: lesson.start, duration: lesson.duration, notes: lesson.notes };
        save('series', series, 'Еженедельное занятие добавлено', lesson.date);
      } else {
        save('lessons', { ...lesson, seriesId: '', anchorDate: lesson.date, status: 'planned', history: [] }, 'Занятие добавлено', lesson.date);
      }
    } else {
      const lesson = moveLesson(state.modal.record, { date: values.date, start: timeToMinutes(values.start), duration: Number(values.duration) });
      checkConflict(lesson);
      save('lessons', lesson, 'Перенос сохранён. Остальные недели без изменений', lesson.date);
    }
  } catch (error) { document.querySelector('#form-error').textContent = error.message; }
}

function changeWeek(delta) {
  const offset = days().indexOf(state.selectedDate);
  state.week = addDays(state.week, delta * 7);
  state.selectedDate = addDays(state.week, Math.max(0, offset));
  render();
}

function exportData() {
  const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), mode: state.mode, data: state.data }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `uroki-${state.mode}-${today}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify('Резервная копия скачана');
}

function handleAction(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  event.preventDefault();
  const { action, id, date, view, student: studentId } = target.dataset;
  try {
    if (action === 'view') { state.view = view; state.query = ''; render(); }
    else if (action === 'prev-week') changeWeek(-1);
    else if (action === 'next-week') changeWeek(1);
    else if (action === 'today') { state.week = mondayOf(today); state.selectedDate = today; render(); }
    else if (action === 'select-day') { state.selectedDate = date; render(); }
    else if (action === 'new-student' || action === 'edit-student') studentForm(id);
    else if (action === 'student') studentDetails(id);
    else if (action === 'new-lesson') lessonForm(date || state.selectedDate, studentId);
    else if (action === 'lesson') lessonDetails(id);
    else if (action === 'move') moveForm(id, date);
    else if (action === 'close') closeModal();
    else if (action === 'personal' || action === 'demo') { closeModal(); loadMode(action === 'personal' ? 'personal' : 'demo'); notify(action === 'personal' ? 'Твоё расписание. Начни с добавления ученика' : 'Открыт отдельный пример расписания'); }
    else if (action === 'undo' && state.undo) { state.data = state.store.replace(state.undo); state.undo = null; closeModal(); render(); notify('Последнее изменение отменено'); }
    else if (action === 'export') exportData();
    else if (action === 'reset-demo' && confirm('Восстановить исходный пример? Изменения деморасписания будут заменены. Твоё расписание не изменится.')) { state.data = state.store.replace(createDemo(today)); state.undo = null; render(); notify('Пример восстановлен'); }
    else if (['pending', 'done', 'restore', 'cancel'].includes(action)) {
      const lesson = findLesson(id);
      if (!lesson) return;
      if (action === 'cancel' && !confirm('Отменить только это занятие? Запись об отмене сохранится.')) return;
      const next = action === 'pending' ? moveLesson(lesson, { date: null, start: lesson.start, duration: lesson.duration }) : { ...lesson, status: action === 'done' ? 'done' : action === 'cancel' ? 'cancelled' : 'planned' };
      if (action === 'restore') checkConflict(next);
      save('lessons', next, action === 'pending' ? 'Урок ждёт нового времени' : action === 'done' ? 'Занятие отмечено проведённым' : action === 'cancel' ? 'Занятие отменено' : 'Занятие восстановлено');
    }
  } catch (error) { notify(error.message); }
}

document.addEventListener('click', handleAction);
document.addEventListener('submit', submitForm);
document.addEventListener('input', event => { if (event.target.id === 'search') { state.query = event.target.value; render(); } });
document.addEventListener('change', event => { if (event.target.id === 'show-ghosts') { state.ghosts = event.target.checked; render(); } });
modal.addEventListener('click', event => { if (event.target === modal) { const rect = modal.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeModal(); } });
modal.addEventListener('close', () => { state.modal = null; });
document.addEventListener('dragstart', event => {
  const card = event.target.closest('[data-draggable]');
  if (!card || card.draggable === false) return;
  state.dragId = card.dataset.draggable;
  event.dataTransfer.setData('text/plain', state.dragId);
  event.dataTransfer.effectAllowed = 'move';
  card.classList.add('dragging');
});
document.addEventListener('dragover', event => {
  const lane = event.target.closest('[data-drop]');
  if (!state.dragId || !lane) return;
  event.preventDefault(); event.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.drop-target').forEach(item => { if (item !== lane) item.classList.remove('drop-target'); });
  lane.classList.add('drop-target');
});
document.addEventListener('drop', event => {
  const lane = event.target.closest('[data-drop]');
  if (!state.dragId || !lane) return;
  event.preventDefault();
  const id = state.dragId;
  state.dragId = null;
  document.querySelectorAll('.drop-target, .dragging').forEach(item => item.classList.remove('drop-target', 'dragging'));
  if (lane.dataset.drop === 'pending') {
    const lesson = findLesson(id);
    try { save('lessons', moveLesson(lesson, { date: null, start: lesson.start, duration: lesson.duration }), 'Урок ждёт нового времени'); }
    catch (error) { notify(error.message); }
  } else moveForm(id, lane.dataset.drop);
});
document.addEventListener('dragend', () => { state.dragId = null; document.querySelectorAll('.drop-target, .dragging').forEach(item => item.classList.remove('drop-target', 'dragging')); });
window.addEventListener('storage', event => {
  if (event.key !== `tutor-schedule:${state.mode}:v1`) return;
  try { closeModal(); loadMode(state.mode); notify('Расписание обновлено из другой вкладки'); }
  catch (error) { notify(error.message); }
});

try { loadMode(localStorage.getItem('tutor-schedule:mode') === 'personal' ? 'personal' : 'demo'); }
catch (error) {
  root.innerHTML = `<main class="startup-error"><h1>Не удалось открыть расписание</h1><p>${esc(error.message)}</p><p>Сохранённые данные не изменены. Не очищай данные сайта, если хочешь сохранить записи.</p><button class="button secondary" onclick="location.reload()">Попробовать снова</button></main>`;
}
