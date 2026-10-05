import { Link } from "react-router-dom";
import { signOut, useAuth } from "../lib/auth";
import { authConfigured } from "../lib/supabase";
import { useSyncStatus } from "../lib/sync";

const LABEL: Record<string, string> = { saving: "Saving…", synced: "Synced", error: "Sync error", idle: "", off: "" };

export function AccountMenu() {
  const { user, loading } = useAuth();
  const { status, error } = useSyncStatus();
  if (!authConfigured) return null;
  if (loading) return <span className="ml-2 text-xs text-ink-3">…</span>;
  if (!user)
    return (
      <Link to="/signin" className="btn ml-2">
        Sign in
      </Link>
    );
  const dot = status === "error" ? "bg-loss" : status === "saving" ? "bg-accent" : "bg-profit";
  return (
    <span className="ml-2 flex items-center gap-2 text-xs text-ink-2">
      <span className={`inline-block h-2 w-2 rounded-full ${dot}`} title={error || LABEL[status]} aria-hidden />
      <span className="hidden sm:inline">{LABEL[status] || user.email}</span>
      <span className="hidden max-w-40 truncate md:inline" title={user.email ?? ""}>
        {LABEL[status] ? user.email : ""}
      </span>
      <button className="btn !px-2" onClick={() => void signOut()}>
        Sign out
      </button>
    </span>
  );
}
