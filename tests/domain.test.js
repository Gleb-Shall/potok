import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, mondayOf, timeToMinutes, minutesToTime, validateStudent,
  validateLesson, projectWeek, moveLesson, findConflict } from '../public/domain.js';

const student = { id: 'student-a', name: 'Тестовый ученик', subject: 'ЕГЭ', rate: 1500, contact: '', notes: '', color: 'violet' };
const series = { id: 'weekly', studentId: 'student-a', from: '2026-10-26', until: '', weekday: 5, start: 1020, duration: 60, notes: '' };
const base = () => ({ students: [student], series: [series], lessons: [] });

test('calendar arithmetic works across months, years and leap days', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(mondayOf('2026-11-01'), '2026-10-26');
  assert.throws(() => addDays('2026-02-30', 1));
});
test('time fields reject invalid hours and preserve half hours', () => {
  assert.equal(timeToMinutes('15:30'), 930);
  assert.equal(minutesToTime(930), '15:30');
  assert.throws(() => timeToMinutes('25:00'));
  assert.throws(() => minutesToTime(-1));
});
test('student validation normalizes strings and rejects blank names or negative rates', () => {
  assert.equal(validateStudent({ ...student, name: '  Тестовый ученик  ' }).name, 'Тестовый ученик');
  assert.throws(() => validateStudent({ ...student, name: '  ' }));
  assert.throws(() => validateStudent({ ...student, rate: -1 }));
});
test('lessons require an existing student and a valid interval within one day', () => {
  assert.doesNotThrow(() => validateLesson({ studentId: 'student-a', date: '2026-10-30', start: 1020, duration: 60 }, [student]));
  for (const change of [{ studentId: 'missing' }, { date: '2026-02-30' }, { duration: 0 }, { start: 1430 }]) {
    assert.throws(() => validateLesson({ studentId: 'student-a', date: '2026-10-30', start: 1020, duration: 60, ...change }, [student]));
  }
});
test('weekly schedule is projected only inside its start and end dates', () => {
  assert.equal(projectWeek(base(), '2026-10-26').lessons[0].date, '2026-10-30');
  assert.equal(projectWeek(base(), '2026-10-19').lessons.length, 0);
  assert.equal(projectWeek({ ...base(), series: [{ ...series, until: '2026-10-29' }] }, '2026-10-26').lessons.length, 0);
});
test('one-time move keeps original time, creates a ghost and leaves next week unchanged', () => {
  const data = base();
  const lesson = projectWeek(data, '2026-10-26').lessons[0];
  const moved = moveLesson(lesson, { date: '2026-11-01', start: 660, duration: 60 });
  const next = { ...data, lessons: [moved] };
  const week = projectWeek(next, '2026-10-26');
  assert.equal(week.lessons.length, 1);
  assert.equal(week.lessons[0].date, '2026-11-01');
  assert.equal(week.ghosts[0].date, '2026-10-30');
  assert.equal(week.ghosts[0].start, 1020);
  assert.equal(projectWeek(next, '2026-11-02').lessons[0].start, 1020);
  assert.equal(data.lessons.length, 0);
});
test('move into a different week hides source and shows destination exactly once', () => {
  const lesson = projectWeek(base(), '2026-10-26').lessons[0];
  const moved = moveLesson(lesson, { date: '2026-11-03', start: 600, duration: 60 });
  const next = { ...base(), lessons: [moved] };
  assert.equal(projectWeek(next, '2026-10-26').lessons.length, 0);
  assert.equal(projectWeek(next, '2026-11-02').lessons.length, 2);
});
test('repeated moves keep original lesson identity and the complete history', () => {
  const lesson = projectWeek(base(), '2026-10-26').lessons[0];
  const first = moveLesson(lesson, { date: '2026-11-01', start: 660, duration: 60 });
  const second = moveLesson(first, { date: '2026-11-02', start: 720, duration: 90 });
  assert.equal(first.id, second.id);
  assert.equal(second.originalDate, '2026-10-30');
  assert.equal(second.originalStart, 1020);
  assert.equal(second.history.length, 2);
  assert.equal(second.history[1].fromDate, '2026-11-01');
  assert.equal(first.history.length, 1);
});
test('unscheduled lesson stays pending until a new date is chosen', () => {
  const lesson = projectWeek(base(), '2026-10-26').lessons[0];
  const pending = moveLesson(lesson, { date: null, start: lesson.start, duration: 60 });
  const projection = projectWeek({ ...base(), lessons: [pending] }, '2026-10-26');
  assert.equal(projection.lessons.length, 0);
  assert.equal(projection.pending.length, 1);
  const restored = moveLesson(pending, { date: '2026-11-01', start: 660, duration: 60 });
  assert.equal(restored.status, 'planned');
});
test('cancelled lesson creates a reference but never occupies its time', () => {
  const lesson = projectWeek(base(), '2026-10-26').lessons[0];
  const projection = projectWeek({ ...base(), lessons: [{ ...lesson, status: 'cancelled' }] }, '2026-10-26');
  assert.equal(projection.lessons.length, 0);
  assert.equal(projection.ghosts.length, 1);
});
test('one-off lessons are included and moves within a day retain the old time', () => {
  const once = { id: 'once', studentId: 'student-a', seriesId: '', anchorDate: '2026-10-30', date: '2026-10-30', start: 600, duration: 60, status: 'planned', notes: '', history: [] };
  const moved = moveLesson(once, { date: '2026-10-30', start: 720, duration: 60 });
  const week = projectWeek({ ...base(), series: [], lessons: [moved] }, '2026-10-26');
  assert.equal(week.lessons[0].start, 720);
  assert.equal(week.ghosts[0].start, 600);
});
test('overlap detection allows adjacent lessons and ignores the edited lesson', () => {
  const lesson = projectWeek(base(), '2026-10-26').lessons[0];
  assert.equal(findConflict({ ...lesson, id: 'new', start: 1080 }, [lesson]), undefined);
  assert.equal(findConflict({ ...lesson, id: 'new', start: 1050 }, [lesson]).id, lesson.id);
  assert.equal(findConflict(lesson, [lesson]), undefined);
});
