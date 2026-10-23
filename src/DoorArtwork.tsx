import { useEffect, useId, useRef, useState } from "react";
import "./door-artwork.css";

type DoorArtworkProps = {
  open?: boolean;
  hero?: boolean;
  className?: string;
  onComplete?: () => void;
};

type ArtPhase = "closed" | "opening" | "mascot" | "complete";

const art = {
  closed: "/mascot/door-closed.webp",
  closedStill: "/mascot/door-closed-still.webp",
  opening: "/mascot/door-opening.webp",
  mascot: "/mascot/door-mascot-appear.webp",
  mascotStill: "/mascot/door-mascot-appear-still.webp",
};

function readReducedMotion() {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function DoorArtwork({
  open = false,
  hero = false,
  className = "",
  onComplete,
}: DoorArtworkProps) {
  const [reducedMotion, setReducedMotion] = useState(readReducedMotion);
  const [phase, setPhase] = useState<ArtPhase>(() =>
    !open ? "closed" : readReducedMotion() ? "complete" : hero ? "mascot" : "opening",
  );
  const [loadedImage, setLoadedImage] = useState("");
  const [sequence, setSequence] = useState(0);
  const instance = useId();
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(preference.matches);
    preference.addEventListener?.("change", updatePreference);
    return () => preference.removeEventListener?.("change", updatePreference);
  }, []);

  useEffect(() => {
    setLoadedImage("");
    completedRef.current = false;

    if (!open) {
      setPhase("closed");
      return;
    }

    if (reducedMotion) {
      setPhase("complete");
      completedRef.current = true;
      onCompleteRef.current?.();
      return;
    }

    setSequence(value => value + 1);
    setPhase(hero ? "mascot" : "opening");
  }, [open, hero, reducedMotion]);

  const imageSrc = reducedMotion
    ? (open ? art.mascotStill : art.closedStill)
    : phase === "closed"
      ? art.closed
      : phase === "opening"
        ? `${art.opening}?play=${encodeURIComponent(instance)}-${sequence}`
        : phase === "complete"
          ? art.mascotStill
           : `${art.mascot}?play=${encodeURIComponent(instance)}-${sequence}`;

  const imageKey = imageSrc;

  useEffect(() => {
    if (phase === "opening") {
      const nextArtwork = new Image();
      nextArtwork.src = `${art.mascot}?play=${encodeURIComponent(instance)}-${sequence}`;
      const finalStill = new Image();
      finalStill.src = art.mascotStill;
    } else if (phase === "mascot") {
      const finalStill = new Image();
      finalStill.src = art.mascotStill;
    }
  }, [phase, instance, sequence]);

  useEffect(() => {
    if ((phase !== "opening" && phase !== "mascot") || reducedMotion) return;
    if (loadedImage !== imageKey) return;

    const timer = window.setTimeout(() => {
      if (phase === "opening") {
        setPhase("mascot");
      } else {
        setPhase("complete");
        if (!completedRef.current) {
          completedRef.current = true;
          onCompleteRef.current?.();
        }
      }
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [phase, reducedMotion, loadedImage, imageKey]);

  return (
    <div
      className={`doorway-animation-art ${className}`.trim()}
      data-testid="doorway-animation"
      data-art-phase={phase}
    >
      <img
        key={imageKey}
        data-testid="doorway-animation-image"
        src={imageSrc}
        alt={
          phase === "closed"
            ? "A closed doorway, awaiting a visitor."
            : phase === "opening"
              ? "The doorway swings open."
              : "The doorway mascot appears to welcome you."
        }
        width="640"
        height="360"
        decoding="async"
        onLoad={() => setLoadedImage(imageKey)}
      />
    </div>
  );
}
