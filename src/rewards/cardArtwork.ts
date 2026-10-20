import type { RewardCardData } from "./model";

const medalOrder = ["Brave", "Explorer", "Door Collector"] as const;
const levelOrder = ["bronze", "silver", "gold"] as const;

const levelColors = {
  bronze: { fill: "#f6e9df", stroke: "#c39370", ink: "#98603e", ribbon: "#bd8661" },
  silver: { fill: "#eef0ed", stroke: "#bcc3c2", ink: "#72807d", ribbon: "#97a5a1" },
  gold: { fill: "#faf2dc", stroke: "#d9bd7b", ink: "#a88236", ribbon: "#c9a34d" },
};

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;",
    };
    return entities[character];
  });
}

function medalArtwork(name: (typeof medalOrder)[number], level: (typeof levelOrder)[number], x: number): string {
  const color = levelColors[level];
  const label = `${level.charAt(0).toUpperCase()}${level.slice(1)}`;
  return `
    <g transform="translate(${x} 527)">
      <path d="M72 48 L59 82 L78 77 L91 93 L101 57 M108 57 L118 93 L131 77 L150 82 L137 48"
        fill="${color.ribbon}" stroke="#8e684d" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="105" cy="48" r="33" fill="${color.fill}" stroke="${color.stroke}" stroke-width="3"/>
      <circle cx="105" cy="48" r="25" fill="none" stroke="${color.stroke}" stroke-width="1.5" opacity=".8"/>
      <path d="M105 29 L110 40 L122 41 L113 49 L115 61 L105 55 L95 61 L97 49 L88 41 L100 40 Z"
        fill="${color.ink}" opacity=".9"/>
      <text x="105" y="119" text-anchor="middle" class="tile-name">${escapeXml(name)}</text>
      <text x="105" y="145" text-anchor="middle" class="tile-level">${label} medal</text>
    </g>`;
}

function trophyArtwork(level: (typeof levelOrder)[number], x: number): string {
  const color = levelColors[level];
  const label = `${level.charAt(0).toUpperCase()}${level.slice(1)}`;
  return `
    <g transform="translate(${x} 527)">
      <path d="M81 29 H129 V58 C129 77 118 88 105 88 C92 88 81 77 81 58 Z"
        fill="${color.fill}" stroke="${color.stroke}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M81 39 H67 C67 59 75 68 88 69 M129 39 H143 C143 59 135 68 122 69"
        fill="none" stroke="${color.stroke}" stroke-width="5" stroke-linecap="round"/>
      <path d="M105 46 L109 55 L119 56 L112 63 L114 73 L105 68 L96 73 L98 63 L91 56 L101 55 Z"
        fill="${color.ink}"/>
      <path d="M105 88 V101 M89 103 H121" fill="none" stroke="${color.ink}" stroke-width="4" stroke-linecap="round"/>
      <rect x="83" y="101" width="44" height="10" rx="4" fill="${color.ribbon}" stroke="${color.stroke}" stroke-width="2"/>
      <text x="105" y="137" text-anchor="middle" class="tile-name">Field guide</text>
      <text x="105" y="159" text-anchor="middle" class="tile-level">${label} trophy</text>
    </g>`;
}

function starsArtwork(stars: number, x: number): string {
  const spacing = 29;
  const start = 105 - ((stars - 1) * spacing) / 2;
  const starShapes = Array.from({ length: stars }, (_, index) => {
    const cx = start + index * spacing;
    return `<path d="M${cx} 31 L${cx + 5} 43 L${cx + 18} 44 L${cx + 8} 53 L${cx + 11} 66 L${cx} 59 L${cx - 11} 66 L${cx - 8} 53 L${cx - 18} 44 L${cx - 5} 43 Z"
      fill="#d4ad5f" stroke="#a88236" stroke-width="1.5" stroke-linejoin="round"/>`;
  }).join("");
  return `
    <g transform="translate(${x} 527)">
      ${starShapes}
      <text x="105" y="105" text-anchor="middle" class="tile-name">Exploration</text>
      <text x="105" y="130" text-anchor="middle" class="tile-level">${stars} ${stars === 1 ? "star" : "stars"}</text>
    </g>`;
}

