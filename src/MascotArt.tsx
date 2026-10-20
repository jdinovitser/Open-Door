import { useEffect, useRef, useState } from "react";
import "./mascot.css";

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
    alt: "The Open Door mascot holds a tablet displaying the Qloo wordmark.",
  },
  hello: {
    image: "/mascot/hello-guide.webp",
    still: "/mascot/hello-guide-still.webp",
    alt: "The cheerful Open Door mascot waves hello.",
  },
  coffee: {
    image: "/mascot/coffee-guide.webp",
    still: "/mascot/coffee-guide-still.webp",
    alt: "The Open Door mascot takes a cozy coffee break.",
  },
  explorer: {
    image: "/mascot/explorer-guide.webp",
    still: "/mascot/explorer-guide-still.webp",
    alt: "The Open Door mascot heads out with a backpack and binoculars.",
  },
  curiosity: {
    image: "/mascot/curiosity-guide.webp",
    still: "/mascot/curiosity-guide-still.webp",
    alt: "The Open Door mascot considers a map and a world of cultural interests.",
  },
  camera: {
    image: "/mascot/camera-guide.webp",
    still: "/mascot/camera-guide-still.webp",
    alt: "The Open Door mascot explores with a camera.",
  },
  artist: {
    image: "/mascot/artist-guide.webp",
    still: "/mascot/artist-guide-still.webp",
    alt: "The Open Door mascot paints at an easel with a colorful palette.",
  },
  music: {
    image: "/mascot/music-guide.webp",
    still: "/mascot/music-guide-still.webp",
    alt: "The Open Door mascot enjoys music through headphones.",
  },
};

export function MascotArt({ scene, priority = false }: { scene: keyof typeof SCENES; priority?: boolean }) {
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(priority);
  const frameRef = useRef<HTMLDivElement>(null);
  const art = SCENES[scene];
  useEffect(() => {
    if (!window.IntersectionObserver) { setInView(true); return; }
    const observer = new IntersectionObserver(entries => setInView(entries[0]?.isIntersecting ?? false));
    if (frameRef.current) observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, []);
  return <div className="mascot-visual" data-mascot-scene={scene} ref={frameRef}>
    <picture>
      <source srcSet={art.still} media="(prefers-reduced-motion: reduce)" />
      <img
        src={paused || !inView ? art.still : art.image}
        alt={art.alt}
        width="480"
        height="270"
        loading={priority ? "eager" : "lazy"}
        decoding="async"
      />
    </picture>
    <button className="mascot-motion-toggle" type="button" aria-pressed={paused}
      aria-label={`${paused ? "Play" : "Pause"} ${scene} mascot animation`}
      onClick={() => setPaused(value => !value)}>
      {paused ? "Play illustration" : "Pause illustration"}
    </button>
  </div>;
}
