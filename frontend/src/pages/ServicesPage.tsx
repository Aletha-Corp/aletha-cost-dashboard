import { useState } from 'react';
import { useCostsByResourceGroup } from '../hooks/use-costs';
import { useDateRange } from '../hooks/use-date-range';
import { DateRangePicker } from '../components/DateRangePicker';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorAlert } from '../components/ui/ErrorAlert';
import { formatCurrency, chartColorAt, portalBrowseUrl } from '../utils/format';
import { User, Search, X } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { ServiceCost } from '../types/cost.types';

interface AggregatedService extends ServiceCost {
  index: number;
}

function envBadgeClass(env: string): string {
  const e = env.toLowerCase();
  if (e.includes('prod'))    return 'bg-red-900/40 text-red-300 border-red-700/50';
  if (e.includes('stag') || e.includes('uat')) return 'bg-yellow-900/40 text-yellow-300 border-yellow-700/50';
  if (e.includes('dev'))     return 'bg-green-900/40 text-green-300 border-green-700/50';
  if (e.includes('test'))    return 'bg-blue-900/40 text-blue-300 border-blue-700/50';
  return 'bg-slate-700/40 text-slate-300 border-slate-600/50';
}

export function ServicesPage() {
  const { range, applyPreset, applyCustom, presets } = useDateRange();
  const { data: rgData, isLoading, isError, error, refetch } = useCostsByResourceGroup(range);
  const [query, setQuery] = useState('');

  // Aggregate services across all resource groups
  const serviceMap = new Map<string, ServiceCost>();
  if (rgData) {
    for (const rg of rgData) {
      for (const svc of rg.services) {
        const key = `${svc.serviceName}::${svc.resourceType}`;
        const existing = serviceMap.get(key);
        if (existing) {
          existing.totalCost += svc.totalCost;
          existing.resourceCount += svc.resourceCount;
          // Expand the date range seen across RGs
          if (svc.firstSeen && (!existing.firstSeen || svc.firstSeen < existing.firstSeen)) existing.firstSeen = svc.firstSeen;
          if (svc.lastSeen  && (!existing.lastSeen  || svc.lastSeen  > existing.lastSeen))  existing.lastSeen  = svc.lastSeen;
        } else {
          serviceMap.set(key, { ...svc });
        }
      }
    }
  }

  const allServices: AggregatedService[] = Array.from(serviceMap.values())
    .sort((a, b) => b.totalCost - a.totalCost)
    .map((s, i) => ({ ...s, totalCost: Math.round(s.totalCost * 100) / 100, index: i }));

  const q = query.trim().toLowerCase();
  const services = q === ''
    ? allServices
    : allServices.filter(
        (svc) =>
          svc.serviceName.toLowerCase().includes(q) ||
          svc.resourceType.toLowerCase().includes(q) ||
          svc.owner?.toLowerCase().includes(q) ||
          svc.regions?.some((r) => r.toLowerCase().includes(q)),
      );

  const currency = allServices[0]?.currency ?? 'USD';
  const totalCost = services.reduce((s, svc) => s + svc.totalCost, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Services</h1>
        <p className="text-slate-500 text-sm mt-1">All Azure services ranked by cost.</p>
      </div>

      <DateRangePicker
        range={range}
        onApply={applyCustom}
        presets={presets}
        onPreset={applyPreset}
        isLoading={isLoading}
      />

      {isLoading && <LoadingSpinner message="Loading service costs..." />}
      {isError && <ErrorAlert message={String(error)} onRetry={() => refetch()} />}

      {allServices.length > 0 && (
        <>
          {/* Search */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by service, resource type, owner, or region…"
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
          {/* Bar chart */}
          <div className="card">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">
              Top {Math.min(services.length, 15)} Services{q && ` matching "${query}"`}
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={services.slice(0, 15)}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `$${v}`}
                />
                <YAxis
                  type="category"
                  dataKey="serviceName"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={160}
                  tickFormatter={(v: string) => (v.length > 22 ? v.slice(0, 22) + '…' : v)}
                />
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    color: '#e2e8f0',
                  }}
                  formatter={(value: number) => [formatCurrency(value, currency), 'Cost']}
                />
                <Bar dataKey="totalCost" radius={[0, 4, 4, 0]}>
                  {services.slice(0, 15).map((_, index) => (
                    <Cell key={index} fill={chartColorAt(index)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-300">All Services</h2>
              <span className="text-xs text-slate-500">
                {services.length} service{services.length !== 1 ? 's' : ''}{q && ` matching "${query}"`} · Total:{' '}
                {formatCurrency(totalCost, currency)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                    <th className="text-left px-5 py-3 font-medium">#</th>
                    <th className="text-left px-5 py-3 font-medium">Service</th>
                    <th className="text-left px-5 py-3 font-medium">Resource Type</th>
                    <th className="text-left px-5 py-3 font-medium">Owner</th>
                    <th className="text-left px-5 py-3 font-medium">Build Info</th>
                    <th className="text-left px-5 py-3 font-medium">First Seen</th>
                    <th className="text-left px-5 py-3 font-medium">Last Seen</th>
                    <th className="text-left px-5 py-3 font-medium">Region</th>
                    <th className="text-right px-5 py-3 font-medium">Resources</th>
                    <th className="text-right px-5 py-3 font-medium">Cost</th>
                    <th className="text-right px-5 py-3 font-medium">% of Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {services.map((svc) => {
                    const pct = totalCost > 0 ? (svc.totalCost / totalCost) * 100 : 0;
                    return (
                      <tr key={svc.index} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-3 text-slate-600">{svc.index + 1}</td>
                        <td className="px-5 py-3 text-slate-300 max-w-[200px]">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: chartColorAt(svc.index) }}
                            />
                            {svc.resourceType ? (
                              <a
                                href={portalBrowseUrl(svc.resourceType)}
                                target="_blank"
                                rel="noreferrer"
                                className="truncate hover:text-azure-300 transition-colors"
                              >
                                {svc.serviceName || svc.resourceType}
                              </a>
                            ) : (
                              <span className="truncate">{svc.serviceName || '—'}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-slate-400 text-xs max-w-[200px] truncate">
                          {svc.resourceType || '—'}
                        </td>
                        <td className="px-5 py-3 text-slate-400 text-xs max-w-[160px]">
                          {svc.owner ? (
                            <span className="flex items-center gap-1 truncate">
                              <User size={11} className="text-slate-500 shrink-0" />
                              <span className="truncate">{svc.owner}</span>
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-5 py-3 text-xs max-w-[160px]">
                          {(svc.environment || svc.buildInfo) ? (
                            <div className="flex flex-col gap-0.5">
                              {svc.environment && (
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border w-fit ${envBadgeClass(svc.environment)}`}>
                                  {svc.environment}
                                </span>
                              )}
                              {svc.buildInfo && (
                                <span className="font-mono text-slate-500 truncate text-[11px]">{svc.buildInfo}</span>
                              )}
                            </div>
                          ) : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-400 whitespace-nowrap">
                          {svc.firstSeen ? new Date(svc.firstSeen).toLocaleDateString('en-CA') : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-400 whitespace-nowrap">
                          {svc.lastSeen ? new Date(svc.lastSeen).toLocaleDateString('en-CA') : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-5 py-3 text-xs max-w-[140px]">
                          {svc.regions && svc.regions.length > 0 ? (
                            <div className="flex flex-col gap-0.5">
                              {svc.regions.map((r) => (
                                <span key={r} className="text-slate-400 truncate">{r}</span>
                              ))}
                            </div>
                          ) : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-5 py-3 text-right text-slate-400">{svc.resourceCount}</td>
                        <td className="px-5 py-3 text-right font-semibold text-slate-200">
                          {formatCurrency(svc.totalCost, svc.currency)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: chartColorAt(svc.index),
                                }}
                              />
                            </div>
                            <span className="text-xs text-slate-400 w-10 text-right">
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {services.length === 0 && q && (
                <p className="text-slate-500 text-sm text-center py-10">No results for "{query}".</p>
              )}
            </div>
          </div>
        </>
      )}

      {!isLoading && !isError && allServices.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-12">No service data for this period.</p>
      )}
    </div>
  );
}
