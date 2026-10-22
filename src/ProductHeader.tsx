import type { ReactNode } from "react";
import { Link } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { Volume2, VolumeX } from "lucide-react";
import { signInFor } from "./authReturn";
import { useSoundEffects } from "./useSoundEffects";
import "./ProductHeader.css";

export type ProductView = "discover" | "lab" | "saved" | "how" | "trust" | "progress" | "companies";

type ProductHeaderProps = {
  view?: ProductView;
  onNavigate?: (view: ProductView) => void;
  savedCount?: number;
  signedIn?: boolean;
  controls?: ReactNode;
  companyLink?: string;
};

type AvenueProps = { active: "individual" | "company" };

function ProductAccountControls() {
  const { isSignedIn, isLoaded } = useUser();
  const { signOut } = useClerk();
  const sound = useSoundEffects();
  const returnTo = typeof window === "undefined" ? "/" : `${window.location.pathname}${window.location.search}`;

  return <div className="account-control product-account-controls">
    {isSignedIn ? <>
      <span className="account-label" aria-live="polite">{isLoaded ? "Your personal guide" : "Loading your account…"}</span>
      <Link className="account-sign-out" href="/trust">Account &amp; privacy</Link>
      <button type="button" className="account-sign-out" onClick={() => void signOut({ redirectUrl: "/" })}>Sign out</button>
    </> : <a className="account-sign-in" href={signInFor(returnTo)}>Sign in</a>}
    <button className="sound-toggle" type="button" data-sound="none" onClick={sound.toggle}
      aria-pressed={sound.enabled} aria-label={`Sound effects: ${sound.enabled ? "on" : "off"}`}
      title={sound.notice || (sound.enabled ? "Mute sound effects" : "Enable gentle sound effects")}>
      {sound.enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
      <span>Sound {sound.enabled ? "on" : "off"}</span>
    </button>
    {sound.notice && <span className="product-sound-notice" role="status">{sound.notice}</span>}
  </div>;
}

export function ProductHeader({ view, onNavigate, savedCount = 0, signedIn = false, controls, companyLink }: ProductHeaderProps) {
  const items: { view: ProductView; label: string; href: string }[] = [
    { view: "discover", label: "Discover", href: "/?explore=1" },
    { view: "lab", label: "Discovery Lab", href: "/lab" },
    { view: "saved", label: "My Doors", href: "/?view=saved" },
    { view: "how", label: "How it works", href: "/?view=how" },
    { view: "trust", label: "Trust", href: "/trust" },
    ...(signedIn ? [{ view: "progress" as const, label: "Progress", href: "/progress" }] : []),
  ];

  return <header className="topbar product-header">
    <Link className="brand" href="/?explore=1" aria-label="Open Door, Discover">
      <span className="brand-mark"><img src="/mascot/qloo-guide-still.webp" alt="" width="400" height="225" /></span>
      <span><span className="brand-name">open door</span><span className="brand-caption">a cultural field guide</span></span>
    </Link>
    <nav className="nav" aria-label="Main navigation">
      {items.map(item => onNavigate
        ? <button key={item.view} type="button" className={`nav-btn ${view === item.view ? "active" : ""}`} aria-current={view === item.view ? "page" : undefined} onClick={() => onNavigate(item.view)}>
          {item.label}{item.view === "saved" && <span className="nav-count">{savedCount || ""}</span>}
        </button>
        : <Link key={item.view} className={`nav-btn ${view === item.view ? "active" : ""}`} aria-current={view === item.view ? "page" : undefined} href={item.href}>
          {item.label}{item.view === "saved" && <span className="nav-count">{savedCount || ""}</span>}
        </Link>)}
      {onNavigate
        ? <a className={`nav-btn ${view === "companies" ? "active" : ""}`} href={companyLink || "/companies"} aria-current={view === "companies" ? "page" : undefined}>For companies</a>
        : <Link className={`nav-btn ${view === "companies" ? "active" : ""}`} href={companyLink || "/companies"} aria-current={view === "companies" ? "page" : undefined}>For companies</Link>}
    </nav>
    {controls ?? <ProductAccountControls />}
  </header>;
}

export function ProductAvenues({ active }: AvenueProps) {
  return <nav className="product-avenues" aria-label="Ways to use Open Door">
    <span className="product-avenues-intro">One guide, two ways in</span>
    <Link href="/?explore=1" className={`product-avenue ${active === "individual" ? "is-active" : ""}`} aria-current={active === "individual" ? "page" : undefined}>
      <span className="product-avenue-index">01</span><span>Explore for yourself</span>
    </Link>
    <Link href="/companies" className={`product-avenue ${active === "company" ? "is-active" : ""}`} aria-current={active === "company" ? "page" : undefined}>
      <span className="product-avenue-index">02</span><span>Help others explore</span>
    </Link>
  </nav>;
}
