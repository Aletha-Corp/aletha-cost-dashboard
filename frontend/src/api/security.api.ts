import apiClient from './api-client';
import type { SecurityReport } from '../types/security.types';

export async function fetchSecurityReport(opts?: { subscriptionId?: string; force?: boolean }): Promise<SecurityReport> {
  const params: Record<string, string> = {};
  if (opts?.subscriptionId) params.subscriptionId = opts.subscriptionId;
  if (opts?.force) params.force = 'true';
  const { data } = await apiClient.get<SecurityReport>('/security/scan', { params });
  return data;
}
