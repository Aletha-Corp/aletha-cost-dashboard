import { useQuery } from '@tanstack/react-query';
import { fetchSecurityReport } from '../api/security.api';

export function useSecurityReport(opts?: { subscriptionId?: string }) {
  return useQuery({
    queryKey: ['security-report', opts?.subscriptionId],
    queryFn: () => fetchSecurityReport(opts),
    staleTime: 15 * 60 * 1000, // treat data as fresh for 15 min (matches backend cache)
    retry: 1,
  });
}

export function useSecurityReportRefetch(opts?: { subscriptionId?: string }) {
  return useQuery({
    queryKey: ['security-report-force', opts?.subscriptionId],
    queryFn: () => fetchSecurityReport({ ...opts, force: true }),
    enabled: false, // only triggered manually
  });
}
