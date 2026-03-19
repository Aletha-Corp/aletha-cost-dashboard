import { useState, useCallback } from 'react';
import { format, startOfMonth, startOfQuarter, startOfYear, subYears } from 'date-fns';
import type { DateRange } from '../types/cost.types';

export interface DatePreset {
  label: string;
  getRange: () => DateRange;
}

function fmt(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

function today() {
  return fmt(new Date());
}

const DEFAULT_PRESETS: DatePreset[] = [
  {
    label: 'This Month',
    getRange: () => ({ startDate: fmt(startOfMonth(new Date())), endDate: today() }),
  },
  {
    label: 'This Quarter',
    getRange: () => ({ startDate: fmt(startOfQuarter(new Date())), endDate: today() }),
  },
  {
    label: 'This Year',
    getRange: () => ({ startDate: fmt(startOfYear(new Date())), endDate: today() }),
  },
  {
    label: 'Last Year',
    getRange: () => ({
      startDate: fmt(startOfYear(subYears(new Date(), 1))),
      endDate: fmt(new Date(new Date().getFullYear() - 1, 11, 31)),
    }),
  },
  {
    label: 'All Time',
    getRange: () => ({ startDate: '2020-01-01', endDate: today() }),
  },
];

export function useDateRange(initialPreset = 'This Month') {
  const defaultPreset = DEFAULT_PRESETS.find((p) => p.label === initialPreset) ?? DEFAULT_PRESETS[0];
  const [range, setRange] = useState<DateRange>(defaultPreset.getRange());

  const applyPreset = useCallback((preset: DatePreset) => {
    setRange(preset.getRange());
  }, []);

  const applyCustom = useCallback((startDate: string, endDate: string) => {
    setRange({ startDate, endDate });
  }, []);

  return { range, setRange, applyPreset, applyCustom, presets: DEFAULT_PRESETS };
}
