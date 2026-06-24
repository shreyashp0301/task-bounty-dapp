import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { toUserFriendlyError } from '../soroban';

export function ErrorMessage({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  useEffect(() => {
    if (!message || !onDismiss) return;
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;
  return (
    <div className="error-message">
      <AlertCircle size={16} />
      <span>{toUserFriendlyError(message)}</span>
      {onDismiss && (
        <button className="error-dismiss" onClick={onDismiss} aria-label="Dismiss error">
          &times;
        </button>
      )}
    </div>
  );
}
