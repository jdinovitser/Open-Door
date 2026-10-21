import type { Discovery, Settings } from "./model.ts";

export const SCENARIOS = [
  { id: "personal-style", label: "Personal Style", example: "I enjoy understated colors, tactile details, and familiar starting points. I want a fresh cultural experience that fits my everyday routine and feels comfortable rather than showy." },
  { id: "age-aware", label: "Age-Aware", example: "I am entering a new life stage and want to explore independently. I prefer clear instructions, convenient options, opportunities to pause, and control over the pace. Ask about my preferences rather than assuming what my age means." },
  { id: "wellbeing", label: "Health & Wellbeing", example: "My energy varies day to day. I want a quiet, low-pressure discovery with a seated option, flexible timing, and the choice to stop or invite someone I trust. Focus on practical comfort, not medical advice." },
  { id: "custom", label: "Custom / Anything Else", example: "I want to explore something new that fits my situation. My goal is to reconnect with a personal interest; I have limited time and a small budget. I would like options I can adapt, with no pressure to commit." },
] as const;
export type ScenarioCategory = typeof SCENARIOS[number]["id"];

function stated(text: string, pattern: RegExp): boolean {
  for (const match of text.matchAll(new RegExp(pattern.source, "gi"))) {
    const prefix = text.slice(Math.max(0, match.index! - 45), match.index);
    if (!/\b(?:not|don't want|do not want|don't need|do not need|no need for|dislike|avoid)\s+(?:(?:a|an|any|the|being)\s+)?$/i.test(prefix)) return true;
  }
  return false;
}

// Only explicit preferences trigger these local planning suggestions. Category,
// age, diagnoses and identity never determine suitability or cultural interests.
export function scenarioGuidance(settings: Pick<Settings, "scenario">): string[] {
  const text = settings.scenario?.trim() || "";
  if (!text) return [];
  const guidance: string[] = [];
  if (stated(text, /\b(?:love|enjoy|like|interested in)\s+(?:both\s+)?music\s+and\s+art\b/)) {
    guidance.push("Try pairing a song you love with an artwork. You can explore both interests together without needing to go anywhere.");
  }
  if (stated(text, /\b(quiet|silence|silent|avoid (?:loud|noise)|low[- ]noise)\b/)) {
    guidance.push("Try a silent reading or visual version first; confirm sound levels before choosing an in-person experience.");
  }
  if (stated(text, /\b(seated|sitting|no walking|avoid walking|step[- ]free|wheelchair)\b/)) {
    guidance.push("Use a seated or at-home version where possible; check step-free access, seating and facilities directly before any visit.");
  }
  if (stated(text, /\b(energy varies|low[- ]energy|opportunities to pause|own pace|flexible timing|low[- ]pressure)\b/)) {
    guidance.push("Start with one small part, leave room for breaks, and keep a no-obligation stopping point.");
  }
  if (stated(text, /\b(limited time|short session|few minutes|quick discovery)\b/)) {
    guidance.push("Choose a single scene, passage or detail rather than committing to the full experience.");
  }
  if (stated(text, /\b(small budget|low[- ]cost|no spending|free options)\b/)) {
    guidance.push("Start with resources you already have or check free access; confirm costs rather than assuming this result is affordable.");
  }
  if (stated(text, /\b(independently|on my own|solo)\b/)) {
    guidance.push("Keep the activity self-directed, with optional help rather than requiring a group.");
  }
  if (stated(text, /\b(understated|tactile|colors|aesthetic|texture)\b/)) {
    guidance.push("Sample one detail and compare its colors, textures or atmosphere with your own taste before committing.");
  }
  if (!guidance.length) guidance.push("Try a short preview before committing your time. Keep what you enjoy and skip what you don’t.");
  return guidance;
}

export function adaptToScenario(discovery: Discovery, settings: Settings): Discovery {
  const brief = settings.scenario?.trim();
  if (!brief) return discovery;
  const guidance = scenarioGuidance(settings);
  return {
    ...discovery,
    description: `${discovery.description} Personal planning suggestion: ${guidance[0]}`,
    constraints: [...discovery.constraints, {
      constraint: "Your scenario", value: brief, status: "Planning input",
      detail: "Only your stated preferences shape these local suggestions. Age, health, access, safety and suitability are not inferred or verified. Not medical advice.",
    }],
    plan: [...(discovery.plan || []), ...guidance],
  };
}
