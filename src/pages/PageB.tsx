import { useMemo, useState } from 'react';
import { AgentPanel } from '../components/AgentPanel';
import { DividerRail } from '../components/DividerRail';
import { DocumentationTree } from '../components/DocumentationTree';
import { FileViewer } from '../components/FileViewer';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { useApp } from '../context';

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
    <div className="min-h-0" data-docs-project-card={projectId}>
      <div className="mb-2 flex items-center gap-3">
        <h3 className="text-sm text-neutral-800">{projectName}</h3>
        <div className="h-px flex-1 bg-neutral-300" />
      </div>

      <div className="ui-surface h-full min-h-[320px] px-3 py-3">
        <DocumentationTree
          projectName={projectName}
          groupedFiles={grouped}
          onOpenFile={onOpenFile}
        />

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
  const [showManagerMobile, setShowManagerMobile] = useState(false);
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

  const documentationContent = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--color-surface-soft)]">
      <div className="px-2 pb-2 pt-2 sm:px-3 sm:pt-3">
        <div className="ui-surface relative py-3 text-center sm:py-2">
          <span className="px-24 text-sm font-semibold tracking-[0.14em] text-neutral-900 sm:px-0">
            DOCUMENTATION MODE
          </span>
          <button
            className="ui-button ui-button-primary absolute right-2 top-1/2 min-h-9 -translate-y-1/2 px-2.5 text-[11px] text-white sm:right-3 sm:min-h-8"
            onClick={() => setShowNewProjectModal(true)}
          >
            + new project
          </button>
        </div>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-2 sm:px-3 sm:pb-3" style={{ minHeight: 0 }}>
        <div className="grid gap-4 sm:gap-6 xl:grid-cols-2 xl:gap-8">
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

      <div className="border-t border-neutral-200 bg-white px-2 py-2 sm:px-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div className="grid gap-2">
            <div className="ui-surface-subtle px-3 py-2 text-[10px] text-neutral-700 sm:w-[250px]">
              <div className="mb-1 font-semibold">Set backups</div>
              <div>Manual session backups are indexed into this documentation tree.</div>
              <div>The path above is one continuous local hierarchy from drive to file.</div>
            </div>
          </div>

          <div className="w-full sm:w-[210px]">
            <div className="mb-1 text-left text-[11px] font-medium text-neutral-700 sm:text-right">
              Documentation Index v
            </div>
            <YearPreview />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="app-page-shell h-full min-h-0 min-w-0 overflow-hidden px-2 py-2 sm:px-3 sm:py-3">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col gap-2">
        <div className="ui-surface app-short-landscape-flex flex items-center justify-between gap-3 px-3 py-2 sm:hidden">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
            Manager Panel
          </div>
          <button
            data-docs-manager-toggle
            className="ui-button min-h-9 px-3 text-xs text-neutral-700"
            onClick={() => setShowManagerMobile((value) => !value)}
          >
            {showManagerMobile ? 'Hide Manager' : 'Show Manager'}
          </button>
        </div>

        {showManagerMobile && (
          <div className="app-frame app-short-landscape-flex flex h-[46dvh] min-h-0 overflow-hidden sm:hidden">
            <AgentPanel agent="manager" />
          </div>
        )}

        <div className="app-frame app-short-landscape-flex flex min-h-0 flex-1 overflow-hidden sm:hidden">
          {documentationContent}
        </div>

        <div className="app-frame app-short-landscape-hide hidden min-h-0 flex-1 overflow-hidden sm:flex">
          <AgentPanel
            agent="manager"
            className="w-[280px] shrink-0 md:w-[320px] lg:w-[432px]"
          />
          <DividerRail />
          {documentationContent}
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
