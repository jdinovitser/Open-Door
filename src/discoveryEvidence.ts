type EvidenceDoor = {
  title: string;
  source?: string;
  category: string;
  entityId?: string;
  entityType?: string;
  coordinates?: { latitude: number; longitude: number } | null;
  websiteUrl?: string;
};

export function connectionSummary(door: EvidenceDoor, mode: "demo" | "live") {
  if (mode !== "live") return "This is a prepared activity example, not a Qloo recommendation.";
  if (!door.entityId) return "This saved result has limited source information. No specific cultural relationship is available.";
  return `Qloo Insights returned this ${door.category.toLowerCase()} result for ${door.source || "the selected starting interests"}. A more specific reason is not established by the available information.`;
}

export function destinationActions(door: EvidenceDoor, mode: "demo" | "live") {
  if (mode !== "live") return { map: "", website: "" };
  let website = "";
  try {
    const url = new URL(door.websiteUrl || "");
    if (url.protocol === "https:" && !url.username && !url.password) website = url.href;
  } catch { /* Missing or invalid source URL: omit rather than invent a link. */ }
  const c = door.coordinates;
  const physical = ["place", "destination"].includes(door.entityType || "");
  const valid = c && typeof c.latitude === "number" && typeof c.longitude === "number"
    && Number.isFinite(c.latitude) && Number.isFinite(c.longitude)
    && Math.abs(c.latitude) <= 90 && Math.abs(c.longitude) <= 180;
  return {
    map: physical && valid ? `https://www.google.com/maps/search/?api=1&query=${c.latitude},${c.longitude}` : "",
    website,
  };
}
