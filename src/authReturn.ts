/** Same-origin app destinations only; never redirect to APIs or external URLs. */
export function safeAppReturnTo(value: string | null): string {
  if (!value || value.length > 1200 || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) return "/";
  try {
    const url = new URL(value, "https://open-door.invalid");
    if (url.origin !== "https://open-door.invalid") return "/";
    if (!["/", "/lab", "/trust", "/progress", "/judges", "/partners", "/contact", "/mockups", "/companies", "/companies/discover", "/companies/lab", "/companies/admin"].includes(url.pathname)) return "/";
    const params = new URLSearchParams();
    for (const name of ["type", "place", "occasion", "view", "explore"]) {
      const entry = url.searchParams.get(name);
      if (entry) params.set(name, entry.slice(0, 200));
    }
    if (url.searchParams.get("audience") === "company") params.set("audience", "company");
    const inquiry = url.searchParams.get("inquiry");
    if (inquiry === "partnership" || inquiry === "investment") params.set("inquiry", inquiry);
    return `${url.pathname}${params.size ? `?${params}` : ""}`;
  } catch { return "/"; }
}
export const signInFor = (returnTo: string) => `/sign-in?redirect_url=${encodeURIComponent(safeAppReturnTo(returnTo))}`;
