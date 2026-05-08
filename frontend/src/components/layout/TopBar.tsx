import logoMark from "../../assets/prepmind-mark.svg";
import { Icon } from "../common/Icon";
import type { IconName } from "../common/Icon";
import type { ResolvedTheme, ThemePreference } from "../../hooks/useThemePreference";

interface TopBarProps {
  onRefresh: () => void;
  onThemeCycle: () => void;
  resolvedTheme: ResolvedTheme;
  themePreference: ThemePreference;
  title: string;
}

function themeIcon(preference: ThemePreference, resolvedTheme: ResolvedTheme): IconName {
  if (preference === "system") return "monitor";
  return resolvedTheme === "dark" ? "moon" : "sun";
}

export function TopBar({ onRefresh, onThemeCycle, resolvedTheme, themePreference, title }: TopBarProps) {
  const themeLabel = themePreference === "system" ? `System (${resolvedTheme})` : themePreference;

  return (
    <header className="main-header">
      <div className="mobile-brand">
        <img alt="PrepMind AI" src={logoMark} />
        <span>PrepMind AI</span>
      </div>
      <div className="header-left">
        <span className="small-label">Current section</span>
        <h1 className="view-title">{title}</h1>
      </div>
      <div className="header-actions">
        <button
          aria-label={`Theme: ${themeLabel}. Switch theme`}
          className="icon-button"
          onClick={onThemeCycle}
          title={`Theme: ${themeLabel}`}
          type="button"
        >
          <Icon name={themeIcon(themePreference, resolvedTheme)} />
        </button>
        <button aria-label="Sync workspace" className="icon-button" onClick={onRefresh} title="Sync workspace" type="button">
          <Icon name="refresh" />
        </button>
      </div>
    </header>
  );
}
