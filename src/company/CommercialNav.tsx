import { Link } from "wouter";
import "./commercial-nav.css";

export type CommercialPage = "partners" | "contact" | "mockups";

const pages: { id: CommercialPage; label: string; href: string }[] = [
  { id: "partners", label: "Business Model and Partnerships", href: "/partners" },
  { id: "contact", label: "Talk to us", href: "/contact" },
  { id: "mockups", label: "Partnership mockups", href: "/mockups" },
];

export default function CommercialNav({ active }: { active: CommercialPage }) {
  return <nav className="commercial-nav" aria-label="Business Model and Partnerships">
    {pages.map(page => <Link
      key={page.id}
      href={page.href}
      aria-current={active === page.id ? "page" : undefined}
    >{page.label}</Link>)}
  </nav>;
}
