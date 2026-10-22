import type { ScenarioCategory } from "../lab/scenarios";

export type CompanyType = "celebrations" | "real-estate" | "hospitality" | "business" | "other";
type CompanyCategory = "Film" | "Music" | "Food" | "Art" | "Books" | "Design" | "Outdoors" | "Experiences" | "Other";
export type CompanyProfile = {
  id: CompanyType; name: string; audience: string; summary: string; example: string;
  discoveryTitle: string; discoveryCopy: string; labTitle: string; labCopy: string;
  location: string; occasion: string; anchors: readonly string[];
  categories: Readonly<Record<string, CompanyCategory>>;
  context: { time: string; budget: string; movement: string; conditions: string; scenarioCategory: ScenarioCategory; scenario: string };
};
export const COMPANY_PROFILES: readonly CompanyProfile[] = [
  {
    id: "celebrations", name: "Destination weddings & celebrations",
    audience: "Event planners, destination celebrations and guest experiences",
    summary: "Help guests turn time around the big occasion into a memorable stay.",
    example: "A destination wedding with an afternoon for guests to explore together.",
    discoveryTitle: "Make the whole stay feel special.",
    discoveryCopy: "Start with your guests’ interests and available time. Explore cultural ideas around a wedding, celebration or event, then build a thoughtful day together.",
    labTitle: "More ways to celebrate.",
    labCopy: "Compare independent guest-experience ideas from the same starting point. Adjust the occasion, budget and volunteered access needs before choosing a direction.",
    location: "Charleston, South Carolina", occasion: "An afternoon around a celebration",
    anchors: ["live jazz", "art galleries", "local food"],
    categories: { "live jazz": "Music", "art galleries": "Art", "local food": "Food" },
    context: { time: "An afternoon around a celebration", budget: "Flexible", movement: "At the guests’ own pace", conditions: "Allow time to return before the celebration", scenarioCategory: "custom", scenario: "Plan a relaxed afternoon for celebration guests with different interests. Offer optional activities and time to regroup before the main event." },
  },
  {
    id: "real-estate", name: "Real estate & neighborhood discovery",
    audience: "Property platforms, agents and relocation teams",
    summary: "Help people explore the culture around a potential new address.",
    example: "A neighborhood visit that goes beyond the property listing.",
    discoveryTitle: "Discover life beyond the address.",
    discoveryCopy: "Give prospective residents a starting point for exploring a neighborhood through their own interests—not assumptions about who belongs there.",
    labTitle: "One neighborhood. Different possibilities.",
    labCopy: "Compare cultural directions around a neighborhood while keeping each person’s stated interests visible. These are exploration ideas, not housing or neighborhood suitability scores.",
    location: "Brooklyn, New York", occasion: "A neighborhood discovery afternoon",
    anchors: ["independent cinema", "coffee", "public art"],
    categories: { "independent cinema": "Film", coffee: "Food", "public art": "Art" },
    context: { time: "A neighborhood discovery afternoon", budget: "Flexible", movement: "Short routes with optional stops", conditions: "Check actual travel times and venue availability", scenarioCategory: "personal-style", scenario: "I am visiting a potential new neighborhood. Help me explore its cultural offerings based on my stated interests, with short optional stops. Do not infer neighborhood safety, school quality or who should live here." },
  },
  {
    id: "hospitality", name: "Hotels, travel & visitor experiences",
    audience: "Hotels, travel platforms and destination hosts",
    summary: "Make the hours between arrival and departure feel personal.",
    example: "A hotel guest’s free afternoon before an evening show.",
    discoveryTitle: "A stay with more to discover.",
    discoveryCopy: "Help guests find a cultural direction around their stay, a show or a short stopover. Start with their tastes and leave room for their practical needs.",
    labTitle: "Compare a few memorable stays.",
    labCopy: "Explore different visitor itineraries from a common checkpoint, comparing cultural discoveries and recorded planning conditions without promising availability.",
    location: "New Orleans, Louisiana", occasion: "A free afternoon before an evening show",
    anchors: ["Nina Simone", "Amélie"],
    categories: { "Nina Simone": "Music", "Amélie": "Film" },
    context: { time: "A free afternoon before an evening show", budget: "Flexible", movement: "Easy pace with breaks", conditions: "Return to the hotel before the evening show", scenarioCategory: "custom", scenario: "I am visiting for a short stay and have an evening show planned. Help me explore a few cultural ideas in my free time without making the day feel rushed." },
  },
  {
    id: "business", name: "Business trips & company offsites",
    audience: "Travel coordinators, employers and offsite planners",
    summary: "Turn the free time around work into something worth remembering.",
    example: "A business trip with an optional cultural outing after meetings.",
    discoveryTitle: "More than meetings on the itinerary.",
    discoveryCopy: "Help colleagues explore outside working hours through shared interests, individual comfort and optional activities. Keep the trip practical and participation voluntary.",
    labTitle: "Find a direction for the team.",
    labCopy: "Try independent options for time around a business trip or offsite. Compare discoveries and constraints without treating colleagues as one uniform audience.",
    location: "Chicago, Illinois", occasion: "Free time after business meetings",
    anchors: ["architecture", "live jazz", "local food"],
    categories: { architecture: "Design", "live jazz": "Music", "local food": "Food" },
    context: { time: "Free time after business meetings", budget: "Within the company’s travel policy", movement: "Optional short outing with breaks", conditions: "Leave time to return before the next commitment", scenarioCategory: "custom", scenario: "We have some free time during a business trip. Suggest optional cultural activities with different levels of participation and practical time to return. Use only interests and needs people choose to share." },
  },
  {
    id: "other", name: "Other / tell us about your company",
    audience: "Your organization, your context",
    summary: "Bring a different travel, event or cultural-discovery idea.",
    example: "Describe your audience, their occasion and what a useful experience looks like.",
    discoveryTitle: "Your audience. Their next discovery.",
    discoveryCopy: "Describe the occasion and edit these example interests to suit your audience. Use the same cultural discovery tools to explore a different company use case.",
    labTitle: "Make room for your own use case.",
    labCopy: "Use checkpoints and independent paths to try your organization’s idea. All example inputs are editable; no custom integration is required to explore.",
    location: "", occasion: "A company-organized cultural experience",
    anchors: ["music", "art"],
    categories: { music: "Music", art: "Art" },
    context: { time: "A company-organized cultural experience", budget: "Flexible", movement: "Choose your own pace", conditions: "Describe any practical constraints", scenarioCategory: "custom", scenario: "Describe your audience, goal and practical constraints here. Replace these example interests with the tastes your participants choose to share." },
  },
] as const;

export function companyProfile(id: string | null | undefined): CompanyProfile {
  return COMPANY_PROFILES.find(profile => profile.id === id) || COMPANY_PROFILES[0];
}
export function companyUrl(page: "discover" | "lab", id: CompanyType) {
  return `/companies/${page}?type=${id}`;
}
