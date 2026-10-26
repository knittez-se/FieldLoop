"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ChevronsUpDown,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Map as MapIcon,
  Menu,
  Plus,
  RotateCcw,
  Settings,
  Sprout,
  TriangleAlert,
  X,
} from "lucide-react";
import { getLastFieldSync, getPersistError, syncFieldData, useAppState } from "@/lib/store";
import { activeInspections } from "@/lib/selectors";
import { cn } from "@/lib/format";
import { CoopBanner } from "./coop-banner";
import { OnboardingQuiz } from "./onboarding-quiz";

const NAV = [
  { href: "/", label: "Today", icon: LayoutDashboard },
  { href: "/map", label: "Map", icon: MapIcon },
  { href: "/inspections", label: "Visits", icon: ClipboardList },
  { href: "/reports", label: "Reports", icon: FileText },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/fields");
  return pathname === href || pathname.startsWith(href + "/");
}

function NavLink({ href, label, icon: Icon, active, count }: { href: string; label: string; icon: typeof MapIcon; active: boolean; count?: number }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-[15px] font-medium transition-colors",
        active ? "bg-white text-stone-900 shadow-sm ring-1 ring-hairline" : "text-stone-600 hover:text-stone-900",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <span className="flex-1">{label}</span>
      {count !== undefined && count > 0 && <span className="text-[13px] tabular-nums text-stone-400">{count}</span>}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const state = useAppState();
  const openCount = state ? activeInspections(state).length : undefined;
  const user = state?.advisers.find((a) => a.id === state.settings.currentUserId);
  const persistError = state ? getPersistError() : null;

  useEffect(() => setOpen(false), [pathname]);

  // Load data/ files once per page load (rebuilds the demo if the data changed).
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  useEffect(() => {
    syncFieldData().then((r) => {
      if (r.status !== "unchanged" && r.message) setSyncNotice(r.message);
    });
  }, []);
  void getLastFieldSync;

  const logo = (
    <Link href="/" className="inline-flex" aria-label="FarmSignal, go to Today">
      <img src="/brand/farmsignal-horizontal.svg" alt="FarmSignal" width={130} height={28} className="h-7 w-auto" />
    </Link>
  );

  const sidebarBody = (
    <>
      <div className="px-2">{logo}</div>
      {state && (
        <div className="flex items-center gap-2.5 rounded-xl border border-hairline bg-white p-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-forest text-lime">
            <Sprout className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold">{state.cooperative.name}</div>
            <div className="text-xs text-stone-500">Fictional cooperative</div>
          </div>
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 text-stone-400" aria-hidden="true" />
        </div>
      )}
      <nav className="flex flex-col gap-0.5" aria-label="Main">
        {NAV.map(({ href, label, icon }) => (
          <NavLink
            key={href}
            href={href}
            label={label}
            icon={icon}
            active={isActive(pathname, href)}
            count={href === "/inspections" ? openCount : href === "/map" ? state?.fields.length : undefined}
          />
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-0.5 border-t border-hairline pt-3">
        <NavLink href="/settings" label="Settings" icon={Settings} active={isActive(pathname, "/settings")} />
        <Link href="/settings#reset-demo" className="flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-[15px] font-medium text-stone-600 hover:text-stone-900">
          <RotateCcw className="h-[18px] w-[18px]" /> Reset demo
        </Link>
        {user && (
          <div className="px-3 pt-2 text-xs text-stone-500">
            Signed in as <span className="font-medium text-stone-800">{user.name}</span>
          </div>
        )}
      </div>
    </>
  );

  // First visit: the quiz personalizes the demo (skippable).
  if (state && !state.profile) return <OnboardingQuiz state={state} />;

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-5 overflow-y-auto border-r border-hairline bg-[#f7f9f7] px-4 py-6 lg:flex">
        {sidebarBody}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-[1100] flex items-center justify-between border-b border-hairline bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden">
        {logo}
        <div className="flex items-center gap-1">
          <Link href="/reports/new" className="grid h-11 w-11 place-items-center rounded-xl text-forest hover:bg-stone-100" aria-label="Report observation">
            <Plus className="h-5 w-5" />
          </Link>
          <button type="button" onClick={() => setOpen(true)} className="grid h-11 w-11 place-items-center rounded-xl border border-hairline bg-white" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-[1200] lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col gap-5 overflow-y-auto bg-[#f7f9f7] px-4 py-6">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-xl text-stone-500 hover:bg-stone-100"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarBody}
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1">
        {syncNotice && (
          <div className="flex items-center justify-between gap-2 border-b border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900" role="status">
            <span>{syncNotice}</span>
            <button type="button" onClick={() => setSyncNotice(null)} className="rounded p-1 hover:bg-sky-100" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {persistError && (
          <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
            <TriangleAlert className="h-4 w-4" /> {persistError}
          </div>
        )}
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          {/* On phones the banner only shows on Today, so field screens stay focused. */}
          {state && <CoopBanner state={state} isPageTitle={pathname === "/"} className={cn("mb-6", pathname === "/" ? "flex" : "hidden lg:flex")} />}
          {children}
        </div>
      </main>
    </div>
  );
}
