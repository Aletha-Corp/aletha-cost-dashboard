import { AlertCircle } from 'lucide-react';

interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorAlert({ message, onRetry }: ErrorAlertProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <div className="flex items-start gap-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl px-5 py-4 max-w-lg w-full">
        <AlertCircle className="shrink-0 mt-0.5" size={18} />
        <div>
          <p className="font-medium text-sm">Failed to fetch data</p>
          <p className="text-sm text-rose-400 mt-1">{message}</p>
        </div>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary">
          Retry
        </button>
      )}
    </div>
  );
}
