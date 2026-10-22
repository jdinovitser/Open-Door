type StoryJourney = {
  mode?: string;
  anchors: string[];
  doors: { title: string }[];
};

export const STORY_ARTWORK = "/mascot/door-mascot-appear-still.webp";

function safeText(value: string, limit: number): string {
  const short = value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
  return short.replace(/[<>&"']/g, char => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]!);
}

export async function createStoryCard(journey: StoryJourney): Promise<File> {
  const response = await fetch(STORY_ARTWORK);
  if (!response.ok) throw new Error("The story artwork couldn’t load.");
  const blob = await response.blob();
  const artwork = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The story artwork couldn’t be read."));
    reader.readAsDataURL(blob);
  });
  return renderCard(journey, artwork);
}

async function renderCard(journey: StoryJourney, artwork: string): Promise<File> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="#f8f1e7"/>
    <path d="M60 45H1140M60 580H1140" stroke="#d9cdbc"/>
    <text x="82" y="105" fill="#a84c37" font-family="monospace" font-size="16" letter-spacing="3">OPEN DOOR · ${journey.mode === "live" ? "QLOO JOURNEY" : "PREPARED EXAMPLE STORY"}</text>
    <text x="82" y="195" fill="#24483d" font-family="Georgia,serif" font-size="54">I started with</text>
    <text x="82" y="255" fill="#31594f" font-family="Georgia,serif" font-size="38">${safeText(journey.anchors[0] || "my interests", 28)}</text>
    <text x="82" y="335" fill="#8b654c" font-family="monospace" font-size="14" letter-spacing="2">A FAMILIAR DOOR</text>
    <text x="82" y="380" fill="#24483d" font-family="Georgia,serif" font-size="29">${safeText(journey.doors[0]?.title || "A familiar door", 37)}</text>
    <text x="82" y="450" fill="#8b654c" font-family="monospace" font-size="14" letter-spacing="2">THEN AN UNEXPECTED THREAD</text>
    <text x="82" y="495" fill="#24483d" font-family="Georgia,serif" font-size="27">${safeText(journey.doors[2]?.title || "A new possibility", 39)}</text>
    <image href="${artwork}" x="690" y="160" width="480" height="360" preserveAspectRatio="xMidYMid meet"/>
    <text x="82" y="610" fill="#6c746b" font-family="monospace" font-size="12">${journey.mode === "live" ? "RECOMMENDATIONS FROM QLOO · CHECK DETAILS BEFORE VISITING" : "PREPARED EXAMPLE ACTIVITIES · NOT RETRIEVED QLOO RESULTS"}</text>
  </svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image export is unavailable in this browser.");
    context.drawImage(image, 0, 0);
    const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error("The story image couldn’t be created.")), "image/png",
    ));
    return new File([png], "my-open-door-story.png", { type: "image/png" });
  } finally {
    URL.revokeObjectURL(url);
  }
}
