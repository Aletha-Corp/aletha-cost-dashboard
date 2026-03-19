import { useState } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Users,
  Network,
  HardDrive,
  Key,
  Activity,
  Tag,
  Clock,
  Zap,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useSecurityReport } from '../hooks/use-security';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorAlert } from '../components/ui/ErrorAlert';
import { fetchSecurityReport } from '../api/security.api';
import type { SecurityFinding, SecurityCategory, SecuritySeverity } from '../types/security.types';
import type { LucideProps } from 'lucide-react';

// ─── Severity helpers ─────────────────────────────────────────────────────────

type LucideIcon = React.ForwardRefExoticComponent<Omit<LucideProps, 'ref'> & React.RefAttributes<SVGSVGElement>>;

const SEVERITY_CONFIG: Record<
  SecuritySeverity,
  { label: string; icon: LucideIcon; dotColor: string; badgeClass: string; rowClass: string }
> = {
  critical: {
    label: 'Critical',
    icon: ShieldAlert,
    dotColor: 'bg-red-500',
    badgeClass: 'bg-red-500/15 text-red-400 border border-red-500/30',
    rowClass: 'border-l-4 border-l-red-500',
  },
  high: {
    label: 'High',
    icon: AlertTriangle,
    dotColor: 'bg-orange-500',
    badgeClass: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
    rowClass: 'border-l-4 border-l-orange-500',
  },
  medium: {
    label: 'Medium',
    icon: AlertCircle,
    dotColor: 'bg-yellow-500',
    badgeClass: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
    rowClass: 'border-l-4 border-l-yellow-500',
  },
  low: {
    label: 'Low',
    icon: Info,
    dotColor: 'bg-blue-500',
    badgeClass: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    rowClass: 'border-l-4 border-l-blue-500',
  },
  info: {
    label: 'Info',
    icon: Info,
    dotColor: 'bg-slate-400',
    badgeClass: 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
    rowClass: 'border-l-4 border-l-slate-500',
  },
};

// ─── Category helpers ─────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<SecurityCategory, { label: string; icon: LucideIcon }> = {
  'identity-access':   { label: 'Identity & Access', icon: Users },
  'network-security':  { label: 'Network Security', icon: Network },
  'storage-security':  { label: 'Storage Security', icon: HardDrive },
  'key-management':    { label: 'Key Management', icon: Key },
  'monitoring-logging':{ label: 'Monitoring & Logging', icon: Activity },
  'governance':        { label: 'Governance', icon: Tag },
};

