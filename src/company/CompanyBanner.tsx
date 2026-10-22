import { Link } from "wouter";
import type { CompanyProfile } from "./profiles";
import { companyUrl } from "./profiles";
import "./company.css";

type Props = {
  profile: CompanyProfile;
  page: "discover" | "lab";
};

export default function CompanyBanner({ profile, page }: Props) {
  const otherPage = page === "discover" ? "lab" : "discover";
  const otherPageLabel = page === "discover" ? "Try the idea lab" : "Try discovery";

  return <aside className="company-banner" aria-label={`${profile.name} company context`}>
    <div className="company-banner-copy">
      <span className="company-banner-label">Company example · {profile.name}</span>
      <p>{page === "discover" ? profile.discoveryCopy : profile.labCopy}</p>
      <span className="company-banner-note">Illustrative starting point only. Inputs are editable; saved doors belong to the signed-in individual, not a shared company workspace. Check real availability and suitability independently.</span>
    </div>
    <nav className="company-banner-actions" aria-label="Company experience navigation">
      <a href={companyUrl(otherPage, profile.id)}>{otherPageLabel}</a>
      <a className="company-banner-active" href={companyUrl(page, profile.id)} aria-current="page">{page === "discover" ? "Discovery" : "Idea lab"}</a>
      <Link href={`/companies#company-type`}>Change company type</Link>
      <Link href="/">Individual experience</Link>
    </nav>
  </aside>;
}
