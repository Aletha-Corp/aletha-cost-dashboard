import { DollarSign, Layers, CloudCog, TrendingUp } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useCostSummary } from '../hooks/use-costs';
import { useDateRange } from '../hooks/use-date-range';
import { DateRangePicker } from '../components/DateRangePicker';
import { StatCard } from '../components/ui/StatCard';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorAlert } from '../components/ui/ErrorAlert';
import { formatCurrency, formatDate, chartColorAt } from '../utils/format';

export function SummaryPage() {
  const { range, applyPreset, applyCustom, presets } = useDateRange();
  const { data, isLoading, isError, error, refetch } = useCostSummary(range);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Cost Summary</h1>
        <p className="text-slate-500 text-sm mt-1">
          Overview of your Azure spending for the selected period.
        </p>
      </div>

      {/* Date picker */}
      <DateRangePicker
        range={range}
        onApply={applyCustom}
        presets={presets}
        onPreset={applyPreset}
        isLoading={isLoading}
      />

      {isLoading && <LoadingSpinner message="Fetching cost data from Azure..." />}
      {isError && <ErrorAlert message={String(error)} onRetry={() => refetch()} />}

      {data && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              label="Total Cost"
              value={formatCurrency(data.totalCost, data.currency)}
              icon={<DollarSign size={20} />}
              subtext={`${formatDate(data.periodStart)} – ${formatDate(data.periodEnd)}`}
              accent="text-azure-400"
            />
            <StatCard
              label="Resource Groups"
              value={String(data.resourceGroupCount)}
              icon={<Layers size={20} />}
              accent="text-purple-400"
            />
            <StatCard
              label="Distinct Services"
              value={String(data.serviceCount)}
              icon={<CloudCog size={20} />}
              accent="text-emerald-400"
            />
            <StatCard
              label="Daily Average"
              value={
                data.dailyCosts.length > 0
                  ? formatCurrency(data.totalCost / data.dailyCosts.length, data.currency)
                  : formatCurrency(0, data.currency)
              }
              icon={<TrendingUp size={20} />}
              subtext="per day"
              accent="text-amber-400"
            />
          </div>

          {/* Daily cost area chart */}
          <div className="card">
            <h2 className="text-sm font-semibold text-slate-300 mb-4">Daily Cost Trend</h2>
            {data.dailyCosts.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">No daily data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data.dailyCosts} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                    width={60}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid #1e293b',
                      borderRadius: '8px',
                      color: '#e2e8f0',
                    }}
                    formatter={(value: number, _name: string) => [
                      formatCurrency(value, data.currency),
                      'Cost',
                    ]}
                    labelFormatter={(label: string) => formatDate(label)}
                  />
                  <Area
                    type="monotone"
                    dataKey="cost"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#costGradient)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#3b82f6' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Bottom row: top resource groups + top services */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top resource groups pie */}
            <div className="card">
              <h2 className="text-sm font-semibold text-slate-300 mb-4">Top Resource Groups</h2>
              {data.topResourceGroups.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">No data.</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={data.topResourceGroups}
                      dataKey="totalCost"
                      nameKey="resourceGroup"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                    >
                      {data.topResourceGroups.map((_, index) => (
                        <Cell key={index} fill={chartColorAt(index)} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: '#0f172a',
                        border: '1px solid #1e293b',
                        borderRadius: '8px',
                        color: '#e2e8f0',
                      }}
                      formatter={(value: number) => [formatCurrency(value, data.currency), 'Cost']}
                    />
                    <Legend
                      formatter={(value) => (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Top services list */}
            <div className="card">
              <h2 className="text-sm font-semibold text-slate-300 mb-4">Top Services by Cost</h2>
              {data.topServices.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">No data.</p>
              ) : (
                <ul className="space-y-3">
                  {data.topServices.map((svc, i) => {
                    const pct =
                      data.totalCost > 0 ? (svc.totalCost / data.totalCost) * 100 : 0;
                    return (
                      <li key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-slate-300 truncate max-w-[60%]">
                            {svc.serviceName || svc.resourceType || 'Unknown'}
                          </span>
                          <span className="text-sm font-medium text-slate-200">
                            {formatCurrency(svc.totalCost, svc.currency)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: chartColorAt(i),
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
