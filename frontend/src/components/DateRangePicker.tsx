import { Calendar } from 'lucide-react';
import type { DateRange } from '../types/cost.types';
import type { DatePreset } from '../hooks/use-date-range';

interface DateRangePickerProps {
  range: DateRange;
  onApply: (startDate: string, endDate: string) => void;
  presets: DatePreset[];
  onPreset: (preset: DatePreset) => void;
  isLoading?: boolean;
}

export function DateRangePicker({
  range,
  onApply,
  presets,
  onPreset,
  isLoading,
}: DateRangePickerProps) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const start = fd.get('startDate') as string;
    const end = fd.get('endDate') as string;
    if (start && end && start <= end) {
      onApply(start, end);
    }
  }

  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-3">
        {/* Quick presets */}
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => onPreset(p)}
              disabled={isLoading}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-slate-700 hidden sm:block" />

        {/* Custom range */}
        <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5">
            <Calendar size={14} className="text-slate-500" />
            <input
              type="date"
              name="startDate"
              defaultValue={range.startDate}
              key={`start-${range.startDate}`}
              required
              className="bg-transparent text-slate-200 text-sm outline-none w-36"
            />
          </div>
          <span className="text-slate-500 text-sm">to</span>
          <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5">
            <Calendar size={14} className="text-slate-500" />
            <input
              type="date"
              name="endDate"
              defaultValue={range.endDate}
              key={`end-${range.endDate}`}
              required
              className="bg-transparent text-slate-200 text-sm outline-none w-36"
            />
          </div>
          <button type="submit" disabled={isLoading} className="btn-primary text-xs py-1.5 px-3">
            Apply
          </button>
        </form>
      </div>
    </div>
  );
}
