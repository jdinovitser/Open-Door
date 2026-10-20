import { useMemo, useState } from "react";
import { ArrowRight, Check, Copy, Medal, Share2, Star, Trophy } from "lucide-react";
import type { ProgressSummary } from "./agentApi";
import "./progress.css";

type Level = "none" | "bronze" | "silver" | "gold";
type Track = {
  name: "Brave" | "Explorer" | "Door Collector";
  description: string;
  count: number;
  unit: string;
  milestones: [number, number, number];
  icon: "brave" | "explorer" | "collector";
};

const LEVELS: Level[] = ["bronze", "silver", "gold"];
const STAR_MILESTONES = [1, 3, 6, 10, 15];
const TROPHY_MILESTONE = { bronze: 3, silver: 6, gold: 9 } as const;

function earnedLevel(count: number, milestones: readonly number[]): Level {
  if (count >= milestones[2]) return "gold";
  if (count >= milestones[1]) return "silver";
  if (count >= milestones[0]) return "bronze";
  return "none";
}

function shareCopy(tracks: Track[], totalStars: number, trophyLevel: Level) {
  const badges = tracks
    .map(track => {
      const level = earnedLevel(track.count, track.milestones);
      return level === "none" ? "" : `${track.name}: ${level[0].toUpperCase()}${level.slice(1)}`;
    })
    .filter(Boolean);
  const trophy = trophyLevel === "none" ? "" : `Field Guide trophy: ${trophyLevel[0].toUpperCase()}${trophyLevel.slice(1)}`;
  const rewards = [...badges, ...(trophy ? [trophy] : [])];
  const details = rewards.length ? ` My badges: ${rewards.join(" · ")}.` : " I’m building my own cultural field guide.";
  return `I’m exploring culture with Open Door and have earned ${totalStars} of 5 exploration stars.${details} Open a door of your own: ${window.location.origin}/`;
}

function MedalRow({ level }: { level: Level }) {
  return <div className="reward-medal-row" aria-label={level === "none" ? "No medal earned yet" : `${level} medal earned`}>
    {LEVELS.map((item, index) => {
      const earned = LEVELS.indexOf(level) >= index;
      return <span className={`reward-medal reward-medal-${item}${earned ? " is-earned" : ""}`} key={item} aria-hidden="true">
        <Medal size={18} strokeWidth={1.8} />
        <small>{item.slice(0, 1).toUpperCase()}</small>
      </span>;
    })}
  </div>;
}

