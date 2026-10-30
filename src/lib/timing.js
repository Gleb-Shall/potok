import { timeToMinutes, minutesToTime } from './domain.js';

export function eventEnd(start, duration) {
  try {
    if (duration === '' || !Number.isInteger(Number(duration))) return '';
    const end = timeToMinutes(start) + Number(duration);
    return end >= 0 && end <= 1440 ? end === 1440 ? '00:00' : minutesToTime(end) : '';
  } catch { return ''; }
}

export function updateTiming(current, key, value) {
  if (key === 'end') {
    let duration = '';
    try { const start = timeToMinutes(current.start); let end = timeToMinutes(value); if (end === 0) end = 1440; duration = end - start; } catch { /* Keep incomplete input editable. */ }
    return { end: value, duration };
  }
  const start = key === 'start' ? value : current.start;
  const duration = key === 'duration' ? value : current.duration;
  return { [key]: value, end: eventEnd(start, duration) };
}
