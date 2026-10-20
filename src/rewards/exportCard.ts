import { renderRewardCardSvg } from "./cardArtwork";
import type { RewardCardData } from "./model";

export const CARD_FILENAME = "open-door-rewards.png";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The reward card artwork could not be loaded."));
    image.src = src;
  });
}

function canvas(width: number, height: number) {
  const element = document.createElement("canvas");
  element.width = width;
  element.height = height;
  const context = element.getContext("2d");
  if (!context) throw new Error("Image creation isn’t supported in this browser.");
  return { element, context };
}

export async function createRewardCard(data: RewardCardData): Promise<File> {
  const mascot = await loadImage("/mascot/open-door-reward-concept.png");
  // Face-only crop: the concept sheet's medals/trophies/stars are NOT earned data.
  const crop = canvas(148, 113);
  crop.context.drawImage(mascot, 90, 55, 148, 113, 0, 0, 148, 113);
  const svg = renderRewardCardSvg(data, crop.element.toDataURL("image/png"));
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = await loadImage(url);
    const output = canvas(1200, 900);
    output.context.drawImage(image, 0, 0, 1200, 900);
    const blob = await new Promise<Blob>((resolve, reject) => output.element.toBlob(
      value => value ? resolve(value) : reject(new Error("The reward card could not be created.")), "image/png"));
    return new File([blob], CARD_FILENAME, { type: "image/png" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function canShareCard(file: File) {
  try {
    return typeof navigator.share === "function" && typeof navigator.canShare === "function"
      && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}
