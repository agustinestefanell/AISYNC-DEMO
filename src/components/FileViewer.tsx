import type { SavedFile } from '../types';
import { getWorkPhaseState } from '../phaseState';
import { Modal } from './Modal';

type FileViewerMetadata = {
  documentType: string | null;
  documentState: string | null;
  documentVersion: string | null;
  userLabel: string | null;
  ownerLabel: string | null;
  lastResponsible: string | null;
  updatedAt: string | null;
  latestReference: string | null;
};

interface FileViewerProps {
  file: SavedFile;
  projectName: string;
  metadata?: FileViewerMetadata;
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

function formatDateTime(value?: string | null) {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })} ${date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function getDocumentStateClassName(state: string) {
  if (state === 'Approved') return 'ui-phase-pill ui-phase-pill-closed';
  if (state === 'Locked') return 'ui-phase-pill bg-neutral-900 text-white';
  if (state === 'Under Review') return 'ui-phase-pill ui-phase-pill-review';
  return 'ui-phase-pill ui-phase-pill-open';
}

export function FileViewer({ file, projectName, metadata, onClose }: FileViewerProps) {
  const phaseState = getWorkPhaseState(file.phaseState);
  const documentType = metadata?.documentType ?? file.type;
  const documentState = metadata?.documentState ?? phaseState;
  const userLabel = metadata?.userLabel ?? 'n/a';
  const ownerLabel = metadata?.ownerLabel ?? file.sourceLabel ?? getAgentLabel(file.agent);
  const lastResponsible = metadata?.lastResponsible ?? ownerLabel;
  const updatedAt = metadata?.updatedAt ?? file.createdAt;
  const latestReference = metadata?.latestReference ?? updatedAt;

  return (
    <Modal
      title={`${file.title}.${getExtension(file.type)}`}
      onClose={onClose}
      width="max-w-3xl"
    >
      <div className="mb-5 grid gap-3 border-b border-neutral-200/80 pb-4 text-xs text-neutral-600 md:grid-cols-3 xl:grid-cols-5">
        <div>
          <span className="block text-[10px] uppercase tracking-[0.18em] text-neutral-400">
            Project
          </span>
          <span className="font-medium text-neutral-900">{projectName}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-[0.18em] text-neutral-400">
            Document Type
          </span>
          <span className="font-medium text-neutral-900">{documentType}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-[0.18em] text-neutral-400">
            Document State
          </span>
          <span className={getDocumentStateClassName(documentState)}>{documentState}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-[0.18em] text-neutral-400">
            Version
          </span>
          <span className="font-medium text-neutral-900">{metadata?.documentVersion ?? 'n/a'}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-[0.18em] text-neutral-400">
            USER
          </span>
          <span className="font-medium text-neutral-900">{userLabel}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-[0.18em] text-neutral-400">
            Owner
          </span>
          <span className="font-medium text-neutral-900">{ownerLabel}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-[0.18em] text-neutral-400">
            Last Responsible
          </span>
          <span className="font-medium text-neutral-900">{lastResponsible}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-[0.18em] text-neutral-400">
            Updated
          </span>
          <span className="font-medium text-neutral-900">{formatDateTime(updatedAt)}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-[0.18em] text-neutral-400">
            Latest Reference
          </span>
          <span className="font-medium text-neutral-900">{formatDateTime(latestReference)}</span>
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
