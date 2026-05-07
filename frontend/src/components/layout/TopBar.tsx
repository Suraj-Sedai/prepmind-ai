import logoMark from "../../assets/prepmind-mark.svg";
import { Icon } from "../common/Icon";

interface TopBarProps {
  onRefresh: () => void;
  title: string;
}

export function TopBar({ onRefresh, title }: TopBarProps) {
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
      <button className="icon-button" onClick={onRefresh} title="Sync workspace" type="button">
        <Icon name="refresh" />
      </button>
    </header>
  );
}
