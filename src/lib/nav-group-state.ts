type NavGroup = {
  label: string;
  links: readonly { href: string }[];
};

export function isNavGroupActive(group: NavGroup, activeHref: string | undefined): boolean {
  return Boolean(activeHref && group.links.some((link) => link.href === activeHref));
}

export function getOpenNavGroupLabels(
  groups: readonly NavGroup[],
  activeHref: string | undefined,
  previous?: ReadonlySet<string>,
): Set<string> {
  const next = new Set(previous);
  for (const group of groups) {
    if (isNavGroupActive(group, activeHref)) next.add(group.label);
  }
  if (!previous && next.size === 0 && groups.length > 0) {
    next.add(groups[0].label);
  }
  return next;
}

export function toggleNavGroup(previous: ReadonlySet<string>, label: string): Set<string> {
  const next = new Set(previous);
  if (next.has(label)) next.delete(label);
  else next.add(label);
  return next;
}

export function isNavGroupOpen(
  label: string,
  groupCount: number,
  sidebarCollapsed: boolean,
  openLabels: ReadonlySet<string>,
): boolean {
  return groupCount <= 1 || sidebarCollapsed || openLabels.has(label);
}
