import { useState } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { MascotArt } from "./MascotArt";

type Props = {
  doorId: string;
  title: string;
  category: string;
  mode: "demo" | "live";
};

const prompts: Record<string, { action: string; benefit: string; search: string }> = {
  Music: {
    action: "Listen to a song you like and choose three colors that match its sound. Give the colors a name.",
    benefit: "It is a quick way to notice what stands out to you in the music.",
    search: "music and visual art exploration",
  },
  Film: {
    action: "Think of a film you like. Pick three colors or objects that would belong on a poster for it, without using its title or characters.",
    benefit: "You may notice the mood or details you remember most.",
    search: "film poster visual storytelling",
  },
  Food: {
    action: "Choose a dish or ingredient you are curious about. Look up its story and note one detail you did not know.",
    benefit: "A small bit of reading can reveal the history behind something familiar.",
    search: "food culture reading",
  },
  Art: {
    action: "Choose a song that matches a piece of art you like. Then choose a song with a very different mood. What changes when you imagine each one with the art?",
    benefit: "Changing the music can help you see the artwork in a new way.",
    search: "art and music creative pairing",
  },
  Books: {
    action: "Choose a song that matches a book you like. Read a short passage while it plays, or imagine the two together.",
    benefit: "The music may bring out a mood or detail you had not noticed.",
    search: "books and music creative pairing",
  },
  Design: {
    action: "Choose an everyday object nearby. Notice its shape or material, then name one thing you would keep or change about its design.",
    benefit: "A closer look can make good design easier to spot in everyday life.",
    search: "design observation guide",
  },
  Outdoors: {
    action: "From wherever you are comfortable—even by a window—look for one detail in nature. Write down what you notice.",
    benefit: "Taking a moment to look closely can make an ordinary view feel fresh.",
    search: "nature observation activity",
  },
  Experiences: {
    action: "Think of someone you would enjoy sharing this idea with. Write one sentence inviting them to try it with you.",
    benefit: "A simple invitation can make it easier to turn an idea into something you do.",
    search: "creative reflection prompt",
  },
  Other: {
    action: "Pick one detail that interests you. Write down a question about it, then look for a reliable source that might answer it.",
    benefit: "One clear question gives you an easy next step to follow.",
    search: "exploration guide",
  },
};

export function hiddenGemSearchUrl(title: string, category: string, search: string) {
  const query = `${search} for ${title} ${category}`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

export default function HiddenGem({ doorId, title, category, mode }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const prompt = prompts[category] || prompts.Other;
  const panelId = `hidden-gem-${doorId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  return <section className="hidden-gem" aria-label={`An activity for ${title}`}>
    <button
      type="button"
      className="hidden-gem-toggle"
      aria-expanded={isOpen}
      aria-controls={panelId}
      onClick={() => setIsOpen(open => !open)}
    >
      <Sparkles size={16} aria-hidden="true" />
      {isOpen ? "Close hidden gem" : "Uncover a hidden gem"}
    </button>
    <div id={panelId} className="hidden-gem-content" hidden={!isOpen} role="region" aria-label={`Hidden gem for ${title}`} aria-live="polite">
      <div className="hidden-gem-art"><MascotArt scene="curiosity" /></div>
      <div className="hidden-gem-copy">
        <span className="eyebrow">A short {category.toLowerCase()} activity</span>
        <h5>Try this with “{title}”</h5>
        <p>{prompt.action}</p>
        <p className="hidden-gem-benefit"><strong>Why try it:</strong> {prompt.benefit}</p>
        <a href={hiddenGemSearchUrl(title, category, prompt.search)} target="_blank" rel="noopener noreferrer">
          Find more {category.toLowerCase()} activity ideas <ArrowUpRight size={14} aria-hidden="true" />
        </a>
        <small>{mode === "live" ? "Suggested activity, not a verified place or event." : "Demo activity, not a live place recommendation."}</small>
      </div>
    </div>
  </section>;
}
