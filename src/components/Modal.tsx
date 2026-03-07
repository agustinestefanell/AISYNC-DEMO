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
        className={`ui-modal-surface w-full ${width}`}
      >
        <div className="flex items-center justify-between border-b border-neutral-200/80 px-5 py-4">
          <h3 className="text-[18px] font-semibold tracking-[-0.02em] text-neutral-900">{title}</h3>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            onClick={onClose}
          >
            x
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