export function renderRewardCardSvg(data: RewardCardData, mascotDataUrl: string): string {
  const validLevels = (value: unknown): value is (typeof levelOrder)[number] =>
    typeof value === "string" && (levelOrder as readonly string[]).includes(value);

  const earnedMedals = medalOrder.flatMap((name) => {
    const levels = Array.isArray(data.medals)
      ? data.medals.filter((medal) => medal?.name === name && validLevels(medal.level)).map((medal) => medal.level)
      : [];
    const highest = levelOrder.slice().reverse().find((level) => levels.includes(level));
    return highest ? [{ name, level: highest }] : [];
  });
  const trophy = validLevels(data.trophy) ? data.trophy : null;
  const starCount = Number.isFinite(data.stars) ? Math.max(0, Math.min(5, Math.floor(data.stars))) : 0;

  const rewardCount = earnedMedals.length + (trophy ? 1 : 0) + (starCount > 0 ? 1 : 0);
  const tileWidth = 210;
  const tileGap = 8;
  const totalWidth = rewardCount * tileWidth + Math.max(0, rewardCount - 1) * tileGap;
  const firstX = (1200 - totalWidth) / 2;
  let tileIndex = 0;
  const medalTiles = earnedMedals.map(({ name, level }) => {
    const x = firstX + tileIndex++ * (tileWidth + tileGap);
    return medalArtwork(name, level, x);
  }).join("");
  const trophyTile = trophy ? trophyArtwork(trophy, firstX + tileIndex++ * (tileWidth + tileGap)) : "";
  const starTile = starCount > 0 ? starsArtwork(starCount, firstX + tileIndex * (tileWidth + tileGap)) : "";

  const safeMascot = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(mascotDataUrl)
    ? escapeXml(mascotDataUrl)
    : "";
  const mascot = safeMascot
    ? `<image href="${safeMascot}" x="814" y="166" width="288" height="220" preserveAspectRatio="xMidYMid meet"/>`
    : "";
  const rewards = rewardCount > 0
    ? `${medalTiles}${trophyTile}${starTile}`
    : `<text x="600" y="566" text-anchor="middle" class="quiet-title">Your next little discovery is waiting.</text>
       <text x="600" y="600" text-anchor="middle" class="quiet-copy">A curious step is its own kind of reward.</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900" role="img" aria-labelledby="card-title card-desc">
  <title id="card-title">Open Door personal progress reward card</title>
  <desc id="card-desc">A cheerful celebration of personal cultural exploration, just for fun.</desc>
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fbfaf5"/>
      <stop offset="1" stop-color="#f0f3ea"/>
    </linearGradient>
    <linearGradient id="door" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#edc27a"/>
      <stop offset="1" stop-color="#ce8a55"/>
    </linearGradient>
    <style>
      text { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
      .brand { fill:#28483e; font-size:22px; font-weight:700; letter-spacing:-.04em; }
      .eyebrow { fill:#a26550; font-size:13px; font-weight:700; letter-spacing:.16em; }
      .headline { fill:#28483e; font-family: Georgia, "Times New Roman", serif; font-size:61px; font-weight:500; letter-spacing:-.055em; }
      .subhead { fill:#68776c; font-size:18px; }
      .tile-name { fill:#28483e; font-family: Georgia, "Times New Roman", serif; font-size:19px; font-weight:600; }
      .tile-level { fill:#718075; font-size:12px; letter-spacing:.08em; }
      .quiet-title { fill:#28483e; font-family: Georgia, "Times New Roman", serif; font-size:25px; }
      .quiet-copy { fill:#718075; font-size:15px; }
    </style>
  </defs>
  <rect width="1200" height="900" fill="url(#paper)"/>
  <rect x="24" y="24" width="1152" height="852" rx="28" fill="none" stroke="#d9ded2" stroke-width="2"/>
  <circle cx="1090" cy="145" r="136" fill="none" stroke="#d6c49f" stroke-width="1.5" opacity=".55"/>
  <circle cx="1090" cy="145" r="111" fill="none" stroke="#d6c49f" stroke-width="1" opacity=".36"/>
  <path d="M69 95 H1131" stroke="#d9ded2" stroke-width="1.5"/>
  <g transform="translate(76 54)">
    <path d="M7 13 C7 7 12 2 18 2 H46 C52 2 57 7 57 13 V53 H7 Z" fill="url(#door)" stroke="#80583f" stroke-width="2.5"/>
    <path d="M13 14 C13 11 15 9 18 9 H46 C49 9 51 11 51 14 V45 H13 Z" fill="#f5dba8" stroke="#b37c4f" stroke-width="1.5"/>
    <circle cx="45" cy="30" r="2.2" fill="#80583f"/>
    <path d="M23 31 Q32 40 41 31" fill="none" stroke="#80583f" stroke-width="2" stroke-linecap="round"/>
  </g>
  <text x="148" y="88" class="brand">Open Door</text>
  <text x="1098" y="84" text-anchor="end" class="eyebrow">A LITTLE ROOM FOR WONDER</text>

  <text x="82" y="177" class="eyebrow">LOOK HOW FAR CURIOSITY GOES</text>
  <text x="78" y="253" class="headline">A world of</text>
  <text x="78" y="320" class="headline">new doors.</text>
  <text x="82" y="359" class="subhead">You made space for something new.</text>
  <path d="M82 390 H647" stroke="#d9ded2" stroke-width="1.5"/>
  <circle cx="650" cy="390" r="4" fill="#c59b61"/>
  <g aria-hidden="true">
    <circle cx="958" cy="276" r="155" fill="#f7eedc" stroke="#e4d9c5" stroke-width="2"/>
    <path d="M849 400 Q954 417 1061 400" fill="none" stroke="#d6c49f" stroke-width="2"/>
    <circle cx="1080" cy="241" r="7" fill="#d4ad5f" opacity=".72"/>
    <circle cx="849" cy="272" r="4" fill="#c58c6c"/>
    <circle cx="1057" cy="319" r="4" fill="#c58c6c"/>
  </g>
  ${mascot}

  <rect x="64" y="446" width="1072" height="307" rx="22" fill="#fffefa" stroke="#d9ded2" stroke-width="2"/>
  <text x="92" y="493" class="eyebrow">YOUR EXPLORATION, CELEBRATED</text>
  <text x="1108" y="493" text-anchor="end" fill="#879187" font-size="12" letter-spacing=".12em">PERSONAL MILESTONES</text>
  <path d="M92 512 H1108" stroke="#e6e7df" stroke-width="1.5"/>
  ${rewards}
  <path d="M64 792 H1136" stroke="#d9ded2" stroke-width="1.5"/>
  <text x="600" y="824" text-anchor="middle" fill="#28483e" font-size="15" font-weight="700" letter-spacing=".04em">Personal progress / Just for fun</text>
  <text x="600" y="850" text-anchor="middle" fill="#7b857b" font-size="12">A small celebration of following your curiosity.</text>
</svg>`;
}
