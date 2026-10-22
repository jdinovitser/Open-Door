import { companyProfile, companyUrl, type CompanyProfile, type CompanyType } from "./profiles";
import { SCENARIOS } from "../lab/scenarios";

export type PublicOccasion = { location?: string; occasion?: string };
export type CompanyDraft = {
  location: string;
  occasion: string;
  anchors: string[];
  categories: Record<string, CompanyProfile["categories"][string]>;
  context: CompanyProfile["context"];
};
export type CompanyDraftChange = Pick<CompanyDraft, "location" | "anchors" | "categories"> & {
  scenario: string; scenarioCategory: CompanyProfile["context"]["scenarioCategory"];
};
export function companyContextScope(id: CompanyType, publicOccasion: PublicOccasion = {}) {
  const preset = companyProfile(id);
  const location = publicOccasion.location || preset.location;
  const occasion = publicOccasion.occasion || preset.occasion;
  const suffix = location === preset.location && occasion === preset.occasion ? ""
    : `.occasion.${encodeURIComponent(JSON.stringify([location, occasion]))}`;
  return `opendoor.company.${id}${suffix}`;
}
const key = (id: CompanyType, publicOccasion: PublicOccasion) => `${companyContextScope(id, publicOccasion)}.context.v1`;
const text = (value: unknown, max = 200) => typeof value === "string" ? value.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max) : "";
const CATEGORIES = new Set(["Film", "Music", "Food", "Art", "Books", "Design", "Outdoors", "Experiences", "Other"]);
const SCENARIO_IDS = new Set<string>(SCENARIOS.map(item => item.id));

/** Only the organizer's public place and occasion may travel in an invitation. */
export function readPublicOccasion(search: string): PublicOccasion {
  const params = new URLSearchParams(search);
  const location = text(params.get("place"), 120);
  const occasion = text(params.get("occasion"));
  return { ...(location ? { location } : {}), ...(occasion ? { occasion } : {}) };
}

export function companyExperienceUrl(page: "discover" | "lab", id: CompanyType, publicOccasion: PublicOccasion = {}) {
  const params = new URLSearchParams(companyUrl(page, id).split("?")[1]);
  const location = text(publicOccasion.location, 120);
  const occasion = text(publicOccasion.occasion);
  if (location) params.set("place", location);
  if (occasion) params.set("occasion", occasion);
  return `/companies/${page}?${params}`;
}

export function companyOrganizerUrl(id: CompanyType, publicOccasion: PublicOccasion = {}) {
  const params = new URLSearchParams(companyExperienceUrl("discover", id, publicOccasion).split("?")[1]);
  return `/companies?${params}#company-type`;
}

export function readCompanyDraft(id: CompanyType, publicOccasion: PublicOccasion = {}): CompanyDraft | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key(id, publicOccasion)) || "null");
    if (!value || !Array.isArray(value.anchors) || !value.context || typeof value.categories !== "object" || !value.categories) return null;
    const anchors = value.anchors.filter((item: unknown) => typeof item === "string").map((item: string) => text(item, 120)).filter(Boolean).slice(0, 5);
    const base = companyProfile(id);
    const categories: CompanyDraft["categories"] = {};
    for (const anchor of anchors) categories[anchor] = CATEGORIES.has(value.categories[anchor]) ? value.categories[anchor] : "Other";
    return {
      location: text(value.location, 120), occasion: text(value.occasion), anchors, categories,
      context: {
        time: text(value.occasion), budget: text(value.context.budget), movement: text(value.context.movement),
        conditions: text(value.context.conditions), scenario: text(value.context.scenario, 2000),
        scenarioCategory: SCENARIO_IDS.has(value.context.scenarioCategory) ? value.context.scenarioCategory : base.context.scenarioCategory,
      },
    };
  } catch { return null; }
}

export function writeCompanyDraft(id: CompanyType, draft: CompanyDraft, publicOccasion: PublicOccasion = {}) {
  try { sessionStorage.setItem(key(id, publicOccasion), JSON.stringify(draft)); } catch { /* Exploration works without browser storage. */ }
}
export function clearCompanyDraft(id: CompanyType, publicOccasion: PublicOccasion = {}) {
  try { sessionStorage.removeItem(key(id, publicOccasion)); } catch { /* No readable draft to clear. */ }
}

export function companyStartingProfile(profile: CompanyProfile, search: string): CompanyProfile {
  const publicOccasion = readPublicOccasion(search);
  const draft = readCompanyDraft(profile.id, publicOccasion);
  return {
    ...profile,
    ...(draft ? { location: draft.location, occasion: draft.occasion, anchors: draft.anchors, categories: draft.categories, context: draft.context } : {}),
    // Once entered, a visitor's own edits take precedence over invitation defaults.
    location: draft?.location ?? publicOccasion.location ?? profile.location,
    occasion: draft?.occasion ?? publicOccasion.occasion ?? profile.occasion,
    context: { ...(draft?.context || profile.context), time: draft?.occasion ?? publicOccasion.occasion ?? profile.occasion },
  };
}
