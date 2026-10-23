import { useEffect } from "react";
import { useUser } from "@clerk/react";
import { ProductHeader } from "../ProductHeader";
import CommercialNav from "./CommercialNav";
import PartnerMockups from "./PartnerMockups";
import "./company.css";
import "./partner-mockups.css";
import "./commercial-nav.css";

export default function MockupsPage() {
  const { isSignedIn } = useUser();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Partnership mockups | Open Door";
    return () => { document.title = previousTitle; };
  }, []);

  return <div className="company-portal partnership-mockups-page">
    <ProductHeader view="companies" signedIn={Boolean(isSignedIn)} />
    <CommercialNav active="mockups" />
    <main className="company-shell partnership-mockups-main">
      <header className="partnership-mockups-intro">
        <span className="company-eyebrow">Illustrative, not live placements</span>
        <h1>Partnership mockups</h1>
        <p>Fictional examples show how a clearly labeled sponsored option might sit beside independent cultural discovery.</p>
      </header>
      <PartnerMockups />
    </main>
  </div>;
}
