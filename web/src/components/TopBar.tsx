import {
  ChevronDown,
  Plus,
  Pencil,
  LogOut,
  Settings,
  User,
  Diamond,
  Boxes,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import type { Project } from "../types";
import type { UserProfile } from "../App";

interface Props {
  activeProject: string;
  onProjectChange: (id: string) => void;
  onNewProject: () => void;
  projects: Project[];
  user: UserProfile;
  onOpenProfile: () => void;
  onLogout: () => void;
}

export default function TopBar({
  activeProject,
  onProjectChange,
  onNewProject,
  projects,
  user,
  onOpenProfile,
  onLogout,
}: Props) {
  const [projectOpen, setProjectOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const projectRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const active = projects.find(p => p.id === activeProject);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (projectRef.current && !projectRef.current.contains(e.target as Node))
        setProjectOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node))
        setUserOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div
      className="h-[52px] flex items-center px-5 gap-4 select-none shrink-0 relative z-50"
      style={{
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border-subtle)",
        boxShadow: "0 1px 8px rgba(0,0,0,0.3)",
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 mr-4">
        <Diamond size={14} style={{ color: "#ffa27a" }} className="shrink-0" />
        <span
          className="text-sm tracking-[0.2em] font-semibold"
          style={{
            color: "#e2e8f0",
            fontFamily: "'Space Grotesk', 'Inter', sans-serif",
            textShadow: "0 0 20px rgba(255,162,122,0.15)",
          }}
        >
          AI4S.SWARM
        </span>
        <span
          className="text-[10px] tracking-wider hidden lg:inline"
          style={{ color: "var(--text-muted)" }}
        >
          多智能体编排控制孪生空间
        </span>
      </div>

      {/* Divider */}
      <div
        className="h-5 w-px"
        style={{ background: "var(--border-medium)" }}
      />

      {/* Project Selector */}
      <div className="relative" ref={projectRef}>
        <button
          onClick={() => setProjectOpen(!projectOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all"
          style={{
            background: projectOpen ? "rgba(255,162,122,0.06)" : "transparent",
            border: "1px solid var(--border-medium)",
            color: "var(--text-secondary)",
          }}
        >
          <span style={{ color: "#ffa27a", fontSize: 10 }}>
            {activeProject === "all" ? "◈" : "◆"}
          </span>
          <span>{activeProject === "all" ? "全部项目" : active?.name}</span>
          <ChevronDown
            size={12}
            className="transition-transform duration-300"
            style={{
              transform: projectOpen ? "rotate(180deg)" : "none",
              color: "var(--text-muted)",
            }}
          />
        </button>

        {projectOpen && (
          <div
            className="absolute top-full left-0 mt-1.5 py-2 rounded-xl min-w-[220px] animate-scale-in"
            style={{
              zIndex: 100,
              background:
                "linear-gradient(175deg, rgba(5,8,18,0.98) 0%, rgba(3,5,12,0.98) 100%)",
              border: "1px solid rgba(200,149,108,0.05)",
              backdropFilter: "blur(40px) saturate(160%)",
              boxShadow:
                "0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,162,122,0.03)",
            }}
          >
            <button
              onClick={() => {
                onProjectChange("all");
                setProjectOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-all rounded-lg mx-1.5"
              style={{
                color:
                  activeProject === "all" ? "#ffa27a" : "var(--text-secondary)",
                background:
                  activeProject === "all"
                    ? "rgba(255,162,122,0.06)"
                    : "transparent",
                width: "calc(100% - 12px)",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color:
                    activeProject === "all" ? "#ffa27a" : "var(--text-muted)",
                }}
              >
                ◈
              </span>
              全部项目
            </button>
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => {
                  onProjectChange(p.id);
                  setProjectOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-all rounded-lg mx-1.5"
                style={{
                  color:
                    activeProject === p.id
                      ? "#ffa27a"
                      : "var(--text-secondary)",
                  background:
                    activeProject === p.id
                      ? "rgba(255,162,122,0.06)"
                      : "transparent",
                  width: "calc(100% - 12px)",
                }}
              >
                <span style={{ fontSize: 10, color: "#ffa27a" }}>◆</span>
                <span>{p.name}</span>
                {activeProject === p.id && (
                  <Pencil
                    size={10}
                    className="ml-auto opacity-40 hover:opacity-80"
                    style={{ color: "#ffa27a" }}
                  />
                )}
              </button>
            ))}
            <div
              className="mx-3 my-1.5 h-px"
              style={{ background: "var(--border-subtle)" }}
            />
            <button
              onClick={() => {
                onNewProject();
                setProjectOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors rounded-lg mx-1.5"
              style={{ color: "var(--text-muted)", width: "calc(100% - 12px)" }}
            >
              <Plus size={10} style={{ color: "var(--text-muted)" }} />
              新建项目
            </button>
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      <Link
        to="/capabilities"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all hover:border-[rgba(255,162,122,0.2)]"
        style={{
          border: "1px solid var(--border-medium)",
          color: "var(--text-secondary)",
        }}
      >
        <Boxes size={12} style={{ color: "#ffa27a" }} />
        <span className="hidden sm:inline">能力中心</span>
      </Link>

      {/* New Project Quick Action */}
      <button
        onClick={onNewProject}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all hover:border-[rgba(255,162,122,0.2)]"
        style={{
          border: "1px solid var(--border-medium)",
          color: "var(--text-secondary)",
        }}
      >
        <Plus size={12} style={{ color: "#ffa27a" }} />
        <span className="hidden sm:inline">新建项目</span>
      </button>

      {/* Divider */}
      <div
        className="h-5 w-px"
        style={{ background: "var(--border-medium)" }}
      />

      {/* User Avatar Dropdown */}
      <div className="relative" ref={userRef}>
        <button
          onClick={() => setUserOpen(!userOpen)}
          className="flex items-center gap-2.5 transition-all rounded-lg px-2 py-1"
          style={{
            background: userOpen ? "rgba(255,162,122,0.06)" : "transparent",
          }}
        >
          <div className="relative">
            <img
              src={user.avatar}
              alt={user.name}
              className="w-7 h-7 rounded-full object-cover"
              style={{
                border: "1.5px solid rgba(255,162,122,0.3)",
                boxShadow: "0 0 8px rgba(255,162,122,0.15)",
              }}
            />
            <div
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
              style={{
                background: "#3ddc84",
                border: "2px solid var(--bg-secondary)",
              }}
            />
          </div>
          <div className="hidden md:flex flex-col items-start">
            <span
              className="text-[11px] font-medium leading-none"
              style={{ color: "var(--text-primary)" }}
            >
              {user.name}
            </span>
            <span
              className="text-[9px] leading-none mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              {user.role}
            </span>
          </div>
          <ChevronDown
            size={12}
            className="transition-transform duration-300"
            style={{
              transform: userOpen ? "rotate(180deg)" : "none",
              color: "var(--text-muted)",
            }}
          />
        </button>

        {userOpen && (
          <div
            className="absolute top-full right-0 mt-1.5 py-2 rounded-xl min-w-[200px] animate-scale-in"
            style={{
              zIndex: 100,
              background:
                "linear-gradient(175deg, rgba(5,8,18,0.98) 0%, rgba(3,5,12,0.98) 100%)",
              border: "1px solid rgba(200,149,108,0.05)",
              backdropFilter: "blur(40px) saturate(160%)",
              boxShadow:
                "0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,162,122,0.03)",
            }}
          >
            {/* User info header */}
            <div className="px-3 py-2 flex items-center gap-2.5 mb-1">
              <img
                src={user.avatar}
                alt={user.name}
                className="w-9 h-9 rounded-full object-cover"
                style={{
                  border: "1.5px solid rgba(255,162,122,0.3)",
                }}
              />
              <div>
                <div
                  className="text-xs font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  {user.name}
                </div>
                <div
                  className="text-[10px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {user.email}
                </div>
              </div>
            </div>

            <div
              className="mx-3 my-1 h-px"
              style={{ background: "var(--border-subtle)" }}
            />

            <button
              onClick={() => {
                onOpenProfile();
                setUserOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors rounded-lg mx-1.5 hover:bg-white/[0.03]"
              style={{
                color: "var(--text-secondary)",
                width: "calc(100% - 12px)",
              }}
            >
              <User size={13} style={{ color: "var(--text-muted)" }} />
              个人资料
            </button>
            <button
              onClick={() => {
                setUserOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors rounded-lg mx-1.5 hover:bg-white/[0.03]"
              style={{
                color: "var(--text-secondary)",
                width: "calc(100% - 12px)",
              }}
            >
              <Settings size={13} style={{ color: "var(--text-muted)" }} />
              系统设置
            </button>

            <div
              className="mx-3 my-1 h-px"
              style={{ background: "var(--border-subtle)" }}
            />

            <button
              onClick={() => {
                onLogout();
                setUserOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors rounded-lg mx-1.5 hover:bg-white/[0.03]"
              style={{ color: "var(--accent-red)", width: "calc(100% - 12px)" }}
            >
              <LogOut size={13} />
              退出登录
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
