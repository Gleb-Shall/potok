const DAY_MS = 86_400_000;
export const COLORS = ['violet', 'blue', 'green', 'peach', 'pink'];

function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Выбери дату.');
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('Некорректная дата.');
  return date;
}

export function todayISO() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(new Date());
}

export function addDays(value, count) {
  const date = parseDate(value);
  return new Date(date.getTime() + count * DAY_MS).toISOString().slice(0, 10);
}

export function mondayOf(value) {
  const date = parseDate(value);
  return addDays(value, -((date.getUTCDay() + 6) % 7));
}

export function weekdayOf(value) { return parseDate(value).getUTCDay(); }

export function timeToMinutes(value) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('Выбери время в формате ЧЧ:ММ.');
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(value) {
  if (!Number.isInteger(value) || value < 0 || value > 1440) throw new Error('Некорректное время.');
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

export function validateStudent(value) {
  const student = { ...value, name: value.name?.trim(), subject: (value.subject || '').trim(),
    contact: (value.contact || '').trim(), notes: (value.notes || '').trim(), rate: Number(value.rate) };
  if (!student.name || student.name.length > 100) throw new Error('Укажи имя ученика, не длиннее 100 символов.');
  if (!Number.isFinite(student.rate) || student.rate < 0 || student.rate > 1_000_000) throw new Error('Укажи стоимость от 0 до 1 000 000 ₽.');
  if (student.subject.length > 100 || student.contact.length > 500 || student.notes.length > 5000) throw new Error('Слишком длинное описание.');
  if (!COLORS.includes(student.color)) student.color = 'violet';
  return student;
}

export function validateLesson(lesson, students) {
  if (!students.some(student => student.id === lesson.studentId)) throw new Error('Сначала выбери ученика.');
  parseDate(lesson.date);
  if (!Number.isInteger(lesson.start) || !Number.isInteger(lesson.duration) || lesson.start < 0 || lesson.duration < 5 || lesson.start + lesson.duration > 1440) {
    throw new Error('Проверь время и длительность: занятие должно закончиться в тот же день.');
  }
  if ((lesson.notes || '').length > 5000) throw new Error('Заметка слишком длинная.');
  return lesson;
}

function fromSeries(series, date) {
  return { id: `${series.id}:${date}`, seriesId: series.id, anchorDate: date, studentId: series.studentId,
    date, start: series.start, duration: series.duration, status: 'planned', notes: series.notes || '', history: [] };
}

/** Recurring slots are projected; only one-off lessons and exceptions are stored. */
export function projectWeek(data, weekStart) {
  const dates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const weekEnd = dates[6];
  const inWeek = date => Boolean(date && date >= weekStart && date <= weekEnd);
  const overrides = new Map(data.lessons.map(lesson => [lesson.id, lesson]));
  const candidates = new Map();
  for (const series of data.series) {
    for (const date of dates) {
      if (date < series.from || (series.until && date > series.until) || weekdayOf(date) !== series.weekday) continue;
      const occurrence = fromSeries(series, date);
      candidates.set(occurrence.id, overrides.get(occurrence.id) || occurrence);
    }
  }
  for (const lesson of data.lessons) candidates.set(lesson.id, lesson);
  const lessons = [];
  const pending = [];
  const ghosts = [];
  for (const lesson of candidates.values()) {
    if (lesson.status === 'pending') pending.push(lesson);
    else if (lesson.status !== 'cancelled' && inWeek(lesson.date)) lessons.push(lesson);
    const originalDate = lesson.originalDate || lesson.anchorDate || lesson.date;
    const originalStart = lesson.originalStart ?? lesson.start;
    const changed = lesson.date !== originalDate || lesson.start !== originalStart || ['pending', 'cancelled'].includes(lesson.status);
    if (changed && inWeek(originalDate)) ghosts.push({ ...lesson, date: originalDate, start: originalStart, ghost: true });
  }
  const sort = (a, b) => (a.date || '').localeCompare(b.date || '') || a.start - b.start || a.id.localeCompare(b.id);
  return { lessons: lessons.sort(sort), pending: pending.sort(sort), ghosts: ghosts.sort(sort) };
}

export function moveLesson(lesson, target) {
  if (target.date !== null) {
    parseDate(target.date);
    if (!Number.isInteger(target.start) || !Number.isInteger(target.duration) || target.start < 0 || target.duration < 5 || target.start + target.duration > 1440) {
      throw new Error('Проверь время и длительность занятия.');
    }
  }
  return { ...lesson, date: target.date, start: target.start, duration: target.duration,
    originalDate: lesson.originalDate || lesson.anchorDate || lesson.date,
    originalStart: lesson.originalStart ?? lesson.start,
    originalDuration: lesson.originalDuration ?? lesson.duration,
    status: target.date === null ? 'pending' : 'planned',
    history: [...(lesson.history || []), { fromDate: lesson.date, fromStart: lesson.start,
      toDate: target.date, toStart: target.start, at: new Date().toISOString() }] };
}

export function findConflict(candidate, lessons) {
  return lessons.find(lesson => lesson.id !== candidate.id && lesson.date === candidate.date &&
    !['cancelled', 'pending'].includes(lesson.status) && candidate.start < lesson.start + lesson.duration &&
    candidate.start + candidate.duration > lesson.start);
}

export function findRecurringConflict() { throw new Error('Not implemented'); }
