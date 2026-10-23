import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentType, ReactNode } from "react";
import { cn } from "@/lib/format";
import type { InspectionStatus, Priority } from "@/lib/types";
import { INSPECTION_STATUS_LABEL } from "@/lib/labels";

type IconType = ComponentType<{ className?: string }>;

export function Card({ className, children, id }: { className?: string; children: ReactNode; id?: string }) {
  return (
    <div id={id} className={cn("rounded-xl border border-stone-200 bg-white shadow-sm", className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  icon: Icon,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: IconType;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-start gap-2.5">
        {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-stone-900">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-stone-500">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0 whitespace-nowrap">{action}</div>}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm disabled:bg-brand-300",
  secondary: "bg-white text-stone-800 border border-stone-300 hover:bg-stone-50 shadow-sm disabled:text-stone-400",
  ghost: "text-stone-700 hover:bg-stone-100 disabled:text-stone-400",
  danger: "bg-white text-red-700 border border-red-200 hover:bg-red-50 disabled:text-red-300",
};

export function Button({
  variant = "primary",
  size = "md",
  href,
  icon: Icon,
  className,
  children,
  ...props
}: {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  href?: string;
  icon?: IconType;
  className?: string;
  children?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const classes = cn(
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed",
    size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm",
    BUTTON_STYLES[variant],
    className,
  );
  const content = (
    <>
      {Icon && <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />}
      {children}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} {...props}>
      {content}
    </button>
  );
}

export type Tone = "green" | "amber" | "red" | "stone" | "blue" | "violet" | "sky";
const TONES: Record<Tone, string> = {
  green: "bg-brand-50 text-brand-700 ring-brand-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  stone: "bg-stone-100 text-stone-700 ring-stone-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  sky: "bg-sky-50 text-sky-700 ring-sky-200",
};

export function Badge({ tone = "stone", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const PRIORITY_COLOR: Record<Priority | "ok", string> = {
  high: "#dc2626",
  medium: "#d97706",
  low: "#0284c7",
  ok: "#3f7f52",
};

export function PriorityBadge({ level, score }: { level: Priority | "ok"; score?: number }) {
  const tone: Tone = level === "high" ? "red" : level === "medium" ? "amber" : level === "low" ? "sky" : "green";
  const label = level === "ok" ? "No action" : `${level[0].toUpperCase()}${level.slice(1)} priority`;
  return (
    <Badge tone={tone}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: PRIORITY_COLOR[level] }} />
      {label}
      {score !== undefined && <span className="opacity-70">· {score}</span>}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: InspectionStatus }) {
  const tone: Tone = status === "open" ? "stone" : status === "in_progress" ? "blue" : "green";
  return <Badge tone={tone}>{INSPECTION_STATUS_LABEL[status]}</Badge>;
}

/** Labels that make the origin of every statement explicit. */
export type ProvenanceKind =
  | "observed"
  | "confirmed"
  | "interpretation"
  | "hypothesis"
  | "action"
  | "question"
  | "simulated"
  | "sample";

const PROVENANCE: Record<ProvenanceKind, { label: string; tone: Tone }> = {
  observed: { label: "Observed", tone: "stone" },
  confirmed: { label: "Confirmed on site", tone: "green" },
  interpretation: { label: "Interpretation", tone: "violet" },
  hypothesis: { label: "Hypothesis – verify", tone: "amber" },
  action: { label: "Recommended action", tone: "blue" },
  question: { label: "Question", tone: "sky" },
  simulated: { label: "Simulated data", tone: "amber" },
  sample: { label: "Sample data", tone: "stone" },
};

export function ProvenanceTag({ kind, className }: { kind: ProvenanceKind; className?: string }) {
  const p = PROVENANCE[kind];
  return (
    <Badge tone={p.tone} className={cn("uppercase tracking-wide text-[10px]", className)}>
      {p.label}
    </Badge>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-medium text-stone-500">{eyebrow}</div>}
        <h1 className="text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-stone-600">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "green",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: IconType;
  tone?: "green" | "amber" | "red" | "blue";
  href?: string;
}) {
  const iconBg = {
    green: "bg-brand-50 text-brand-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    blue: "bg-blue-50 text-blue-600",
  }[tone];
  const inner = (
    <Card className={cn("h-full p-4 transition-colors", href && "hover:border-brand-300")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-medium text-stone-500">{label}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">{value}</div>
        </div>
        <div className={cn("rounded-lg p-2", iconBg)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {hint && <div className="mt-2 text-xs text-stone-500">{hint}</div>}
    </Card>
  );
  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: IconType;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-3 rounded-full bg-stone-100 p-3">
        <Icon className="h-5 w-5 text-stone-500" />
      </div>
      <div className="text-sm font-medium text-stone-800">{title}</div>
      {description && <p className="mt-1 max-w-sm text-xs text-stone-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-stone-200/70", className)} />;
}

export function PageLoading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-2 h-7 w-56" />
      <Skeleton className="mb-6 h-4 w-80" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="mt-6 h-72" />
    </div>
  );
}

export function NotFoundCard({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <Card>
      <EmptyState
        icon={({ className }) => <span className={cn("block text-center font-bold", className)}>?</span>}
        title={title}
        description="It may have been removed or the demo data was reset."
        action={
          <Button variant="secondary" href={href}>
            {linkLabel}
          </Button>
        }
      />
    </Card>
  );
}

export function DemoNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
      <span className="mt-px font-semibold">Demo</span>
      <span>{children}</span>
    </div>
  );
}
