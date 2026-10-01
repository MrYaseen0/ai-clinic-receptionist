import type { Metadata } from "next";
import AdminPanel from "./AdminPanel";
import { isAdminConfigured } from "@/lib/admin-auth";

// Must be dynamic: the fail-closed check reads ADMIN_PASSWORD at request time,
// so a deploy that sets the env var after build still works.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin — Sehat Clinic",
  description: "Demo admin panel: view and manage AI-booked appointments.",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  // Fail closed: never show a login form backed by a default password in production.
  if (!isAdminConfigured()) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="text-3xl font-bold text-slate-900">Admin Panel</h1>
        <div className="mt-8 max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-6">
          <p className="font-semibold text-amber-900">Admin not configured</p>
          <p className="mt-2 text-sm text-amber-800">
            This deployment has no <code className="font-mono">ADMIN_PASSWORD</code> set,
            so the admin panel is disabled. Set the{" "}
            <code className="font-mono">ADMIN_PASSWORD</code> environment variable
            and redeploy to enable it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold text-slate-900">Admin Panel</h1>
      <p className="mt-2 text-slate-600">
        Demo dashboard — every appointment booked through the AI receptionist
        appears here.
      </p>
      <div className="mt-8">
        <AdminPanel />
      </div>
    </div>
  );
}
