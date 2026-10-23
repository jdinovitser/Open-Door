import { useEffect } from "react";
import { legacyCompanyDestination } from "./commercialRouting";

export default function LegacyCompanyRoute() {
  const destination = legacyCompanyDestination(window.location.search, window.location.hash);
  useEffect(() => { window.location.replace(destination); }, [destination]);
  return <p role="status">Opening the updated page… <a href={destination}>Continue</a></p>;
}
