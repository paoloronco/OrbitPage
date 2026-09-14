import type { MenuItem, MenuSection } from '@/lib/menu';

function move<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function moveTo<T>(items: T[], sourceIndex: number, targetIndex: number) {
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return items;
  const next = [...items];
  const [selected] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, selected);
  return next;
}

export function sectionSiblings(sections: MenuSection[], parentId?: string) {
  return sections
    .filter((section) => section.parentId === parentId)
    .sort((a, b) => a.position - b.position);
}

export function orderedSectionTree(sections: MenuSection[]) {
  return sectionSiblings(sections).flatMap((section) => [section, ...sectionSiblings(sections, section.id)]);
}

export function moveMenuSection(sections: MenuSection[], sectionId: string, direction: -1 | 1) {
  const selected = sections.find((section) => section.id === sectionId);
  if (!selected) return sections;
  const siblings = sectionSiblings(sections, selected.parentId);
  const reordered = move(siblings, siblings.findIndex((section) => section.id === sectionId), direction);
  if (reordered === siblings) return sections;
  const positions = new Map(reordered.map((section, position) => [section.id, position]));
  return orderedSectionTree(sections.map((section) => positions.has(section.id)
    ? { ...section, position: positions.get(section.id)! }
    : section)).map((section, position) => ({ ...section, position }));
}

export function reorderMenuSections(sections: MenuSection[], sourceId: string, targetId: string) {
  const source = sections.find((section) => section.id === sourceId);
  const target = sections.find((section) => section.id === targetId);
  if (!source || !target || source.parentId !== target.parentId) return sections;
  const siblings = sectionSiblings(sections, source.parentId);
  const reordered = moveTo(
    siblings,
    siblings.findIndex((section) => section.id === sourceId),
    siblings.findIndex((section) => section.id === targetId),
  );
  if (reordered === siblings) return sections;
  const positions = new Map(reordered.map((section, position) => [section.id, position]));
  return orderedSectionTree(sections.map((section) => positions.has(section.id)
    ? { ...section, position: positions.get(section.id)! }
    : section)).map((section, position) => ({ ...section, position }));
}

export function reorderMenuItems(items: MenuItem[], sourceId: string, targetId: string) {
  const source = items.find((item) => item.id === sourceId);
  const target = items.find((item) => item.id === targetId);
  if (!source || !target || source.sectionId !== target.sectionId) return items;
  const siblings = items.filter((item) => item.sectionId === source.sectionId);
  const reordered = moveTo(
    siblings,
    siblings.findIndex((item) => item.id === sourceId),
    siblings.findIndex((item) => item.id === targetId),
  );
  if (reordered === siblings) return items;
  let replacementIndex = 0;
  return items.map((item) => item.sectionId === source.sectionId ? reordered[replacementIndex++] : item)
    .map((item, position) => ({ ...item, position }));
}
