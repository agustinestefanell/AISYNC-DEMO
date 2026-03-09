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
  fileType,
  onFileTypeChange,
  projectId,
  onProjectIdChange,
  eventDate,
  onEventDateChange,
  projects,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  selectedMessages: SaveBackupPreviewMessage[];
  fileTitle: string;
  onFileTitleChange: (value: string) => void;
  fileType: FileType;
  onFileTypeChange: (value: FileType) => void;
  projectId: string;
  onProjectIdChange: (value: string) => void;
  eventDate: string;
  onEventDateChange: (value: string) => void;
  projects: Project[];
  onSave: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <Modal title="Save / Backup" onClose={onClose}>
      <div className="grid gap-3">
        <div className="ui-surface-subtle px-3 py-3 text-xs leading-5 text-neutral-700">
          Save / Backup is manual. Only the selected messages below will be stored.
        </div>

        <div className="ui-surface-subtle max-h-40 overflow-y-auto px-3 py-3 text-xs text-neutral-700">
          <div className="mb-2 font-medium text-neutral-800">
            Selected messages: {selectedMessages.length}
          </div>
          <div className="grid gap-2">
            {selectedMessages.map((message) => (
              <div key={message.id} className="rounded-lg border border-neutral-200 bg-white px-3 py-2">
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

        <label className="grid gap-1">
          <span className="ui-label">File name</span>
          <input
            className="ui-input text-xs"
            value={fileTitle}
            onChange={(event) => onFileTitleChange(event.target.value)}
          />
        </label>

        <label className="grid gap-1">
          <span className="ui-label">Type</span>
          <select
            className="ui-input text-xs"
            value={fileType}
            onChange={(event) => onFileTypeChange(event.target.value as FileType)}
          >
            <option value="Conversation">Conversation</option>
            <option value="Document">Document</option>
            <option value="Report">Report</option>
          </select>
        </label>

        <label className="grid gap-1">
          <span className="ui-label">Project</span>
          <select
            className="ui-input text-xs"
            value={projectId}
            onChange={(event) => onProjectIdChange(event.target.value)}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1">
          <span className="ui-label">Calendar date</span>
          <input
            className="ui-input text-xs"
            type="date"
            value={eventDate}
            onChange={(event) => onEventDateChange(event.target.value)}
          />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button className="ui-button text-neutral-700" onClick={onClose}>
            Cancel
          </button>
          <button
            className="ui-button ui-button-primary text-white"
            onClick={onSave}
            disabled={selectedMessages.length === 0}
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}
