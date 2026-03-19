import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, User, Users, Layers, CloudCog, Search, X } from 'lucide-react';
import { useCostsByOwner } from '../hooks/use-costs';
import { useDateRange } from '../hooks/use-date-range';
import type { DatePreset } from '../hooks/use-date-range';
import { DateRangePicker } from '../components/DateRangePicker';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorAlert } from '../components/ui/ErrorAlert';
import { formatCurrency, colorForString } from '../utils/format';
import type { OwnerCost } from '../types/cost.types';

function PersonRow({ person }: { person: OwnerCost }) {
  const [expanded, setExpanded] = useState(false);
  const isUnassigned = person.owner === 'Unassigned';
  const badgeClass = isUnassigned ? 'text-slate-500 border-slate-700 bg-slate-800' : colorForString(person.owner);

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
          <User size={16} className={isUnassigned ? 'text-slate-600 shrink-0' : 'text-slate-400 shrink-0'} />
          <span className={`badge border ${badgeClass}`}>{person.owner}</span>
          <span className="text-xs text-slate-500 shrink-0">
            {person.resourceGroupCount} RG{person.resourceGroupCount !== 1 ? 's' : ''}
          </span>
          <span className="text-xs text-slate-500 shrink-0">
            {person.serviceCount} service{person.serviceCount !== 1 ? 's' : ''}
          </span>
        </div>
        <span className="text-slate-100 font-semibold shrink-0 ml-4">
          {formatCurrency(person.totalCost, person.currency)}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-slate-800 px-5 py-4 space-y-4">
          {/* Resource Groups */}
          {person.resourceGroups.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Layers size={13} className="text-slate-500" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Resource Groups</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase tracking-wider">
                    <th className="text-left pb-2 font-medium">Name</th>
                    <th className="text-right pb-2 font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {person.resourceGroups.map((rg, i) => (
                    <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2 pr-4 text-slate-300 max-w-[280px] truncate">{rg.name}</td>
                      <td className="py-2 text-right text-slate-300 font-mono text-xs">
                        {formatCurrency(rg.totalCost, person.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Services */}
          {person.services.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CloudCog size={13} className="text-slate-500" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Services</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase tracking-wider">
                    <th className="text-left pb-2 font-medium">Service</th>
                    <th className="text-left pb-2 font-medium">Resource Type</th>
                    <th className="text-right pb-2 font-medium">Resources</th>
                    <th className="text-right pb-2 font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {person.services.map((svc, i) => (
                    <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2 pr-4 text-slate-300 max-w-[160px] truncate">{svc.serviceName}</td>
                      <td className="py-2 pr-4 text-slate-500 text-xs max-w-[180px] truncate">{svc.resourceType}</td>
                      <td className="py-2 text-right text-slate-500 text-xs">{svc.resourceCount}</td>
                      <td className="py-2 text-right text-slate-300 font-mono text-xs">
                        {formatCurrency(svc.totalCost, svc.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PersonnelPage() {
  const { range, applyPreset, applyCustom, presets } = useDateRange();
  const { data, isLoading, error } = useCostsByOwner(range);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((p) => p.owner.toLowerCase().includes(q));
  }, [data, search]);

  // Keep Unassigned at the bottom
  const sorted = useMemo(() => {
    const assigned = filtered.filter((p) => p.owner !== 'Unassigned');
    const unassigned = filtered.filter((p) => p.owner === 'Unassigned');
    return [...assigned, ...unassigned];
  }, [filtered]);

  const totalPeople = data ? data.filter((p) => p.owner !== 'Unassigned').length : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Users size={20} className="text-azure-400" />
            <h1 className="text-xl font-semibold text-slate-100">Personnel</h1>
          </div>
          <p className="text-sm text-slate-500">
            Azure costs organized by employee / resource owner
            {data && (
              <span className="ml-2 text-slate-600">
                — {totalPeople} person{totalPeople !== 1 ? 's' : ''} identified
              </span>
            )}
          </p>
        </div>
        <DateRangePicker
          range={range}
          onApply={applyCustom}
          presets={presets}
          onPreset={(p: DatePreset) => applyPreset(p)}
          isLoading={isLoading}
        />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-8 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-azure-500 focus:border-azure-500"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading && <LoadingSpinner />}
      {error && <ErrorAlert message={error instanceof Error ? error.message : 'Failed to load personnel data'} />}

      {!isLoading && !error && sorted.length === 0 && (
        <div className="card text-center py-12 text-slate-500">
          {search ? `No results for "${search}"` : 'No owner data found for this period.'}
        </div>
      )}

      {!isLoading && !error && sorted.length > 0 && (
        <div className="space-y-3">
          {sorted.map((person) => (
            <PersonRow key={person.owner} person={person} />
          ))}
        </div>
      )}
    </div>
  );
}
