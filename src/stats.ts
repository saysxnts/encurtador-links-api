import type { Link } from "./types.js";

export interface LinkStats {
  slug: string;
  totalClicks: number;
  lastClickAt: string | null;
  clicksByDay: Record<string, number>;
  topReferrers: { referrer: string; clicks: number }[];
}

export function buildStats(link: Link, topN = 5): LinkStats {
  const clicksByDay: Record<string, number> = {};
  const referrers = new Map<string, number>();

  for (const click of link.clicks) {
    const day = click.at.slice(0, 10);
    clicksByDay[day] = (clicksByDay[day] ?? 0) + 1;
    const ref = click.referrer ?? "direto";
    referrers.set(ref, (referrers.get(ref) ?? 0) + 1);
  }

  const topReferrers = [...referrers.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([referrer, clicks]) => ({ referrer, clicks }));

  return {
    slug: link.slug,
    totalClicks: link.clicks.length,
    lastClickAt: link.clicks.at(-1)?.at ?? null,
    clicksByDay,
    topReferrers,
  };
}
