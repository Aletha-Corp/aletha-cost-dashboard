import { useState } from 'react';
import { ChevronDown, ChevronRight, Layers, User, Search, X, Clock } from 'lucide-react';
import { useCostsByResourceGroup } from '../hooks/use-costs';
import { useDateRange } from '../hooks/use-date-range';
import { DateRangePicker } from '../components/DateRangePicker';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorAlert } from '../components/ui/ErrorAlert';
import { formatCurrency, colorForString, portalRgUrl, portalBrowseUrl } from '../utils/format';
import type { ResourceGroupCost } from '../types/cost.types';

function ResourceGroupRow({ rg }: { rg: ResourceGroupCost }) {
  const [expanded, setExpanded] = useState(false);
  const badgeClass = colorForString(rg.resourceGroup);

  return (
    <div className="card p-0 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/50 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3 min-w-0">
          {expanded ? (
            <ChevronDown size={16} className="text-slate-500 shrink-0" />
          ) : (
            <ChevronRight size={16} className="text-slate-500 shrink-0" />
          )}
          <Layers size={16} className="text-slate-400 shrink-0" />
          <a
            href={rg.subscriptionId ? portalRgUrl(rg.subscriptionId, rg.resourceGroup) : '#'}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={`badge border ${badgeClass} hover:brightness-125 transition-[filter]`}
          >
            {rg.resourceGroup}
          </a>
          <span className="text-xs text-slate-500 shrink-0">{rg.services.length} service(s)</span>
          {rg.owner && (
            <span className="flex items-center gap-1 text-xs text-slate-400 min-w-0">
              <User size={11} className="shrink-0 text-slate-500" />
              <span className="truncate">{rg.owner}</span>
            </span>
          )}
          {rg.isActive === false ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-900/50 text-red-300 border border-red-700/50 shrink-0">
              Deleted
            </span>
          ) : (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-900/40 text-emerald-400 border border-emerald-700/40 shrink-0">
              Active
            </span>
          )}
          {rg.createdAt && (
            <span className="flex items-center gap-1 text-xs text-slate-500 shrink-0">
              <Clock size={10} className="shrink-0" />
              {new Date(rg.createdAt).toLocaleDateString('en-CA')}
            </span>
          )}
        </div>
        <span className="text-slate-100 font-semibold shrink-0 ml-4">
          {formatCurrency(rg.totalCost, rg.currency)}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-slate-800 px-5 py-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-wider">
                <th className="text-left pb-2 font-medium">Service</th>
                <th className="text-left pb-2 font-medium">Resource Type</th>
                <th className="text-left pb-2 font-medium">Owner</th>
                <th className="text-left pb-2 font-medium">First Seen</th>
                <th className="text-left pb-2 font-medium">Last Seen</th>
                <th className="text-right pb-2 font-medium">Resources</th>
                <th className="text-right pb-2 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rg.services.map((svc, i) => (
                <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2 pr-4 text-slate-300 max-w-[180px] truncate">
                    {svc.resourceType ? (
                      <a
                        href={portalBrowseUrl(svc.resourceType)}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-azure-300 transition-colors"
                      >
                        {svc.serviceName || svc.resourceType}
                      </a>
                    ) : (svc.serviceName || '—')}
                  </td>
                  <td className="py-2 pr-4 text-slate-400 text-xs max-w-[180px] truncate">
                    {svc.resourceType || '—'}
                  </td>
                  <td className="py-2 pr-4 text-slate-400 text-xs max-w-[140px] truncate">
                    {svc.owner ? (
                      <span className="flex items-center gap-1">
                        <User size={10} className="text-slate-500 shrink-0" />
                        {svc.owner}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-2 pr-4 text-slate-400 text-xs whitespace-nowrap">
                    {svc.firstSeen ? new Date(svc.firstSeen).toLocaleDateString('en-CA') : '—'}
                  </td>
                  <td className="py-2 pr-4 text-slate-400 text-xs whitespace-nowrap">
                    {svc.lastSeen ? new Date(svc.lastSeen).toLocaleDateString('en-CA') : '—'}
                  </td>
                  <td className="py-2 pr-4 text-right text-slate-400">{svc.resourceCount}</td>
                  <td className="py-2 text-right font-medium text-slate-200">
                    {formatCurrency(svc.totalCost, svc.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ResourceGroupsPage() {
  const { range, applyPreset, applyCustom, presets } = useDateRange();
  const { data, isLoading, isError, error, refetch } = useCostsByResourceGroup(range);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const filtered = data
    ? q === ''
      ? data
      : data.filter((rg) => {
          if (rg.resourceGroup.toLowerCase().includes(q)) return true;
          if (rg.owner?.toLowerCase().includes(q)) return true;
          return rg.services.some(
            (svc) =>
              svc.serviceName.toLowerCase().includes(q) ||
              svc.resourceType.toLowerCase().includes(q) ||
              svc.owner?.toLowerCase().includes(q) ||
              svc.regions?.some((r) => r.toLowerCase().includes(q)),
          );
        })
    : [];

  const total = filtered.reduce((s, rg) => s + rg.totalCost, 0);
  const currency = data?.[0]?.currency ?? 'USD';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Resource Groups</h1>
        <p className="text-slate-500 text-sm mt-1">
          Costs broken down by resource group. Groups without an assignment appear as{' '}
          <span className="text-slate-300 font-medium">None</span>.
        </p>
      </div>

      <DateRangePicker
        range={range}
        onApply={applyCustom}
        presets={presets}
        onPreset={applyPreset}
        isLoading={isLoading}
      />

      {isLoading && <LoadingSpinner message="Loading resource group costs..." />}
      {isError && <ErrorAlert message={String(error)} onRetry={() => refetch()} />}

      {data && data.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-12">No cost data for this period.</p>
      )}

      {data && data.length > 0 && (
        <>
          {/* Search */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by resource group, service, owner, or region…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-slate-800/60 border border-slate-700 rounded-lg pl-9 pr-9 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {filtered.length} resource group{filtered.length !== 1 ? 's' : ''}
              {q && ` matching "${query}"`}
            </p>
            <p className="text-sm font-semibold text-slate-200">
              Total: {formatCurrency(total, currency)}
            </p>
          </div>

          {filtered.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-12">No results for "{query}".</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((rg) => (
                <ResourceGroupRow key={rg.resourceGroup} rg={rg} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
