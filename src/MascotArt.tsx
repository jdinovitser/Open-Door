import { useState } from "react";

const SCENES = {
  greeting: {
    image: "/mascot/door-greeting.webp",
    still: "/mascot/door-greeting-still.webp",
    alt: "The Open Door mascot welcomes you through a doorway with a magnifying glass.",
  },
  map: {
    image: "/mascot/map-guide.webp",
    still: "/mascot/map-guide-still.webp",
    alt: "The Open Door mascot holds up a map and leads the way.",
  },
  qloo: {
    image: "/mascot/qloo-guide.webp",
    still: "/mascot/qloo-guide-still.webp",
    alt: "The Open Door mascot points to a tablet showing a simple Qloo data-flow diagram.",
  },
};

export function MascotArt({ scene, priority = false }: { scene: keyof typeof SCENES; priority?: boolean }) {
  const [paused, setPaused] = useState(false);
  const art = SCENES[scene];
  return <div className="mascot-visual">
    <picture>
      <source srcSet={art.still} media="(prefers-reduced-motion: reduce)" />
      <img
        src={paused ? art.still : art.image}
        alt={art.alt}
        width="480"
        height="270"
        loading={priority ? "eager" : "lazy"}
        decoding="async"
      />
    </picture>
    <button className="mascot-motion-toggle" type="button" onClick={() => setPaused(value => !value)}>
      {paused ? "Play illustration" : "Pause illustration"}
    </button>
  </div>;
}
