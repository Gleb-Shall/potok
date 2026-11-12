import { assertNoConflict, eventTitle } from './events.js';

const entities = {
  students: item => item.id,
  records: item => item.id,
  types: item => item.id,
  recordTypes: item => item.kind,
  series: item => item.id,
  events: item => item.id,
  eventArchive: item => JSON.stringify([item.archiveKind, item.id]),
  reminders: item => item.id,
  eventAlerts: item => item.id,
  tasks: item => item.id,
  archivedRecordKinds: item => item,
  deletedRecordKinds: item => item,
};

export function sameValue(a, b) {
  if (a === b) return true;
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && sameValue(a[key], b[key]));
}

const payload = ({ revision, ...data }) => data;
export const sameWorkspace = (a, b) => sameValue(payload(a), payload(b));

const timeKeys = ['date', 'from', 'until', 'start', 'duration', 'busy', 'status', 'weekday', 'intervalWeeks', 'excludedDates'];
const changedTime = (before, after) => {
  const original = new Map(before.map(item => [item.id, item]));
  return after.filter(item => {
    const previous = original.get(item.id);
    return !previous || timeKeys.some(key => !sameValue(previous[key], item[key]));
  });
};

function timeConflict(data, item, series) {
  if (item.busy === false || item.archived || ['pending', 'cancelled'].includes(item.status)) return false;
  try {
    if (series) {
      const others = { ...data, series: data.series.filter(value => value.id !== item.id),
        events: data.events.filter(value => value.seriesId !== item.id) };
      assertNoConflict(others, { ...item, date: item.from }, item);
    } else if (item.date) assertNoConflict(data, item);
    return false;
  } catch { return true; }
}

function findNewOverlap(base, local, cloud, merged) {
  const sides = [local, cloud];
  const edits = sides.map(side => ({
    events: changedTime(base.events, side.events),
    series: changedTime(base.series, side.series),
  }));
  if (edits.some(edit => !edit.events.length && !edit.series.length)) return null;
  for (const [index, edit] of edits.entries()) {
    for (const section of ['events', 'series']) {
      const items = new Map(merged[section].map(item => [item.id, item]));
      for (const item of edit[section]) {
        const result = items.get(item.id);
        const series = section === 'series';
        if (result && sameValue(result, item) && timeConflict(merged, result, series) && !timeConflict(sides[index], item, series)) return result;
      }
    }
  }
  return null;
}

function removedSource(base, changed) {
  return ['types', 'recordTypes', 'students', 'records', 'series'].some(key => {
    const remaining = new Map((changed[key] || []).map(item => [entities[key](item), item]));
    return (base[key] || []).some(item => !remaining.has(entities[key](item)) ||
      (!item.archived && remaining.get(entities[key](item)).archived));
  }) || (changed.archivedRecordKinds || []).some(kind => !base.archivedRecordKinds?.includes(kind));
}

// Merge whole entities by stable identity. Destructive edits to shared sources
// can also affect events created on another device, so review them as a whole.
export function mergeWorkspace(base, local, cloud, preference) {
  if (sameWorkspace(local, cloud) || sameWorkspace(local, base)) return { data: cloud, conflicts: [] };
  if (sameWorkspace(cloud, base)) return { data: local, conflicts: [] };
  if (removedSource(base, local) || removedSource(base, cloud)) {
    return { data: preference === 'local' ? local : cloud, conflicts: [{ label: 'Связанные шаблоны и записи' }], wholeWorkspace: true };
  }

  const conflicts = [];
  const choose = (original, mine, theirs, section) => {
    if (sameValue(mine, theirs) || sameValue(mine, original)) return theirs;
    if (sameValue(theirs, original)) return mine;
    conflicts.push({ label: mine?.title || mine?.name || theirs?.title || theirs?.name || section });
    return preference === 'local' ? mine : theirs;
  };
  const fields = [['revision', cloud.revision]];
  for (const key of new Set([...Object.keys(cloud), ...Object.keys(local), ...Object.keys(base)])) {
    if (key === 'revision') continue;
    const original = base[key], mine = local[key], theirs = cloud[key];
    const identity = Object.hasOwn(entities, key) ? entities[key] : undefined;
    let value;
    if (identity || key === 'cardBackgrounds') {
      const entries = (items) => new Map(identity
        ? (items || []).map(item => [identity(item), item])
        : Object.entries(items || {}));
      const before = entries(original), left = entries(mine), right = entries(theirs);
      // Leave cloud order intact and append entities created locally.
      const merged = [...new Set([...right.keys(), ...left.keys(), ...before.keys()])].flatMap(id => {
        const item = choose(before.get(id), left.get(id), right.get(id), 'Данные расписания');
        return item === undefined ? [] : [[id, item]];
      });
      if (merged.length || mine !== undefined || theirs !== undefined) value = identity ? merged.map(([, item]) => item) : Object.fromEntries(merged);
    } else value = choose(original, mine, theirs, 'Настройки расписания');
    if (value !== undefined) fields.push([key, value]);
  }
  const data = Object.fromEntries(fields);
  const overlap = findNewOverlap(base, local, cloud, data);
  if (overlap) return {
    data: preference === 'local' ? local : cloud,
    conflicts: [{ label: eventTitle(data, overlap) }],
    wholeWorkspace: true,
    reason: 'overlap',
  };
  return { data, conflicts };
}

export function planWorkspaceSync(entry, fresh, conflict, preference) {
  if (!entry?.draft) return { data: fresh };
  const reviewed = preference && conflict?.revision === fresh.revision && conflict.version === entry.version;
  const merged = mergeWorkspace(entry.base, entry.draft, fresh, reviewed ? preference : undefined);
  if (merged.conflicts.length && (!reviewed || (merged.wholeWorkspace && merged.reason !== conflict.reason))) {
    return { conflict: {
      revision: fresh.revision,
      version: entry.version,
      items: merged.conflicts,
      wholeWorkspace: merged.wholeWorkspace,
      reason: merged.reason,
    } };
  }
  return { data: merged.data };
}

export function checkpointWorkspace(current, uploaded, confirmed) {
  if (current && current.base.revision > confirmed.revision) return current;
  if (!current?.draft) {
    return current?.base.revision === confirmed.revision ? current : { base: confirmed, draft: null };
  }
  if (current.version === uploaded?.version) return { base: confirmed, draft: null };
  const rebased = mergeWorkspace(uploaded?.draft || current.base, current.draft, confirmed);
  if (rebased.conflicts.length) return current;
  return { base: confirmed, draft: sameWorkspace(rebased.data, confirmed) ? null : rebased.data };
}

export const workspaceCacheKey = (scope, userId) => 'potok:workspace:v1:' + JSON.stringify([scope, userId]);
export const readWorkspaceCache = key => JSON.parse(localStorage.getItem(key));
export const visibleWorkspace = entry => ({ ...(entry.draft || entry.base), revision: entry.version });

export function updateWorkspaceCache(key, update) {
  const change = () => {
    const entry = readWorkspaceCache(key);
    const next = update(entry);
    if (next === entry) return entry;
    const version = !entry ? next.base.revision :
      entry.version + Number(!sameWorkspace(entry.draft || entry.base, next.draft || next.base));
    const saved = { ...next, version };
    try { localStorage.setItem(key, JSON.stringify(saved)); }
    catch { throw new Error('Не удалось сохранить копию на устройстве. Проверь свободное место.'); }
    return saved;
  };
  return typeof navigator.locks?.request === 'function' ? navigator.locks.request(key, change) : Promise.resolve().then(change);
}
