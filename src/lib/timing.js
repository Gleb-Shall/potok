import { addDays, timeToMinutes, minutesToTime } from './domain.js';

export const DAY_MINUTES = 1440;

export function validEventTiming(start, duration, minimum = 5) {
  return Number.isInteger(start) && start >= 0 && start < DAY_MINUTES &&
    Number.isInteger(duration) && duration >= minimum && duration <= DAY_MINUTES;
}

export function endsNextDay(start, duration) {
  return start + duration >= DAY_MINUTES;
}

export function eventTimeRange(start, duration) {
  const nextDay = endsNextDay(start, duration);
  return `${minutesToTime(start)}–${minutesToTime((start + duration) % DAY_MINUTES)}${nextDay ? ' (+1 день)' : ''}`;
}

export function calendarSlotsByDay(events) {
  const days = new Map();
  const append = (date, slot) => {
    if (!days.has(date)) days.set(date, []);
    days.get(date).push(slot);
  };
  for (const event of events) {
    if (!event.date) continue;
    const duration = Math.min(event.duration, DAY_MINUTES - event.start);
    append(event.date, {event, id:event.id, start:event.start, duration, continuation:false});
    if (duration < event.duration) {
      append(addDays(event.date, 1), {event, id:event.id, start:0, duration:event.duration-duration, continuation:true});
    }
  }
  return days;
}

export function eventEnd(start, duration) {
  try {
    if (duration === '' || !Number.isInteger(Number(duration))) return '';
    const minutes = Number(duration);
    return minutes >= 0 && minutes <= DAY_MINUTES ? minutesToTime((timeToMinutes(start) + minutes) % DAY_MINUTES) : '';
  } catch { return ''; }
}

export function updateTiming(current, key, value) {
  if (key === 'end') {
    let duration = '';
    try {
      duration = timeToMinutes(value) - timeToMinutes(current.start);
      if (duration <= 0) duration += DAY_MINUTES;
    } catch { /* Keep incomplete input editable. */ }
    return { end: value, duration };
  }
  const start = key === 'start' ? value : current.start;
  const duration = key === 'duration' ? value : current.duration;
  return { [key]: value, end: eventEnd(start, duration) };
}
