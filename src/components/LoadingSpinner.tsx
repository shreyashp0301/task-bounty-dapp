import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ label }: { label?: string }) {
  return (
    <div className="loading-spinner">
      <Loader2 size={16} className="spinner" />
      {label && <span>{label}</span>}
    </div>
  );
}
