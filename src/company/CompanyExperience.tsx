import App from "../App";
import { companyProfile } from "./profiles";
import { companyContextScope, companyStartingProfile, readPublicOccasion } from "./experienceContext";

export default function CompanyExperience() {
  let profile = companyProfile(new URLSearchParams(window.location.search).get("type"));
  if (profile.id === "other") {
    try {
      const description = sessionStorage.getItem("opendoor.company.other.description")?.trim().slice(0, 200);
      if (description) profile = { ...profile, context: { ...profile.context, scenario: `Our company use case: ${description}. Describe your audience, their interests and practical constraints here.` } };
    } catch { /* Context is optional; the editable general company example is still available. */ }
  }
  const startingProfile = companyStartingProfile(profile, window.location.search);
  return <App key={companyContextScope(profile.id, readPublicOccasion(window.location.search))} companyProfile={startingProfile} />;
}
