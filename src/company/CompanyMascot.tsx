import { MascotArt } from "../MascotArt";
import type { CompanyType } from "./profiles";

const COMPANY_SCENES = {
  business: "company-business",
  "real-estate": "company-real-estate",
  hospitality: "company-travel",
  celebrations: "company-destination",
  other: "explorer",
} as const;

type Props = {
  companyType: CompanyType;
  priority?: boolean;
};

export function CompanyMascot({ companyType, priority = false }: Props) {
  const scene = COMPANY_SCENES[companyType];
  return <div className="company-mascot-art">
    <MascotArt key={scene} scene={scene} priority={priority} />
  </div>;
}
