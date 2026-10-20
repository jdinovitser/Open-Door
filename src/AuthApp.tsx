import { useEffect } from "react";
import {
  ClerkProvider,
  SignIn,
  SignUp,
  useClerk,
} from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Link, Route, Router, Switch, useLocation } from "wouter";
import App from "./App";
import "./auth.css";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: "bottom" as const,
    socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    colorPrimary: "#35675a",
    colorForeground: "#234b40",
    colorMutedForeground: "#66766c",
    colorBackground: "#fffefa",
    colorInput: "#fffefa",
    colorInputForeground: "#234b40",
    colorDanger: "#a94c42",
    colorNeutral: "#d9ded4",
    fontFamily: "'DM Sans', sans-serif",
    borderRadius: "14px",
  },
  elements: {
    rootBox: { width: "100%", display: "flex", justifyContent: "center" },
    cardBox: { width: "min(100%, 440px)", backgroundColor: "#fffefa", borderRadius: "18px", border: "1px solid #d9ded4", boxShadow: "0 14px 34px rgba(35, 58, 48, .08)", overflow: "hidden" },
    card: { backgroundColor: "transparent", boxShadow: "none", border: "0" },
    footer: { backgroundColor: "transparent", boxShadow: "none", border: "0" },
    headerTitle: { color: "#234b40", fontWeight: "700" },
    headerSubtitle: { color: "#66766c" },
    formFieldLabel: { color: "#234b40", fontWeight: "600" },
    formFieldInput: { color: "#234b40", backgroundColor: "#fffefa", border: "1px solid #d9ded4", borderRadius: "10px" },
    formButtonPrimary: { color: "#fffefa", backgroundColor: "#35675a", borderRadius: "10px", fontWeight: "600" },
    footerActionLink: { color: "#35675a", fontWeight: "600" },
    footerActionText: { color: "#66766c" },
    socialButtonsBlockButton: { color: "#234b40", backgroundColor: "#fffefa", border: "1px solid #d9ded4", borderRadius: "10px" },
    socialButtonsBlockButtonText: { color: "#234b40", fontWeight: "600" },
    dividerText: { color: "#66766c" },
    formFieldSuccessText: { color: "#35675a" },
    alertText: { color: "#8d3f36" },
  },
};

function ContinueAsGuest() {
  return <p className="auth-guest"><Link href="/">Continue as guest</Link></p>;
}

function SignInPage() {
  useEffect(() => {
    document.title = "Sign in | Open Door";
    return () => { document.title = "Open Door — Find your way into a new place"; };
  }, []);
  return <main className="auth-screen">
    <div className="auth-panel">
      <span className="eyebrow">Open Door · a cultural field guide</span>
      <h1>Welcome back.</h1>
      <p>Sign in to access your saved doors, or continue as a guest.</p>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      <ContinueAsGuest />
    </div>
  </main>;
}

function SignUpPage() {
  useEffect(() => {
    document.title = "Create an account | Open Door";
    return () => { document.title = "Open Door — Find your way into a new place"; };
  }, []);
  return <main className="auth-screen">
    <div className="auth-panel">
      <span className="eyebrow">Open Door · a cultural field guide</span>
      <h1>Keep your doors.</h1>
      <p>Create an account to save your cultural discoveries and see them on your other devices.</p>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      <ContinueAsGuest />
    </div>
  </main>;
}

function ClerkRoutes() {
  const [, setLocation] = useLocation();
  const { signOut } = useClerk();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{
      signIn: { start: { title: "Welcome back", subtitle: "Sign in to get back to your saved doors." } },
      signUp: { start: { title: "Create your account", subtitle: "Keep your saved doors with you." } },
    }}
    routerPush={to => { setLocation(basePath && to.startsWith(basePath) ? to.slice(basePath.length) || "/" : to); }}
    routerReplace={to => { setLocation(basePath && to.startsWith(basePath) ? to.slice(basePath.length) || "/" : to, { replace: true }); }}
  >
    <Switch>
      <Route path="/" component={() => <App signOut={signOut} />} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route component={() => <App signOut={signOut} />} />
    </Switch>
  </ClerkProvider>;
}

export default function AuthApp() {
  return <Router base={basePath}><ClerkRoutes /></Router>;
}
