import { useEffect } from 'react';

interface ToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, onClose, duration = 2200 }: ToastProps) {
  useEffect(() => {
    const timeoutId = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timeoutId);
  }, [duration, onClose]);

  return (
    <div className="toast-in fixed bottom-16 right-4 z-[220]">
      <div className="ui-toast-surface px-4 py-2 text-[13px] font-medium text-white">
        {message}
      </div>
    </div>
  );
}
