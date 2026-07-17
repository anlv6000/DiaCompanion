import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutList,
  Users,
  LineChart,
  LayoutDashboard,
  Settings,
  GitCompareArrows,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { Role } from "@/types/models";
import { cx } from "@/components/ui/primitives";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Triage", icon: LayoutList, roles: ["Admin", "Doctor"], end: true },
  { to: "/patients", label: "Bệnh nhân", icon: Users, roles: ["Admin", "Doctor", "Nurse"] },
  { to: "/progression", label: "Diễn tiến", icon: LineChart, roles: ["Admin", "Doctor"] },
  { to: "/conflicts", label: "Ca mâu thuẫn", icon: GitCompareArrows, roles: ["Admin"] },
  { to: "/dashboard", label: "Thống kê", icon: LayoutDashboard, roles: ["Admin", "Doctor"] },
  { to: "/admin", label: "Cấu hình", icon: Settings, roles: ["Admin"] },
];

export function AppShell() {
  const { user, logout, hasRole } = useAuth();

  return (
    <div className="h-full flex">
      {/* left nav */}
      <aside className="w-52 shrink-0 bg-surface border-r border-hairline flex flex-col">
        <div className="h-14 flex items-center px-4 border-b border-hairline">
          <span className="font-serif text-sub text-ink">DiaCompanion</span>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV.filter((n) => hasRole(...n.roles)).map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cx(
                  "flex items-center gap-2.5 h-9 px-2.5 rounded-sm text-dense",
                  isActive
                    ? "bg-primary/8 text-primary font-medium"
                    : "text-ink-muted hover:bg-canvas hover:text-ink",
                )
              }
            >
              <Icon size={16} strokeWidth={2} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-hairline bg-surface">
          <div className="text-meta text-ink-faint">Console lâm sàng — sàng lọc võng mạc ĐTĐ</div>
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-dense text-ink">{user?.fullName}</div>
              <div className="text-micro text-ink-faint uppercase tracking-wide">{user?.role}</div>
            </div>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-sm text-dense text-ink-muted border border-hairline hover:bg-canvas"
            >
              <LogOut size={14} />
              Đăng xuất
            </button>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-auto p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
