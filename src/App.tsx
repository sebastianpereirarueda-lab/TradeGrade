import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { Dashboard } from "./pages/Dashboard";
import { CalendarPage } from "./pages/Calendar";
import { DayPage } from "./pages/Day";
import { RulesPage } from "./pages/Rules";
import { ImportPage } from "./pages/Import";
import { todayKey } from "./lib/dates";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/calendar", label: "Calendar" },
  { to: `/day/${todayKey()}`, label: "Today" },
  { to: "/rules", label: "Rules" },
  { to: "/import", label: "Import" },
];

export default function App() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3 py-5">
        <h1 className="flex items-baseline gap-2 text-base font-semibold tracking-wide text-ink">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-profit" aria-hidden />
          TradeGrade
          <span className="text-xs font-normal text-ink-3">Your trading, graded.</span>
        </h1>
        <nav className="flex gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm ${isActive ? "bg-surface-2 text-ink" : "text-ink-2 hover:text-ink"}`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/day/:date" element={<DayPage />} />
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
