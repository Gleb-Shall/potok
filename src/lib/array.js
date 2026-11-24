export function sortedCopy(items, compare) {
  return items.toSorted?.(compare) ?? items.slice().sort(compare);
}
