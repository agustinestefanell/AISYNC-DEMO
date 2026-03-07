import { useMemo, useState } from 'react';
import { AgentPanel } from '../components/AgentPanel';
import { FileViewer } from '../components/FileViewer';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { useApp } from '../context';
import type { SavedFile } from '../types';

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3 w-3 transition-transform ${open ? 'rotate-90' : ''}`}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M4 2.5L8 6L4 9.5" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-amber-500" viewBox="0 0 16 16" fill="currentColor">
      <path d="M1.5 3.25h4l1 1.25h8v7.75H1.5z" />
      <path d="M1.5 4.5h13v-1H6.9L5.9 2.25H1.5z" className="opacity-70" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-neutral-500" viewBox="0 0 16 16" fill="currentColor">
      <path d="M3 1.5h6.5L13 5v9.5H3z" />
      <path d="M9.5 1.5V5H13" className="opacity-50" />
    </svg>
  );
}

function FolderSection({
  label,
  files,
  extension,
  onOpenFile,
}: {
  label: string;
  files: SavedFile[];
  extension: string;
  onOpenFile: (fileId: string) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button
        className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
        onClick={() => setOpen((value) => !value)}
      >
        <Chevron open={open} />
        <FolderIcon />
        <span>{label}/</span>
      </button>

      {open && (
        <div className="relative mt-1 ml-3 border-l border-neutral-200 pl-3">
          {files.length > 0 ? (
            files.map((file) => (
              <button
                key={file.id}
                className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
                onClick={() => onOpenFile(file.id)}
              >
                <FileIcon />
                <span className="truncate">{file.title}.{extension}</span>
              </button>
            ))
          ) : (
            <div className="px-1 py-0.5 text-[11px] text-neutral-400">No files yet.</div>
          )}
        </div>
      )}
    </div>
  );
}

function YearPreview() {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  return (
    <div className="ui-surface p-2">
      <div
        className="mb-1 text-center text-[10px] font-semibold tracking-[0.16em]"
        style={{ color: 'var(--color-accent)' }}
      >
        2026
      </div>
      <div className="grid grid-cols-3 gap-1">
        {months.map((month) => (
          <div key={month} className="rounded border border-neutral-200 py-1 text-center text-[9px] text-neutral-500">
            {month}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectCard({
  projectId,
  projectName,
  onOpenFile,
  onToast,
}: {
  projectId: string;
  projectName: string;
  onOpenFile: (fileId: string) => void;
  onToast: (message: string) => void;
}) {
  const { state } = useApp();
  const files = state.savedFiles.filter((file) => file.projectId === projectId);

  const grouped = useMemo(
    () => ({
      conversations: files.filter((file) => file.type === 'Conversation'),
      documents: files.filter((file) => file.type === 'Document'),
      reports: files.filter((file) => file.type === 'Report'),
    }),
    [files],
  );

  return (
    <div className="min-h-0">
      <div className="mb-2 flex items-center gap-3">
        <h3 className="text-sm text-neutral-800">{projectName}</h3>
        <div className="h-px flex-1 bg-neutral-300" />
      </div>

      <div className="ui-surface h-full min-h-[290px] px-3 py-3">
        <div className="grid gap-2">
          <FolderSection
            label="Conversations"
            files={grouped.conversations}
            extension="txt"
            onOpenFile={onOpenFile}
          />
          <FolderSection
            label="Documents"
            files={grouped.documents}
            extension="docx"
            onOpenFile={onOpenFile}
          />
          <FolderSection
            label="Reports"
            files={grouped.reports}
            extension="md"
            onOpenFile={onOpenFile}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-3 border-t border-neutral-200 pt-3 text-[11px]">
          <button
            className="text-neutral-700 underline-offset-2 transition-colors hover:text-neutral-950 hover:underline"
            onClick={() => onToast('Folder creation is a placeholder in this demo.')}
          >
            [+ New Folder]
          </button>
          <button
            className="text-neutral-700 underline-offset-2 transition-colors hover:text-neutral-950 hover:underline"
            onClick={() => onToast('Open in Finder/Explorer is not available in the web demo.')}
          >
            [Open in Finder/Explorer]
          </button>
        </div>
      </div>
    </div>
  );
}

export function PageB() {
  const { state, dispatch } = useApp();
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [openFileId, setOpenFileId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const openFile = state.savedFiles.find((file) => file.id === openFileId) ?? null;
  const openProject =
    state.projects.find((project) => project.id === openFile?.projectId) ?? null;

  const handleCreateProject = () => {
    if (!newProjectName.trim()) {
      return;
    }

    dispatch({
      type: 'ADD_PROJECT',
      project: {
        id: `proj_${Date.now()}`,
        name: newProjectName.trim(),
      },
    });
    setNewProjectName('');
    setShowNewProjectModal(false);
    setToast('Project created.');
  };

  return (
    <div className="app-page-shell h-full min-h-0 min-w-0 overflow-hidden px-3 py-3">
      <div className="app-frame mx-auto flex h-full min-h-0 w-full max-w-[1600px] overflow-hidden">
        <AgentPanel agent="manager" showSaveAction style={{ width: 360, flexShrink: 0 }} />

        <div className="ui-divider-rail flex w-4 shrink-0 items-start justify-center pt-4 text-[10px]">
          <div className="grid gap-1 text-center">
            <span>{'<'}</span>
            <span>{'>'}</span>
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--color-surface-soft)]">
          <div className="px-3 pb-2 pt-3">
            <div className="ui-surface relative py-2 text-center">
              <span className="text-sm font-semibold tracking-[0.14em] text-neutral-900">
                DOCUMENTATION MODE
              </span>
              <button
                className="ui-button ui-button-primary absolute right-3 top-1/2 min-h-8 -translate-y-1/2 px-2.5 text-[11px] text-white"
                onClick={() => setShowNewProjectModal(true)}
              >
                + new project
              </button>
            </div>
          </div>

          <div className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-3" style={{ minHeight: 0 }}>
            <div className="grid gap-8 xl:grid-cols-2">
              {state.projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  projectId={project.id}
                  projectName={project.name}
                  onOpenFile={setOpenFileId}
                  onToast={setToast}
                />
              ))}
            </div>
          </div>

          <div className="border-t border-neutral-200 bg-white px-3 py-2">
            <div className="flex items-end justify-between gap-6">
              <div className="grid gap-2">
                <div className="ui-surface-subtle w-[250px] px-3 py-2 text-[10px] text-neutral-700">
                  <div className="mb-1 font-semibold">Set backups</div>
                  <div>AISync saves reports to: ~/AISync/ProjectName/ [Change]</div>
                  <div>Reports are saved daily and organized chronologically.</div>
                </div>
              </div>

              <div className="w-[210px]">
                <div className="mb-1 text-right text-[11px] font-medium text-neutral-700">
                  Documentation Index v
                </div>
                <YearPreview />
              </div>
            </div>
          </div>
        </div>
      </div>

      {openFile && openProject && (
        <FileViewer
          file={openFile}
          projectName={openProject.name}
          onClose={() => setOpenFileId(null)}
        />
      )}

      {showNewProjectModal && (
        <Modal title="New project" onClose={() => setShowNewProjectModal(false)}>
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="ui-label">Project name</span>
              <input
                className="ui-input text-xs"
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    handleCreateProject();
                  }
                }}
                autoFocus
              />
            </label>

            <div className="flex justify-end gap-2">
              <button
                className="ui-button text-neutral-700"
                onClick={() => setShowNewProjectModal(false)}
              >
                Cancel
              </button>
              <button
                className="ui-button ui-button-primary text-white"
                onClick={handleCreateProject}
              >
                Create
              </button>
            </div>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}
