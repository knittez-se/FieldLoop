"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ClipboardList,
  FileText,
  LayoutDashboard,
  Map as MapIcon,
  Menu,
  Plus,
  Settings,
  Sprout,
  TriangleAlert,
  X,
} from "lucide-react";
import { getLastFieldSync, getPersistError, syncFieldData, useAppState } from "@/lib/store";
import { activeInspections } from "@/lib/selectors";
import { cn } from "@/lib/format";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/map", label: "Field Map", icon: MapIcon },
  { href: "/inspections", label: "Inspections", icon: ClipboardList },
  { href: "/reports", label: "Field Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/fields");
  return pathname === href || pathname.startsWith(href + "/");
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

  const nav = (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-brand-600 text-white" : "text-brand-100 hover:bg-brand-800 hover:text-white",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-4 w-4" />
            <span className="flex-1">{label}</span>
            {href === "/inspections" && openCount !== undefined && openCount > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                  active ? "bg-white/20" : "bg-brand-700 text-brand-100",
                )}
              >
                {openCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const sidebarBody = (
    <>
      <Link href="/" className="flex items-center gap-2 px-3 pb-6 pt-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500">
          <Sprout className="h-4.5 w-4.5 text-white" />
        </div>
        <div>
          <div className="text-[15px] font-semibold tracking-tight text-white">FarmSignal</div>
          <div className="text-[11px] text-brand-300">Field operations</div>
        </div>
      </Link>
      <Link
        href="/reports/new"
        className="mx-1 mb-4 flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-brand-800 shadow-sm hover:bg-brand-50"
      >
        <Plus className="h-4 w-4" /> Report observation
      </Link>
      {nav}
      <div className="mt-auto space-y-3 px-3 pt-6 text-xs">
        {state && (
          <div className="rounded-lg bg-brand-800/70 p-3">
            <div className="font-medium text-white">{state.cooperative.name}</div>
            <div className="text-brand-300">{state.cooperative.region}</div>
            <div className="mt-2 inline-block rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
              Fictional demo data
            </div>
          </div>
        )}
        {user && (
          <div className="text-brand-200">
            Signed in as <span className="font-medium text-white">{user.name}</span>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-brand-900 p-3 lg:flex">{sidebarBody}</aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-[1100] flex items-center justify-between border-b border-stone-200 bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600">
            <Sprout className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold tracking-tight">FarmSignal</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/reports/new" className="rounded-lg p-2 text-brand-700 hover:bg-brand-50" aria-label="Report observation">
            <Plus className="h-5 w-5" />
          </Link>
          <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-stone-100" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-[1200] lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-brand-900 p-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-2 top-2 rounded-lg p-2 text-brand-200 hover:bg-brand-800"
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
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
