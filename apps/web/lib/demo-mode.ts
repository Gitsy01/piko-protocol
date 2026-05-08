export const DEMO_MODE_ENABLED = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export function hasDemoModeQuery(
  searchParams?: { get(name: string): string | null } | null
) {
  const value = searchParams?.get("demo");
  return value === "1" || value === "true";
}

export function appendDemoQuery(href: string, enabled: boolean) {
  if (!enabled) {
    return href;
  }

  const divider = href.includes("?") ? "&" : "?";
  return href.includes("demo=") ? href : `${href}${divider}demo=1`;
}
