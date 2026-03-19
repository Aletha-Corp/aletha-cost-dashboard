/**
 * Format a cost number as a currency string.
 */
export function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a YYYY-MM-DD string to a human-readable date.
 */
export function formatDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(
      new Date(year, month - 1, day)
    );
  } catch {
    return dateStr;
  }
}

/**
 * Generate a deterministic Tailwind color class from a string (for resource group badges etc.)
 */
const COLOR_PALETTE = [
  'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'bg-rose-500/20 text-rose-300 border-rose-500/30',
  'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  'bg-teal-500/20 text-teal-300 border-teal-500/30',
];

export function colorForString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
}

const CHART_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#6366f1', '#14b8a6', '#f97316', '#ec4899',
];

export function chartColorAt(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

/** Azure portal deep-link for a resource group overview */
export function portalRgUrl(subscriptionId: string, resourceGroup: string): string {
  return `https://portal.azure.com/#resource/subscriptions/${encodeURIComponent(subscriptionId)}/resourceGroups/${encodeURIComponent(resourceGroup)}/overview`;
}

/** Azure portal browse blade for a resource type, e.g. "microsoft.web/sites" */
export function portalBrowseUrl(resourceType: string): string {
  return `https://portal.azure.com/#browse/${resourceType.toLowerCase()}`;
}
