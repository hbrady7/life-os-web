/**
 * The four-domain IA. Routes are unchanged — domains are a navigation
 * layer: the sidebar groups by them, the bottom nav collapses to them,
 * and member pages share a DomainTabs row for sibling hopping.
 */

export type DomainMember = { href: string; label: string };

export type Domain = {
  key: "health" | "mind" | "trends";
  label: string;
  members: DomainMember[];
};

export const DOMAINS: Domain[] = [
  {
    key: "health",
    label: "Health",
    members: [
      { href: "/vitality", label: "Vitality" },
      { href: "/gym", label: "Gym" },
      { href: "/nutrition", label: "Nutrition" },
      { href: "/body", label: "Body" },
    ],
  },
  {
    key: "mind",
    label: "Mind",
    members: [
      { href: "/mind", label: "Overview" },
      { href: "/journal", label: "Journal" },
      { href: "/mentor", label: "Mentor" },
    ],
  },
  {
    key: "trends",
    label: "Trends",
    members: [
      { href: "/stats", label: "Stats" },
      { href: "/habits", label: "Habits" },
    ],
  },
];

/** Domain owning a pathname, or null for root surfaces (/, /settings…). */
export function domainForPath(pathname: string): Domain | null {
  for (const d of DOMAINS) {
    if (d.members.some((m) => pathname.startsWith(m.href))) return d;
  }
  return null;
}

/** Active member within a domain for a pathname (longest prefix wins). */
export function activeMember(
  domain: Domain,
  pathname: string
): DomainMember | null {
  let best: DomainMember | null = null;
  for (const m of domain.members) {
    if (pathname.startsWith(m.href)) {
      if (!best || m.href.length > best.href.length) best = m;
    }
  }
  return best;
}
