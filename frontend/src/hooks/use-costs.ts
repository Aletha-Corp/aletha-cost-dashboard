import { useQuery } from '@tanstack/react-query';
import { fetchCostSummary, fetchCostsByResourceGroup, fetchCostEntries, fetchCostsByOwner } from '../api/costs.api';
import type { DateRange } from '../types/cost.types';

export function useCostSummary(range: DateRange, enabled = true) {
  return useQuery({
    queryKey: ['cost-summary', range.startDate, range.endDate],
    queryFn: () => fetchCostSummary(range),
    enabled: enabled && !!range.startDate && !!range.endDate,
  });
}

export function useCostsByResourceGroup(range: DateRange, enabled = true) {
  return useQuery({
    queryKey: ['costs-by-rg', range.startDate, range.endDate],
    queryFn: () => fetchCostsByResourceGroup(range),
    enabled: enabled && !!range.startDate && !!range.endDate,
  });
}

export function useCostsByOwner(range: DateRange, enabled = true) {
  return useQuery({
    queryKey: ['costs-by-owner', range.startDate, range.endDate],
    queryFn: () => fetchCostsByOwner(range),
    enabled: enabled && !!range.startDate && !!range.endDate,
  });
}

export function useCostEntries(range: DateRange, enabled = true) {
  return useQuery({
    queryKey: ['cost-entries', range.startDate, range.endDate],
    queryFn: () => fetchCostEntries(range),
    enabled: enabled && !!range.startDate && !!range.endDate,
  });
}
