import React from "react";
import { Scale, LayoutDashboard, FileText, Vote, ScrollText } from "lucide-react";

export type TabType = "dashboard" | "requests" | "amendments" | "precedents";

interface HeaderProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange }) => {
  return (
    <header className="app-header">
      <div className="header-container">
        <div className="brand" onClick={() => onTabChange("dashboard")} style={{ cursor: "pointer" }}>
          <div className="brand-logo">
            <Scale size={26} className="brand-icon" />
          </div>
          <div className="brand-text">
            <span className="brand-title">LivingCharter</span>
            <span className="brand-subtitle">AI Governance & Treasury Protocol</span>
          </div>
        </div>

        <nav className="header-nav" aria-label="Main Navigation">
          <button
            className={`nav-btn ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => onTabChange("dashboard")}
            aria-selected={activeTab === "dashboard"}
            type="button"
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </button>

          <button
            className={`nav-btn ${activeTab === "requests" ? "active" : ""}`}
            onClick={() => onTabChange("requests")}
            aria-selected={activeTab === "requests"}
            type="button"
          >
            <FileText size={18} />
            <span>Requests</span>
          </button>

          <button
            className={`nav-btn ${activeTab === "amendments" ? "active" : ""}`}
            onClick={() => onTabChange("amendments")}
            aria-selected={activeTab === "amendments"}
            type="button"
          >
            <Vote size={18} />
            <span>Amendments</span>
          </button>

          <button
            className={`nav-btn ${activeTab === "precedents" ? "active" : ""}`}
            onClick={() => onTabChange("precedents")}
            aria-selected={activeTab === "precedents"}
            type="button"
          >
            <ScrollText size={18} />
            <span>Precedents</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
