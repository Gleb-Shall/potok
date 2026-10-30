import { addDays, mondayOf } from './domain.js';

export function createDemo(today) {
  const monday = mondayOf(today);
  // Entirely synthetic fixtures; never copy students or contacts into this file.
  const names = [
    ['student-1', 'Ученик 1', 'ЕГЭ · математика', 'violet', 1500],
    ['student-2', 'Ученик 2', 'ОГЭ · математика', 'blue', 1400],
    ['student-3', 'Ученик 3', '7 класс', 'green', 1200]
  ];
  const students = names.map(([id, name, subject, color, rate]) => ({ id, name, subject, color, rate, contact: '', notes: '' }));
  const slots = [
    ['student-1', 2, 600], ['student-2', 2, 690], ['student-3', 3, 900],
    ['student-1', 5, 840], ['student-2', 6, 600]
  ];
  const series = slots.map(([studentId, weekday, start], index) => ({ id: `demo-${index}`, studentId, weekday,
    start, duration: 60, from: monday, until: '', notes: '' }));
  const originalDate = addDays(monday, 4);
  const lessons = [{ id: `demo-3:${originalDate}`, seriesId: 'demo-3', anchorDate: originalDate,
    studentId: 'student-1', date: addDays(monday, 6), start: 660, duration: 60, status: 'planned', notes: 'Пример разового переноса',
    originalDate, originalStart: 840, originalDuration: 60,
    history: [{ fromDate: originalDate, fromStart: 840, toDate: addDays(monday, 6), toStart: 660, at: new Date().toISOString() }] }];
  return { students, series, lessons };
}
