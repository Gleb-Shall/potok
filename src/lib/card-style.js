export const CARD_VIEWS = {
  short: 'Короткое событие', grid: 'Час в сетке', board: 'Доска', expanded: 'Развёрнутая карточка',
};

const clamp = (value, fallback, min, max) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
export const defaultCardSlot = (field, view) => {
  const shown = view === 'expanded' ? field.showOnCard !== false :
    view !== 'short' && (field.showCompact ?? (field.type === 'url' && field.showOnCard !== false));
  return shown ? field.type === 'url' ? 'link' : 'line' : 'hidden';
};

export function readCardStyle(type) {
  const source = type.cardStyle || {};
  const fields = new Map(type.fields.filter(field => !field.archived).map(field => [field.id, field]));
  const layouts = Object.fromEntries(Object.keys(CARD_VIEWS).flatMap(view => {
    const entries = source.layouts?.[view];
    if (!Array.isArray(entries)) return [];
    const seen = new Set();
    return [[view, entries.flatMap(entry => {
      const field = fields.get(entry?.id);
      if (!field || seen.has(field.id)) return [];
      seen.add(field.id);
      const allowed = field.type === 'url' ? ['link', 'hidden'] : ['line', 'badge', 'hidden'];
      return [{ id: field.id, slot: allowed.includes(entry.slot) ? entry.slot : 'hidden' }];
    })]];
  }));
  return {
    tint: typeof source.tint === 'string' && /^#[0-9a-f]{6}$/i.test(source.tint) ? source.tint : '',
    opacity: clamp(source.opacity, 100, 0, 100),
    smoke: source.smoke !== false,
    liveText: source.liveText !== false,
    layouts,
  };
}

export function cardComposition(type, view, style = readCardStyle(type)) {
  const entries = style.layouts[view];
  const fields = type.fields.filter(field => !field.archived);
  if (!entries) return fields.map(field => ({field, slot: defaultCardSlot(field, view)}));
  const byId = new Map(fields.map(field => [field.id, field]));
  const configured = entries.map(({id,slot}) => ({field:byId.get(id),slot}));
  const seen = new Set(entries.map(({id}) => id));
  return [...configured, ...fields.filter(field => !seen.has(field.id)).map(field => ({field, slot:'hidden'}))];
}
