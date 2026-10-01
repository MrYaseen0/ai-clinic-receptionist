/**
 * Admin authentication — FAIL CLOSED in production.
 *
 * - If ADMIN_PASSWORD is set (non-empty), it is the password.
 * - If it is unset/empty AND NODE_ENV=production → null (admin disabled,
 *   routes must answer 503 "Admin not configured", never a default password).
 * - If it is unset/empty in development → "demo123" convenience default.
 */

export function getAdminPassword(): string | null {
  const v = process.env.ADMIN_PASSWORD;
  if (v && v.trim().length > 0) return v;
  if (process.env.NODE_ENV === "production") return null;
  return "demo123";
}

export function isAdminConfigured(): boolean {
  return getAdminPassword() !== null;
}
