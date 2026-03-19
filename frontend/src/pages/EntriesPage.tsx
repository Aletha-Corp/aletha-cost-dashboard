import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { useCostEntries } from '../hooks/use-costs';
import { useDateRange } from '../hooks/use-date-range';
import { DateRangePicker } from '../components/DateRangePicker';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorAlert } from '../components/ui/ErrorAlert';
import { formatCurrency, formatDate, colorForString, portalRgUrl, portalBrowseUrl } from '../utils/format';
import type { CostEntry } from '../types/cost.types';

const PAGE_SIZE = 50;

export function EntriesPage() {
  const { range, applyPreset, applyCustom, presets } = useDateRange();
  const { data, isLoading, isError, error, refetch } = useCostEntries(range);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered: CostEntry[] = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase();
    if (!q) return data;
    return data.filter(
      (e) =>
        (e.resourceGroup ?? 'none').toLowerCase().includes(q) ||
        e.serviceName.toLowerCase().includes(q) ||
        e.resourceType.toLowerCase().includes(q) ||
        e.subscriptionName.toLowerCase().includes(q) ||
        e.region.toLowerCase().includes(q)
    );
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageSlice = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">All Cost Entries</h1>
        <p className="text-slate-500 text-sm mt-1">
          Daily granularity cost entries from Azure Cost Management.
        </p>
      </div>

      <DateRangePicker
        range={range}
        onApply={applyCustom}
        presets={presets}
        onPreset={applyPreset}
        isLoading={isLoading}
      />

      {isLoading && <LoadingSpinner message="Loading entries..." />}
      {isError && <ErrorAlert message={String(error)} onRetry={() => refetch()} />}

      {data && (
        <div className="card p-0 overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                placeholder="Search by group, service, type, or region…"
                value={search}
                onChange={handleSearch}
                className="pl-8 pr-4 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-azure-600 w-64"
              />
            </div>
            <span className="text-xs text-slate-500">
              {filtered.length.toLocaleString()} entr{filtered.length !== 1 ? 'ies' : 'y'}
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-medium">Date</th>
                  <th className="text-left px-5 py-3 font-medium">Resource Group</th>
                  <th className="text-left px-5 py-3 font-medium">Service</th>
                  <th className="text-left px-5 py-3 font-medium">Resource Type</th>
                  <th className="text-left px-5 py-3 font-medium">Subscription</th>
                  <th className="text-right px-5 py-3 font-medium">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {pageSlice.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-slate-500 text-sm">
                      No entries found.
                    </td>
                  </tr>
                ) : (
                  pageSlice.map((entry, i) => (
                    <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-2.5 text-slate-400 whitespace-nowrap">
                        {formatDate(entry.usageDate)}
                      </td>
                      <td className="px-5 py-2.5">
                        {entry.resourceGroup ? (
                          <a
                            href={portalRgUrl(entry.subscriptionId, entry.resourceGroup)}
                            target="_blank"
                            rel="noreferrer"
                            className={`badge border ${colorForString(entry.resourceGroup)} hover:brightness-125 transition-[filter]`}
                          >
                            {entry.resourceGroup}
                          </a>
                        ) : (
                          <span className="text-slate-600 text-xs italic">None</span>
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-slate-300 max-w-[160px] truncate">
                        {entry.resourceType ? (
                          <a
                            href={portalBrowseUrl(entry.resourceType)}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-azure-300 transition-colors"
                          >
                            {entry.serviceName || entry.resourceType}
                          </a>
                        ) : (entry.serviceName || '—')}
                      </td>
                      <td className="px-5 py-2.5 text-slate-400 text-xs max-w-[160px] truncate">
                        {entry.resourceType || '—'}
                      </td>
                      <td className="px-5 py-2.5 text-slate-500 text-xs max-w-[140px] truncate">
                        {entry.subscriptionName || entry.subscriptionId || '—'}
                      </td>
                      <td className="px-5 py-2.5 text-right font-medium text-slate-200 whitespace-nowrap">
                        {formatCurrency(entry.cost, entry.currency)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="btn-secondary text-xs py-1 px-3"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="btn-secondary text-xs py-1 px-3"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
