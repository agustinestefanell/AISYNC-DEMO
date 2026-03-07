import type { SavedFile } from '../types';
import { Modal } from './Modal';

interface FileViewerProps {
  file: SavedFile;
  projectName: string;
  onClose: () => void;
}

function getExtension(type: SavedFile['type']) {
  if (type === 'Conversation') return 'txt';
  if (type === 'Document') return 'doc';
  return 'md';
}

function getAgentLabel(agent: SavedFile['agent']) {
  if (agent === 'manager') return 'Manager';
  if (agent === 'worker1') return 'Worker 1';
  return 'Worker 2';
}

export function FileViewer({ file, projectName, onClose }: FileViewerProps) {
  const createdAt = new Date(file.createdAt);

  return (
    <Modal
      title={`${file.title}.${getExtension(file.type)}`}
      onClose={onClose}
      width="max-w-3xl"
    >
      <div className="mb-5 grid gap-3 border-b border-neutral-200/80 pb-4 text-xs text-neutral-600 md:grid-cols-4">
        <div>
          <span className="block text-[10px] uppercase tracking-[0.18em] text-neutral-400">
            Project
          </span>
          <span className="font-medium text-neutral-900">{projectName}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-[0.18em] text-neutral-400">
            Agent
          </span>
          <span className="font-medium text-neutral-900">{getAgentLabel(file.agent)}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-[0.18em] text-neutral-400">
            Type
          </span>
          <span className="font-medium text-neutral-900">{file.type}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-[0.18em] text-neutral-400">
            Saved
          </span>
          <span className="font-medium text-neutral-900">
            {createdAt.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}{' '}
            {createdAt.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>

      <div className="ui-surface-subtle max-h-[60vh] overflow-y-auto p-4">
        <pre className="whitespace-pre-wrap text-[13px] leading-6 text-neutral-800">
          {file.content}
        </pre>
      </div>
    </Modal>
  );
}
