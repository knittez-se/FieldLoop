const DAY = 24 * 60 * 60 * 1000;

export function formatDate(iso: string | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function relativeTime(iso: string | undefined, now = new Date()) {
  if (!iso) return "never";
  const diff = now.getTime() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < DAY) return `${Math.floor(diff / 3_600_000)} h ago`;
  const days = Math.floor(diff / DAY);
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
