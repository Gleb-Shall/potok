// Scroll distances in viewport heights. Dwell ranges keep each screen usable.
export const STORY = Object.freeze({
  entryStart: -.45,
  calendarLand: 1.3,
  calendarIn: 1.8,
  calendarOut: 2.5,
  editorIn: 3.7,
  editorOut: 4.45,
  recordsIn: 5.65,
  end: 6.3,
});
export const STORY_STOPS = { calendar: STORY.calendarIn, editor: STORY.editorIn, records: STORY.recordsIn };
// A single short pinned entrance on phones; the remaining sections scroll normally.
export const MOBILE_STORY = Object.freeze({ entryStart: -.3, calendarLand: .85, calendarIn: 1.2 });
export const clamp = value => Math.max(0, Math.min(1, value));
export const progress = (start, end, value) => clamp((value - start) / (end - start));
export const smooth = (start, end, value) => {
  const t = progress(start, end, value);
  return t * t * (3 - 2 * t);
};
