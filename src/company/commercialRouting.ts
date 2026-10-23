import { COMPANY_PROFILES } from "./profiles";
import { companyExperienceUrl } from "./experienceContext";

export function legacyCompanyDestination(search: string, hash = "") {
  const params = new URLSearchParams(search);
  const type = COMPANY_PROFILES.find(profile => profile.id === params.get("type"))?.id;
  const intent = params.get("inquiry");
  if (intent === "partnership" || intent === "investment" || hash === "#inquiry") {
    const query = new URLSearchParams();
    if (type) query.set("type", type);
    if (intent === "partnership" || intent === "investment") query.set("inquiry", intent);
    return `/contact${query.size ? `?${query}` : ""}#inquiry`;
  }
  if (type || params.has("place") || params.has("occasion") || hash === "#company-type") {
    return `${companyExperienceUrl("discover", type || "hospitality", {
      location: params.get("place")?.trim().slice(0, 200),
      occasion: params.get("occasion")?.trim().slice(0, 200),
    })}#company-tools`;
  }
  if (hash === "#company-walkthrough" || hash === "#use-cases") return "/?explore=1&audience=company#company-tools";
  return "/partners";
}
