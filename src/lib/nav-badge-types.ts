export type NavBadgeTone = "count" | "pending";

export type NavBadge = {
  value: string;
  label: string;
  tone: NavBadgeTone;
};

export type NavBadgeMap = Partial<Record<string, NavBadge>>;
