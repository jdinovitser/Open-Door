import { useEffect, useState } from "react";
import { Download, Image as ImageIcon, Share2 } from "lucide-react";
import type { RewardCardData } from "./model";
import { canShareCard, createRewardCard } from "./exportCard";
import "./card.css";

export default function RewardCard({ data }: { data: RewardCardData }) {
  const [open, setOpen] = useState(false);
  const [prepared, setPrepared] = useState<{ file: File; url: string; key: string } | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sharing, setSharing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify(data);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let objectUrl: string | undefined;
    setPrepared(null);
    setError("");
    setMessage("");
    void createRewardCard(JSON.parse(key) as RewardCardData).then(file => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(file);
      setPrepared({ file, url: objectUrl, key });
    }).catch(() => {
      if (!cancelled) setError("We couldn’t create your card. Please retry. Your progress hasn’t changed.");
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, key, attempt]);

  const ready = open && prepared?.key === key ? prepared : null;

  async function share() {
    if (!ready) return;
    setSharing(true);
    setMessage("");
    try {
      // File is prepared before this click, preserving mobile user activation.
      await navigator.share({ files: [ready.file] });
      setMessage("Reward card shared.");
    } catch (failure) {
      setMessage(failure instanceof Error && failure.name === "AbortError"
        ? "Sharing cancelled. Your card is still available to download."
        : "File sharing isn’t available right now. Use Download PNG instead.");
    } finally {
      setSharing(false);
    }
  }

  return <div className="reward-card-export">
    <button type="button" className="secondary-btn" aria-expanded={open} aria-controls="reward-card-preview" onClick={() => setOpen(!open)}>
      <ImageIcon size={15} /> {open ? "Hide reward card" : "Create reward card"}
    </button>
    {open && <section id="reward-card-preview" className="reward-card-preview" aria-label="Reward card preview">
      <div className="reward-card-details">
        <h3>Your rewards, ready to post.</h3>
        <p>Only earned medals, your trophy, and earned stars appear on this card. No interests, saved doors, location, or account details. A personal, just-for-fun record—not a verified achievement.</p>
        {!ready && !error && <p role="status">Creating your PNG card…</p>}
        {error && <p role="alert">{error} <button type="button" className="secondary-btn" onClick={() => setAttempt(value => value + 1)}>Retry card</button></p>}
        {ready && <div className="reward-card-actions">
          <a className="secondary-btn" href={ready.url} download={ready.file.name} onClick={() => setMessage("Download requested. On mobile, check Downloads or use your browser’s Save Image option.")}><Download size={15} /> Download PNG</a>
          {canShareCard(ready.file) && <button className="secondary-btn" type="button" disabled={sharing} onClick={() => void share()}><Share2 size={15} /> {sharing ? "Sharing…" : "Share card…"}</button>}
        </div>}
        <p role="status" className="reward-card-status">{message}</p>
      </div>
      {ready && <img className="reward-card-image" src={ready.url} width="1200" height="900" alt={`Open Door reward card: ${data.medals.map(medal => `${medal.name} ${medal.level}`).join(", ") || "no medals yet"}; ${data.trophy ? `${data.trophy} trophy` : "no trophy yet"}; ${data.stars} earned stars.`} />}
    </section>}
  </div>;
}
