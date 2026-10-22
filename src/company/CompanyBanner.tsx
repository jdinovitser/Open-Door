import type { CompanyProfile } from "./profiles";
import "./company.css";

export type CompanyBannerProps = {
  profile: CompanyProfile;
  location: string;
  occasion: string;
  onEditOccasion: () => void;
  organizerHref: string;
};

export default function CompanyBanner({ profile, location, occasion, onEditOccasion, organizerHref }: CompanyBannerProps) {
  return <aside className="company-banner" aria-label={`${profile.name} occasion context`}>
    <div className="company-banner-copy">
      <span className="company-banner-label">Your occasion</span>
      <p className="company-banner-context">
        <strong>{location || "Place not set"}</strong>
        <span aria-hidden="true"> · </span>
        <span>{occasion || "Occasion not set"}</span>
      </p>
      <span className="company-banner-preset">{profile.name}</span>
      <span className="company-banner-note">Your saved doors belong to you. The company cannot view your private preferences.</span>
    </div>
    <nav className="company-banner-actions" aria-label="Occasion options">
      <button type="button" onClick={onEditOccasion}>Change occasion</button>
      <a href={organizerHref}>Change company type</a>
      <a href="/?explore=1">Explore on my own</a>
    </nav>
  </aside>;
}
