import apiClient from './api-client';
import type { CostSummary, ResourceGroupCost, CostEntry, DateRange, OwnerCost } from '../types/cost.types';

export async function fetchCostSummary(range: DateRange): Promise<CostSummary> {
  const { data } = await apiClient.get<CostSummary>('/costs/summary', { params: range });
  return data;
}

export async function fetchCostsByResourceGroup(range: DateRange): Promise<ResourceGroupCost[]> {
  const { data } = await apiClient.get<ResourceGroupCost[]>('/costs/by-resource-group', { params: range });
  return data;
}

export async function fetchCostsByOwner(range: DateRange): Promise<OwnerCost[]> {
  const { data } = await apiClient.get<OwnerCost[]>('/costs/by-owner', { params: range });
  return data;
}

export async function fetchCostEntries(range: DateRange): Promise<CostEntry[]> {
  const { data } = await apiClient.get<CostEntry[]>('/costs/entries', { params: range });
  return data;
}
