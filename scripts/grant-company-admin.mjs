// Run only in the intended environment with that environment's Clerk credentials.
// The owner supplies an existing, verified account email. No default admin or password.
import { createClerkClient } from "@clerk/express";

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: node scripts/grant-company-admin.mjs <verified-account-email>");
  process.exit(1);
}
try {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const result = await clerk.users.getUserList({ emailAddress: [email], limit: 10 });
  const matches = result.data.filter(user => user.emailAddresses.some(address =>
    address.emailAddress.toLowerCase() === email && address.verification?.status === "verified"));
  if (matches.length !== 1) throw new Error("Sign up and verify this account in the intended environment before granting access.");
  if (matches[0].publicMetadata?.role !== "admin") {
    await clerk.users.updateUserMetadata(matches[0].id, { publicMetadata: { role: "admin" } });
  }
  console.log("Admin access granted to the verified account in this Clerk environment.");
} catch {
  console.error("Admin grant failed. Check the account is verified and the intended environment is configured. No account was created.");
  process.exit(1);
}
