import type { ProgressSummary } from "../agentApi";

export type Level = "none" | "bronze" | "silver" | "gold";
export type Track = {
  name: "Brave" | "Explorer" | "Door Collector";
  description: string;
  count: number;
  unit: string;
  milestones: [number, number, number];
  icon: "brave" | "explorer" | "collector";
};
export type RewardCardData = {
  medals: { name: Track["name"]; level: Exclude<Level, "none"> }[];
  trophy: Exclude<Level, "none"> | null;
  stars: number;
};

export const LEVELS: Level[] = ["bronze", "silver", "gold"];
export const STAR_MILESTONES = [1, 3, 6, 10, 15];
const TROPHY_MILESTONE = { bronze: 3, silver: 6, gold: 9 } as const;

export function earnedLevel(count: number, milestones: readonly number[]): Level {
  if (count >= milestones[2]) return "gold";
  if (count >= milestones[1]) return "silver";
  if (count >= milestones[0]) return "bronze";
  return "none";
}

export function progressRewards(summary: ProgressSummary | null, savedCount: number) {
  const tracks: Track[] = [
    { name: "Brave", description: "Unexpected doors you choose to open.", count: summary?.braveDoorsOpened ?? 0, unit: "unexpected doors opened", milestones: [1, 3, 5], icon: "brave" },
    { name: "Explorer", description: "Different cultural categories you explore.", count: summary?.categories.length ?? 0, unit: "categories explored", milestones: [1, 3, 5], icon: "explorer" },
    { name: "Door Collector", description: "Doors you’ve saved to your account.", count: savedCount, unit: "doors saved", milestones: [1, 5, 10], icon: "collector" },
  ];
  const starsEarned = STAR_MILESTONES.filter(threshold => (summary?.doorsOpened ?? 0) >= threshold).length;
  const medalPoints = tracks.reduce((total, track) => total + LEVELS.indexOf(earnedLevel(track.count, track.milestones)) + 1, 0);
  const trophyLevel: Level = medalPoints >= TROPHY_MILESTONE.gold ? "gold"
    : medalPoints >= TROPHY_MILESTONE.silver ? "silver"
      : medalPoints >= TROPHY_MILESTONE.bronze ? "bronze" : "none";
  // Explicit allowlist: the export never receives account or journey details.
  const card: RewardCardData = {
    medals: tracks.flatMap(track => {
      const level = earnedLevel(track.count, track.milestones);
      return level === "none" ? [] : [{ name: track.name, level }];
    }),
    trophy: trophyLevel === "none" ? null : trophyLevel,
    stars: starsEarned,
  };
  return { tracks, starsEarned, medalPoints, trophyLevel, card };
}
