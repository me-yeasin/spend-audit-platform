const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const rangeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const isoToDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** "27 Oct 2026" */
export function formatDate(iso: string) {
  return dateFormatter.format(isoToDate(iso));
}

/** "OCTOBER 2026" — used for month group headings. */
export function formatMonth(iso: string) {
  return monthFormatter.format(isoToDate(iso)).toUpperCase();
}

/** "1 Aug – 27 Oct 2026" */
export function formatRange(firstIso: string, lastIso: string) {
  const first = isoToDate(firstIso);
  const last = isoToDate(lastIso);
  const sameYear = first.getUTCFullYear() === last.getUTCFullYear();
  const start = rangeFormatter.format(first);
  const end = sameYear ? rangeFormatter.format(last) : dateFormatter.format(last);
  return `${start} – ${end} ${last.getUTCFullYear()}`;
}

/** "-$64.88" / "+$4,200.00" */
export function formatAmount(amount: number) {
  const abs = currencyFormatter.format(Math.abs(amount));
  return amount < 0 ? `-${abs}` : `+${abs}`;
}

/** "$1,850.00" — a cost, shown without a sign. */
export function formatCost(amount: number) {
  return currencyFormatter.format(Math.abs(amount));
}

/**
 * "$5.20" read aloud: "5 dollars 20".
 *
 * A screen reader meets "$5.20" as "dollar five point two zero" at best, which
 * is why the change rows and the delta line carry their own spoken sentence
 * (design/MONTHLY.md section 12).
 */
export function formatCostSpoken(amount: number) {
  const cents = Math.round(Math.abs(amount) * 100);
  const dollars = Math.floor(cents / 100);
  const remainder = cents % 100;
  const spoken = `${dollars} dollar${dollars === 1 ? "" : "s"}`;
  return remainder ? `${spoken} ${remainder}` : spoken;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}
