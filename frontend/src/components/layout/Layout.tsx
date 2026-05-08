import React from "react";
import { Icon } from "../common/Icon";
import type { IconName } from "../common/Icon";
import { Sidebar } from "./Sidebar";
import type { ViewKey } from "./Sidebar";
import { TopBar } from "./TopBar";
import type { ResolvedTheme, ThemePreference } from "../../hooks/useThemePreference";

interface LayoutProps {
  children: React.ReactNode;
  activeView: ViewKey;
  onViewChange: (view: ViewKey) => void;
  views: Array<{ key: ViewKey; label: string; icon: IconName }>;
  onRefresh: () => void;
  onLogout: () => void;
  onThemeCycle: () => void;
  currentUser: { name: string; email: string } | null;
  resolvedTheme: ResolvedTheme;
  status: "online" | "offline";
  themePreference: ThemePreference;
}

const mobileViews: ViewKey[] = ["dashboard", "materials", "chat", "quizzes", "progress"];

function mobileLabel(view: ViewKey) {
  if (view === "dashboard") return "Home";
  if (view === "chat") return "Chat";
  return view.charAt(0).toUpperCase() + view.slice(1);
}

export function Layout({
  children,
  activeView,
  onViewChange,
  views,
  onRefresh,
  onLogout,
  onThemeCycle,
  currentUser,
  resolvedTheme,
  status,
  themePreference,
}: LayoutProps) {
  const activeViewLabel = views.find((view) => view.key === activeView)?.label || "";
  const mobileNavViews = views.filter((view) => mobileViews.includes(view.key));

  return (
    <div className="layout-root">
      <Sidebar
        activeView={activeView}
        onViewChange={onViewChange}
        views={views}
        onLogout={onLogout}
        currentUser={currentUser}
        status={status}
      />
      <div className="main-wrapper">
        <TopBar
          onRefresh={onRefresh}
          onThemeCycle={onThemeCycle}
          resolvedTheme={resolvedTheme}
          themePreference={themePreference}
          title={activeViewLabel}
        />
        <main className="main-content">{children}</main>
      </div>
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {mobileNavViews.map((view) => (
          <button
            className={activeView === view.key ? "mobile-nav-item active" : "mobile-nav-item"}
            key={view.key}
            onClick={() => onViewChange(view.key)}
            type="button"
          >
            <Icon name={view.icon} />
            <span>{mobileLabel(view.key)}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
