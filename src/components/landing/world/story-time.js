// Scroll distances in viewport heights. Dwell ranges keep each screen usable.
export const STORY = Object.freeze({
  calendarIn: 1.05,
  calendarOut: 1.8,
  editorIn: 3,
  editorOut: 3.75,
  recordsIn: 4.95,
  end: 5.6,
});
export const STORY_STOPS = { calendar: STORY.calendarIn, editor: STORY.editorIn, records: STORY.recordsIn };
export const clamp = value => Math.max(0, Math.min(1, value));
export const progress = (start, end, value) => clamp((value - start) / (end - start));
export const smooth = (start, end, value) => {
  const t = progress(start, end, value);
  return t * t * (3 - 2 * t);
};
