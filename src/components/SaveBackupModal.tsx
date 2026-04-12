import type { FileType, Project } from '../types';
import { Modal } from './Modal';

export interface SaveBackupPreviewMessage {
  id: string;
  senderLabel: string;
  timestamp: string;
  content: string;
}

export function SaveBackupModal({
  open,
  onClose,
  selectedMessages,
  fileTitle,
  onFileTitleChange,
  projectLabel,
  sourceLabel,
  saveTimestamp,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  selectedMessages: SaveBackupPreviewMessage[];
  fileTitle: string;
  onFileTitleChange: (value: string) => void;
  projectLabel: string;
  sourceLabel: string;
  saveTimestamp: string;
  onSave: () => void;
}) {
  if (!open) {
    return null;
  }

  const formattedTimestamp = new Date(saveTimestamp).toLocaleString('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return (
    <Modal title="Save Selection" onClose={onClose}>
      <div className="grid gap-4">
        <div className="ui-surface-subtle rounded-[18px] px-4 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
            User Definition
          </div>
          <label className="mt-3 grid gap-1.5">
            <span className="ui-label">Saved Selection title</span>
            <input
              className="ui-input h-11 text-sm"
              value={fileTitle}
              onChange={(event) => onFileTitleChange(event.target.value)}
            />
          </label>
        </div>

        <div className="ui-surface-subtle rounded-[18px] px-4 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
            System Metadata
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[14px] border border-neutral-200 bg-white px-3 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                Object Type
              </div>
              <div className="mt-1 text-sm font-medium text-neutral-900">Saved Selection</div>
            </div>
            <div className="rounded-[14px] border border-neutral-200 bg-white px-3 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                Save Timestamp
              </div>
              <div className="mt-1 text-sm font-medium text-neutral-900">{formattedTimestamp}</div>
            </div>
            <div className="rounded-[14px] border border-neutral-200 bg-white px-3 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                Project
              </div>
              <div className="mt-1 text-sm font-medium text-neutral-900">{projectLabel}</div>
            </div>
            <div className="rounded-[14px] border border-neutral-200 bg-white px-3 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                Origin
              </div>
              <div className="mt-1 text-sm font-medium text-neutral-900">{sourceLabel}</div>
            </div>
          </div>
        </div>

        <div className="ui-surface-subtle rounded-[18px] px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
              Selected Messages
            </div>
            <div className="text-xs font-medium text-neutral-600">
              {selectedMessages.length} selected
            </div>
          </div>
          <div className="mt-3 grid max-h-48 gap-2 overflow-y-auto text-xs text-neutral-700">
            {selectedMessages.map((message) => (
              <div key={message.id} className="rounded-[14px] border border-neutral-200 bg-white px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">
                  {message.senderLabel} | {message.timestamp}
                </div>
                <div className="mt-1 whitespace-pre-wrap text-[11px] leading-5 text-neutral-700">
                  {message.content}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button className="ui-button text-neutral-700" onClick={onClose}>
            Cancel
          </button>
          <button
            className="ui-button ui-button-primary text-white"
            onClick={onSave}
            disabled={selectedMessages.length === 0}
            title="Save the selected content"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}