// ─── Score gauge ──────────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const color =
    score >= 80 ? 'text-emerald-400' :
    score >= 60 ? 'text-yellow-400' :
    score >= 40 ? 'text-orange-400' : 'text-red-400';

  const ringColor =
    score >= 80 ? 'stroke-emerald-500' :
    score >= 60 ? 'stroke-yellow-500' :
    score >= 40 ? 'stroke-orange-500' : 'stroke-red-500';

  const label =
    score >= 80 ? 'Good' :
    score >= 60 ? 'Fair' :
    score >= 40 ? 'Poor' : 'Critical';

  const r = 36;
  const circumference = 2 * Math.PI * r;
  const dash = (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="8" className="stroke-slate-700" />
          <circle
            cx="50" cy="50" r={r} fill="none" strokeWidth="8"
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
            className={`${ringColor} transition-all duration-700`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold ${color}`}>{score}</span>
          <span className="text-xs text-slate-500">/ 100</span>
        </div>
      </div>
      <span className={`text-sm font-semibold ${color}`}>{label}</span>
    </div>
  );
}

// ─── Severity counter pill ─────────────────────────────────────────────────────

function SeverityPill({ severity, count }: { severity: SecuritySeverity; count: number }) {
  const cfg = SEVERITY_CONFIG[severity];
  const Icon = cfg.icon;
  return (
    <div className="flex flex-col items-center gap-1 p-3 bg-slate-800 rounded-xl border border-slate-700/60 min-w-[72px]">
      <Icon size={18} className={count > 0 ? cfg.badgeClass.split(' ')[1] : 'text-slate-600'} />
      <span className={`text-xl font-bold ${count > 0 ? cfg.badgeClass.split(' ')[1] : 'text-slate-600'}`}>{count}</span>
      <span className="text-xs text-slate-500">{cfg.label}</span>
    </div>
  );
}

// ─── Category breakdown bar ───────────────────────────────────────────────────

function CategoryBar({ category, count, total }: { category: SecurityCategory; count: number; total: number }) {
  const cfg = CATEGORY_CONFIG[category];
  const Icon = cfg.icon;
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <Icon size={14} className="text-slate-400 shrink-0" />
      <span className="text-sm text-slate-300 w-40 shrink-0">{cfg.label}</span>
      <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full bg-azure-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400 w-6 text-right shrink-0">{count}</span>
    </div>
  );
}

// ─── Finding card ──────────────────────────────────────────────────────────────

function FindingCard({ finding }: { finding: SecurityFinding }) {
  const [expanded, setExpanded] = useState(false);
  const sev = SEVERITY_CONFIG[finding.severity];
  const cat = CATEGORY_CONFIG[finding.category];
  const SevIcon = sev.icon;
  const CatIcon = cat.icon;

  return (
    <div className={`bg-slate-800 rounded-xl border border-slate-700/60 overflow-hidden ${sev.rowClass}`}>
      <button
        className="w-full text-left px-4 py-4 flex items-start gap-3 hover:bg-slate-700/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <SevIcon size={18} className={`${sev.badgeClass.split(' ')[1]} mt-0.5 shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sev.badgeClass}`}>
              {sev.label}
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <CatIcon size={11} />
              {cat.label}
            </span>
            <span className="ml-auto text-xs text-slate-500 shrink-0">
              {finding.affectedCount} resource{finding.affectedCount !== 1 ? 's' : ''} affected
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-100">{finding.title}</p>
        </div>
        <div className="ml-2 text-slate-500 shrink-0 mt-0.5">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-700/60 pt-3 space-y-4">
          {/* Description */}
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide">Finding</p>
            <p className="text-sm text-slate-300 leading-relaxed">{finding.description}</p>
          </div>

          {/* Remediation */}
          <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-3">
            <p className="text-xs font-semibold text-emerald-400 mb-1 uppercase tracking-wide">Action Required</p>
            <p className="text-sm text-slate-200 leading-relaxed">{finding.remediation}</p>
          </div>

          {/* Affected resources */}
          {finding.affectedResources.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
                Affected Resources ({finding.affectedResources.length}{finding.affectedCount > finding.affectedResources.length ? ` of ${finding.affectedCount}` : ''})
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {finding.affectedResources.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-400 bg-slate-700/40 rounded px-2 py-1">
                    <span className="font-mono text-slate-300 truncate max-w-[200px]">{r.name}</span>
                    {r.resourceGroup && (
                      <span className="text-slate-500 truncate">in {r.resourceGroup}</span>
                    )}
                    {r.type && (
                      <span className="ml-auto text-slate-600 shrink-0 truncate max-w-[160px]">{r.type}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Learn more */}
          {finding.learnMoreUrl && (
            <a
              href={finding.learnMoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-azure-400 hover:text-azure-300 transition-colors"
            >
              <ExternalLink size={12} />
              Learn more on Microsoft Docs
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function SecurityPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, isFetching } = useSecurityReport();
  const [activeSeverityFilter, setActiveSeverityFilter] = useState<SecuritySeverity | 'all'>('all');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<SecurityCategory | 'all'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function handleForceRescan() {
    setIsRefreshing(true);
    try {
      const fresh = await fetchSecurityReport({ force: true });
      queryClient.setQueryData(['security-report', undefined], fresh);
    } finally {
      setIsRefreshing(false);
    }
  }

  const filteredFindings = (data?.findings ?? []).filter((f) => {
    if (activeSeverityFilter !== 'all' && f.severity !== activeSeverityFilter) return false;
    if (activeCategoryFilter !== 'all' && f.category !== activeCategoryFilter) return false;
    return true;
  });

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Shield size={22} className="text-azure-400" />
            Security Assessment
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Subscription-wide security vulnerability scan with prioritised action items.
          </p>
        </div>
        <button
          onClick={handleForceRescan}
          disabled={isRefreshing || isFetching}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-azure-600 hover:bg-azure-700 disabled:opacity-50 text-white rounded-lg transition-colors shrink-0"
        >
          <RefreshCw size={14} className={isRefreshing || isFetching ? 'animate-spin' : ''} />
          {isRefreshing || isFetching ? 'Scanning…' : 'Re-scan Now'}
        </button>
      </div>

      {isLoading && <LoadingSpinner message="Running security scan across subscription… This may take a minute." />}
      {isError && <ErrorAlert message={String(error)} onRetry={handleForceRescan} />}

      {data && summary && (
        <>
          {/* Scan metadata */}
          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock size={12} />
              Scanned {new Date(data.scannedAt).toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <Zap size={12} />
              {(data.durationMs / 1000).toFixed(1)}s scan duration
            </span>
            {data.skippedCategories.length > 0 && (
              <span className="flex items-center gap-1 text-yellow-500">
                <AlertTriangle size={12} />
                {data.skippedCategories.length} category(ies) skipped (insufficient permissions)
              </span>
            )}
          </div>

          {/* Summary row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Score card */}
            <div className="bg-slate-800 rounded-xl border border-slate-700/60 p-5 flex flex-col items-center justify-center gap-2">
              <ScoreGauge score={summary.securityScore} />
              <p className="text-xs text-slate-500 text-center">Security Score</p>
            </div>

            {/* Severity breakdown */}
            <div className="bg-slate-800 rounded-xl border border-slate-700/60 p-5">
              <p className="text-sm font-semibold text-slate-300 mb-3">Findings by Severity</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {(['critical', 'high', 'medium', 'low', 'info'] as SecuritySeverity[]).map((s) => (
                  <SeverityPill key={s} severity={s} count={(summary as unknown as Record<string, number>)[s] ?? 0} />
                ))}
              </div>
            </div>

            {/* Category breakdown */}
            <div className="bg-slate-800 rounded-xl border border-slate-700/60 p-5">
              <p className="text-sm font-semibold text-slate-300 mb-3">Findings by Category</p>
              <div className="space-y-2">
                {(Object.entries(summary.findingsByCategory) as [SecurityCategory, number][])
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, count]) => (
                    <CategoryBar key={cat} category={cat} count={count} total={summary.totalFindings} />
                  ))}
                {Object.keys(summary.findingsByCategory).length === 0 && (
                  <div className="flex items-center gap-2 text-emerald-400 text-sm mt-2">
                    <ShieldCheck size={16} />
                    No findings detected
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* No findings state */}
          {summary.totalFindings === 0 && (
            <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-xl p-8 flex flex-col items-center gap-3 text-center">
              <ShieldCheck size={40} className="text-emerald-400" />
              <p className="text-lg font-semibold text-emerald-300">No Security Findings</p>
              <p className="text-sm text-slate-400 max-w-md">
                Your subscription passed all automated security checks. Re-scan regularly to stay ahead of new risks.
              </p>
            </div>
          )}

          {/* Filters + Findings */}
          {summary.totalFindings > 0 && (
            <>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-slate-500 mr-1">Filter by severity:</span>
                {(['all', 'critical', 'high', 'medium', 'low', 'info'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setActiveSeverityFilter(s)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      activeSeverityFilter === s
                        ? 'bg-azure-600/30 text-azure-300 border-azure-600/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    {s === 'all' ? 'All' : SEVERITY_CONFIG[s].label}
                    {s !== 'all' && (summary as unknown as Record<string, number>)[s] > 0 && (
                      <span className="ml-1 text-slate-500">({(summary as unknown as Record<string, number>)[s]})</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-slate-500 mr-1">Filter by category:</span>
                <button
                  onClick={() => setActiveCategoryFilter('all')}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    activeCategoryFilter === 'all'
                      ? 'bg-azure-600/30 text-azure-300 border-azure-600/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  All Categories
                </button>
                {(Object.keys(CATEGORY_CONFIG) as SecurityCategory[]).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategoryFilter(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      activeCategoryFilter === cat
                        ? 'bg-azure-600/30 text-azure-300 border-azure-600/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    {CATEGORY_CONFIG[cat].label}
                  </button>
                ))}
              </div>

              <div>
                <p className="text-sm text-slate-400 mb-3">
                  Showing {filteredFindings.length} of {summary.totalFindings} finding{summary.totalFindings !== 1 ? 's' : ''}
                </p>
                <div className="space-y-3">
                  {filteredFindings.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">No findings match the selected filters.</p>
                  ) : (
                    filteredFindings.map((f) => <FindingCard key={f.id} finding={f} />)
                  )}
                </div>
              </div>
            </>
          )}

          {/* Skipped categories */}
          {data.skippedCategories.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                <AlertTriangle size={12} className="text-yellow-500" />
                Checks Skipped
              </p>
              <div className="space-y-1">
                {data.skippedCategories.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-400 shrink-0">{CATEGORY_CONFIG[s.category]?.label ?? s.category}:</span>
                    <span className="truncate">{s.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
