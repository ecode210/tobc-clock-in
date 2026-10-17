export type Params = Record<string, string | string[] | undefined>;

export function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

/** Builds `path?query` from current params with some keys replaced or removed (null or ""). */
export function hrefWith(path: string, current: Record<string, string>, updates: Record<string, string | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...updates })) {
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}
