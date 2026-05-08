import { Icon } from "../common/Icon";
import type { IconName } from "../common/Icon";
import logoMark from "../../assets/prepmind-mark.svg";

export type ViewKey = "dashboard" | "materials" | "chat" | "flashcards" | "quizzes" | "progress" | "settings";

interface SidebarProps {
  activeView: ViewKey;
  onViewChange: (view: ViewKey) => void;
  views: Array<{ key: ViewKey; label: string; icon: IconName }>;
  onLogout: () => void;
  currentUser: { name: string; email: string } | null;
  status: "online" | "offline";
}

export function Sidebar({ activeView, onViewChange, views, onLogout, currentUser, status }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img alt="PrepMind AI" className="sidebar-logo" src={logoMark} />
        <div>
          <h2>PrepMind AI</h2>
          <span className={`status-indicator ${status}`}>{status}</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Primary navigation">
        {views.map((view) => (
          <button
            className={activeView === view.key ? "nav-item active" : "nav-item"}
            key={view.key}
            onClick={() => onViewChange(view.key)}
            type="button"
          >
            <Icon name={view.icon} />
            <span>{view.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-chip">
          <div className="user-avatar">
            <Icon name="user" />
          </div>
          <div>
            <strong>{currentUser?.name || "Student"}</strong>
            <span>{currentUser?.email || "Signed in"}</span>
          </div>
        </div>
        <button aria-label="Sign out" className="logout-button" onClick={onLogout} type="button">
          <Icon name="logout" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
