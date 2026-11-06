// Minutes and layout are independent of DOM, event editing and persistence.
export const HOUR_HEIGHT = 76;
export const TIME_STEP = 15;

export function weekBounds(events, from = 0, to = 24) {
  const dated = events.filter(event => Number.isFinite(event.start) && Number.isFinite(event.duration));
  return {
    start: Math.max(0, Math.min(from * 60, ...dated.map(event => Math.floor(event.start / 60) * 60))),
    end: Math.min(1440, Math.max(to * 60, ...dated.map(event => Math.ceil((event.start + event.duration) / 60) * 60))),
  };
}

// Each connected overlap group shares its maximum number of tracks.
// Adjacent events can use the same track; ghosts are laid out separately.
export function layoutDay(events) {
  const sorted = [...events].sort((a,b) => a.start-b.start || b.duration-a.duration || a.id.localeCompare(b.id));
  const result = [];
  let group = [], ends = [], until = -1;
  const flush = () => {
    for(const item of group) result.push({...item, columns:ends.length});
    group = []; ends = []; until = -1;
  };
  for(const event of sorted) {
    if(group.length && event.start >= until) flush();
    let column = ends.findIndex(end => end <= event.start);
    if(column < 0) column = ends.length;
    ends[column] = event.start + event.duration;
    until = Math.max(until, ends[column]);
    group.push({event, column});
  }
  flush();
  return result;
}

export const timeTarget = (date,start) => `${date}@${start}`;
export function readTimeTarget(target) {
  const match = /^(\d{4}-\d{2}-\d{2})(?:@(\d{1,4}))?$/.exec(target || '');
  if(!match) return null;
  const start = match[2] === undefined ? null : Number(match[2]);
  return start !== null && start >= 1440 ? null : {date:match[1], start};
}
export function minuteAt(y, top, height, start, end, duration = TIME_STEP) {
  const minute = start + (y-top) / Math.max(1,height) * (end-start);
  const latest = Math.floor(Math.min(end-duration,1440-duration) / TIME_STEP) * TIME_STEP;
  return Math.max(start, Math.min(latest, Math.round(minute/TIME_STEP)*TIME_STEP));
}
export function timelineDropTarget(point, duration, grabOffset = 0) {
  const lane = document.elementFromPoint(point.x,point.y)?.closest('[data-time-date]');
  if(!lane) return null;
  const rect = lane.getBoundingClientRect();
  return timeTarget(lane.dataset.timeDate,minuteAt(point.y-grabOffset/(Number(lane.dataset.timeEnd)-Number(lane.dataset.timeStart))*rect.height,rect.top,rect.height,Number(lane.dataset.timeStart),Number(lane.dataset.timeEnd),duration));
}
