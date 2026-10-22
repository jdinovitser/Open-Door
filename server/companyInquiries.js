import { Router } from "express";
import { createRateLimiter } from "./security.js";

const TYPES = new Set(["celebrations", "real-estate", "hospitality", "business", "other"]);
const STATUSES = new Set(["new", "reviewing", "contacted", "closed"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COLUMNS = `id, company_type AS "companyType", type_description AS "typeDescription",
  company, contact_name AS name, email, website, details, status,
  created_at AS "createdAt", updated_at AS "updatedAt"`;

export function validateCompanyInquiry(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Complete the customization request.");
  function text(key, label, max, min = 1) {
    const value = typeof input[key] === "string" ? input[key].trim() : "";
    if (value.length < min || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
      throw new Error(`${label} must be ${min ? `${min}–` : "at most "}${max} characters.`);
    }
    return value;
  }
  if (!TYPES.has(input.companyType)) throw new Error("Choose a company type.");
  if (input.consent !== true) throw new Error("Please agree to having Open Door store this request and contact you about it.");
  if (!UUID.test(input.requestId || "")) throw new Error("Refresh the form and try again.");
  if (input.websiteTrap) throw new Error("The request could not be accepted.");
  const email = text("email", "Email", 254);
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw new Error("Enter a valid contact email.");
  const website = text("website", "Website", 300, 0);
  if (website) {
    try {
      const url = new URL(website);
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error();
    } catch { throw new Error("Website must be an http:// or https:// address without credentials."); }
  }
  return {
    id: input.requestId, companyType: input.companyType,
    typeDescription: text("typeDescription", "Company type description", 200, input.companyType === "other" ? 1 : 0),
    company: text("company", "Company", 160), name: text("name", "Contact name", 120),
    email, website, details: text("details", "Project details", 4000, 20),
  };
}

export function createCompanyInquiriesRouter({ pool, getUserId, users, limiter } = {}) {
  const router = Router();
  router.use((_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  const requireStorage = (_request, response, next) => {
    if (!pool) return response.status(503).json({ message: "Inquiry storage is unavailable. Your request was not saved; please try again later." });
    next();
  };
  // Public requests may only insert; all contact data reads require a server-verified role.
  router.post("/inquiries", limiter || createRateLimiter({ windowMs: 15 * 60_000, maxRequests: 15 }), requireStorage, async (request, response) => {
    let data;
    try { data = validateCompanyInquiry(request.body); }
    catch (error) { return response.status(400).json({ message: error.message }); }
    try {
      const result = await pool.query(`INSERT INTO open_door_company_inquiries
        (id, company_type, type_description, company, contact_name, email, website, details)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id RETURNING id, created_at AS "submittedAt"`,
      [data.id, data.companyType, data.typeDescription, data.company, data.name, data.email, data.website, data.details]);
      // A retry must be idempotent. Do not return any original contact data.
      response.status(201).json({ id: data.id, submittedAt: result.rows[0].submittedAt });
    } catch {
      response.status(503).json({ message: "Your request could not be saved. Keep your details and try again." });
    }
  });

  router.use("/admin", async (request, response, next) => {
    const userId = getUserId(request);
    if (!userId) return response.status(401).json({ message: "Sign in to access company inquiries." });
    try {
      const user = await users.getUser(userId);
      if (user.publicMetadata?.role !== "admin") return response.status(403).json({ message: "Admin access is required. The project owner must grant access to your verified account." });
      next();
    } catch {
      response.status(503).json({ message: "Admin permission could not be verified. Please try again." });
    }
  });
  router.get("/admin/access", (_request, response) => response.json({ admin: true }));
  router.use("/admin", requireStorage);
  router.get("/admin/inquiries", async (request, response) => {
    const status = request.query.status || "all";
    const page = Number(request.query.page || 1);
    if ((status !== "all" && !STATUSES.has(status)) || !Number.isInteger(page) || page < 1 || page > 100_000) {
      return response.status(400).json({ message: "Choose a valid inquiry status and page." });
    }
    try {
      const params = [status === "all" ? null : status];
      const where = "WHERE ($1::text IS NULL OR status = $1)";
      const [count, records] = await Promise.all([
        pool.query(`SELECT COUNT(*)::integer AS total FROM open_door_company_inquiries ${where}`, params),
        pool.query(`SELECT ${COLUMNS} FROM open_door_company_inquiries ${where}
          ORDER BY created_at DESC, id DESC LIMIT 25 OFFSET $2`, [...params, (page - 1) * 25]),
      ]);
      response.json({ inquiries: records.rows, total: count.rows[0].total, page, pageSize: 25 });
    } catch { response.status(503).json({ message: "Company inquiries could not be loaded. Please try again." }); }
  });
  router.patch("/admin/inquiries/:id", async (request, response) => {
    if (!UUID.test(request.params.id) || !STATUSES.has(request.body?.status)) return response.status(400).json({ message: "Choose a valid inquiry and status." });
    try {
      const result = await pool.query(`UPDATE open_door_company_inquiries SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING ${COLUMNS}`, [request.params.id, request.body.status]);
      if (!result.rows[0]) return response.status(404).json({ message: "This inquiry no longer exists." });
      response.json({ inquiry: result.rows[0] });
    } catch { response.status(503).json({ message: "The status could not be saved. Please try again." }); }
  });
  router.delete("/admin/inquiries/:id", async (request, response) => {
    if (!UUID.test(request.params.id)) return response.status(400).json({ message: "Choose a valid inquiry." });
    try {
      const result = await pool.query("DELETE FROM open_door_company_inquiries WHERE id = $1", [request.params.id]);
      if (!result.rowCount) return response.status(404).json({ message: "This inquiry no longer exists." });
      response.json({ deleted: true });
    } catch { response.status(503).json({ message: "The inquiry could not be deleted. Please try again." }); }
  });
  return router;
}