export default function ProgressView({
  summary,
  savedCount,
  status,
  error,
  onRetry,
}: {
  summary: ProgressSummary | null;
  savedCount: number;
  status: "loading" | "ready" | "error";
  error: string;
  onRetry: () => void;
}) {
  const [shareStatus, setShareStatus] = useState("");
  const tracks: Track[] = useMemo(() => [
    { name: "Brave", description: "Unexpected doors you choose to open.", count: summary?.braveDoorsOpened ?? 0, unit: "unexpected doors opened", milestones: [1, 3, 5], icon: "brave" },
    { name: "Explorer", description: "Different cultural categories you explore.", count: summary?.categories.length ?? 0, unit: "categories explored", milestones: [1, 3, 5], icon: "explorer" },
    { name: "Door Collector", description: "Doors you’ve saved to your account.", count: savedCount, unit: "doors saved", milestones: [1, 5, 10], icon: "collector" },
  ], [summary, savedCount]);
  const starsEarned = STAR_MILESTONES.filter(threshold => (summary?.doorsOpened ?? 0) >= threshold).length;
  const medalPoints = tracks.reduce((total, track) => {
    const level = earnedLevel(track.count, track.milestones);
    return total + (level === "gold" ? 3 : level === "silver" ? 2 : level === "bronze" ? 1 : 0);
  }, 0);
  const trophyLevel: Level = medalPoints >= TROPHY_MILESTONE.gold ? "gold"
    : medalPoints >= TROPHY_MILESTONE.silver ? "silver"
      : medalPoints >= TROPHY_MILESTONE.bronze ? "bronze" : "none";
  const title = summary ? shareCopy(tracks, starsEarned, trophyLevel) : "";

  async function copyProgress() {
    try {
      await navigator.clipboard.writeText(title);
      setShareStatus("A share-ready progress summary has been copied. It doesn’t include your saved doors or interests.");
    } catch {
      setShareStatus("Copy isn’t available in this browser. Try a social share button instead.");
    }
  }

  async function shareProgress() {
    if (!navigator.share) return;
    try {
      await navigator.share({ title: "My Open Door progress", text: title });
      setShareStatus("Progress shared.");
    } catch (shareError) {
      if (shareError instanceof Error && shareError.name !== "AbortError") {
        setShareStatus("Sharing wasn’t available. Your progress hasn’t been shared.");
      }
    }
  }

  return <section className="progress-page" aria-labelledby="progress-title">
    <header className="progress-hero">
      <div className="progress-hero-copy">
        <span className="eyebrow">Open Door · your account</span>
        <h1 id="progress-title">Every open door counts.</h1>
        <p>Your saved doors and exploration milestones stay with your account. Keep exploring, earn medals across three tracks, and collect up to five stars.</p>
        <div className="exploration-stars" role="img" aria-label={`${starsEarned} of 5 exploration stars earned`}>
          {STAR_MILESTONES.map((threshold, index) => <span className="exploration-star" key={threshold} title={`${threshold} unique doors opened`}>
            <Star size={29} strokeWidth={1.5} fill={starsEarned > index ? "currentColor" : "transparent"} />
          </span>)}
          <strong>{starsEarned} / 5 stars</strong>
        </div>
        <p className="progress-next">{status === "ready"
        ? summary && summary.doorsOpened < STAR_MILESTONES[STAR_MILESTONES.length - 1]
            ? `${STAR_MILESTONES.find(threshold => threshold > summary.doorsOpened) ?? STAR_MILESTONES[STAR_MILESTONES.length - 1]} unique opened doors earns your next star.`
            : "Five stars are yours. Keep finding your next cultural connection."
          : "Stars are awarded for opening distinct cultural doors."}</p>
      </div>
      <figure className="progress-concept">
        <img
          src="/mascot/open-door-reward-concept.png"
          alt="Open Door mascot celebrating progress with bronze, silver and gold medals, stars, and a trophy."
          width="1024"
          height="572"
          loading="lazy"
          decoding="async"
        />
        <figcaption>One small step at a time. Progress is yours to share.</figcaption>
      </figure>
    </header>

    <section className="progress-track-section" aria-labelledby="tracks-title">
      <div className="progress-section-heading">
        <div><span className="eyebrow">Three ways to explore</span><h2 id="tracks-title">Your progress tracks</h2></div>
        {status === "ready" && <span className="progress-sync"><Check size={14} /> Saved with your account</span>}
      </div>
      {status === "loading" && <p className="progress-loading" role="status">Loading your account progress…</p>}
      {status === "error" && <p className="progress-error" role="alert">{error} <button type="button" onClick={onRetry}>Retry</button></p>}
      {status === "ready" && summary && <div className="progress-tracks">
        {tracks.map(track => {
          const level = earnedLevel(track.count, track.milestones);
          const nextMilestone = track.milestones.find(threshold => threshold > track.count);
          const progress = level === "gold" ? 100 : Math.min(100, (track.count / (nextMilestone || track.milestones[2])) * 100);
          return <article className="progress-track-card" key={track.name}>
            <div className={`track-symbol track-symbol-${track.icon}`} aria-hidden="true">
              {track.icon === "collector" ? <Share2 size={21} /> : track.icon === "explorer" ? <ArrowRight size={21} /> : <Star size={21} />}
            </div>
            <p className="track-eyebrow">TRACK {String(tracks.indexOf(track) + 1).padStart(2, "0")}</p>
            <h3>{track.name}</h3>
            <p className="track-description">{track.description}</p>
            <p className="track-count"><strong>{track.count}</strong><span>{track.unit}</span></p>
            <div className="track-progress" role="progressbar" aria-label={`${track.name} progress`} aria-valuemin={0} aria-valuemax={track.milestones[2]} aria-valuenow={Math.min(track.count, track.milestones[2])}>
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="track-unlocks"><span>{level === "none" ? "Keep going" : `${level[0].toUpperCase()}${level.slice(1)} medal`}</span>
              <span>{nextMilestone ? `${track.count} / ${nextMilestone}` : "Track complete"}</span>
            </div>
            <MedalRow level={level} />
            <p className="track-milestones" aria-label={`${track.name} medal milestones`}>
              Bronze {track.milestones[0]} · Silver {track.milestones[1]} · Gold {track.milestones[2]}
            </p>
          </article>;
        })}
      </div>}
    </section>

    {status === "ready" && <section className="field-guide-trophy" aria-labelledby="trophy-title">
      <div className={`field-trophy-icon trophy-${trophyLevel}`} aria-hidden="true"><Trophy size={36} strokeWidth={1.6} /></div>
      <div className="field-trophy-copy">
        <span className="eyebrow">The grand collection</span>
        <h2 id="trophy-title">{trophyLevel === "none" ? "Your Field Guide trophy is waiting." : `Your ${trophyLevel} Field Guide trophy.`}</h2>
        <p>Medals count 1 point for bronze, 2 for silver, and 3 for gold in each track. Collect 3 points for a bronze trophy, 6 for silver, and 9 for gold.</p>
      </div>
      <div className="trophy-levels" role="img" aria-label={trophyLevel === "none" ? "Bronze, silver and gold trophy levels are ready to earn" : `${trophyLevel} trophy earned`}>
        {LEVELS.map((level, index) => <span className={`trophy-level trophy-level-${level}${LEVELS.indexOf(trophyLevel) >= index ? " is-earned" : ""}`} key={level}>
          <Trophy size={27} strokeWidth={1.6} /><small>{level}</small>
        </span>)}
      </div>
      <div className="trophy-progress" role="progressbar" aria-label="Field Guide trophy points" aria-valuemin={0} aria-valuemax={9} aria-valuenow={medalPoints}>
        <span style={{ width: `${Math.min(100, (medalPoints / 9) * 100)}%` }} />
      </div>
    </section>}

    {status === "ready" && <section className="progress-share" aria-labelledby="share-title">
      <div><span className="eyebrow">Celebrate your route</span><h2 id="share-title">Share your progress</h2>
        <p>Share your reward summary and the Open Door home page—not your personal interests, saved doors, or location.</p></div>
      <div className="progress-share-actions">
        {typeof navigator !== "undefined" && typeof navigator.share === "function" && <button type="button" className="secondary-btn share-native" onClick={() => void shareProgress()}><Share2 size={15} /> Share…</button>}
        <a className="secondary-btn share-link" href={`https://x.com/intent/post?text=${encodeURIComponent(title)}`} target="_blank" rel="noreferrer noopener" aria-label="Share progress on X">
          <span className="share-x" aria-hidden="true">𝕏</span> Post on X
        </a>
        <a className="secondary-btn share-link" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${window.location.origin}/`)}`} target="_blank" rel="noreferrer noopener" aria-label="Share Open Door on LinkedIn">
          <span className="share-in" aria-hidden="true">in</span> LinkedIn
        </a>
        <button type="button" className="secondary-btn" onClick={() => void copyProgress()}><Copy size={15} /> Copy summary</button>
      </div>
      <p className="progress-share-status" role="status">{shareStatus}</p>
    </section>}

    <p className="progress-footnote">A personal, just-for-fun progress record. Main three-door journeys and saved-door exploration count; historical Guest activity and Discovery Lab branches stay browser-local. Demo and Live paths both count—not as Qloo scores or externally verified achievements. Each distinct door counts once per account.</p>
  </section>;
}
