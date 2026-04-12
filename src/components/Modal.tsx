import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}

export function Modal({
  title,
  onClose,
  children,
  width = 'max-w-lg',
}: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`ui-modal-surface flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden ${width}`}
      >
        <div className="ui-modal-header">
          <h3 className="ui-modal-title pr-3 sm:text-[18px]">{title}</h3>
          <button
            className="ui-icon-button text-lg leading-none"
            onClick={onClose}
          >
            x
          </button>
        </div>
        <div className="overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
