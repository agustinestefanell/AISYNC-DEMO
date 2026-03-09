import { useState, type ReactNode } from 'react';
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

function TreeFolder({
  label,
  depth,
  open,
  onToggle,
  children,
}: {
  label: string;
  depth: number;
  open: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <div>
      <button
        className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
        onClick={onToggle}
        style={{ paddingLeft: `${depth * 14}px` }}
      >
        <Chevron open={open} />
        <FolderIcon />
        <span>{label}</span>
      </button>

      {open && children}
    </div>
  );
}

function FileBranch({
  file,
  extension,
  depth,
  onOpenFile,
}: {
  file: SavedFile;
  extension: string;
  depth: number;
  onOpenFile: (fileId: string) => void;
}) {
  return (
    <button
      className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
      style={{ paddingLeft: `${depth * 14}px` }}
      onClick={() => onOpenFile(file.id)}
    >
      <span className="inline-block w-3" />
      <FileIcon />
      <span className="truncate">{file.title}.{extension}</span>
    </button>
  );
}

export function DocumentationTree({
  projectName,
  groupedFiles,
  onOpenFile,
}: {
  projectName: string;
  groupedFiles: {
    conversations: SavedFile[];
    documents: SavedFile[];
    reports: SavedFile[];
  };
  onOpenFile: (fileId: string) => void;
}) {
  const [openState, setOpenState] = useState({
    cDrive: true,
    desktop: true,
    projects: true,
    project: true,
    conversations: true,
    documents: true,
    reports: true,
  });

  const toggle = (key: keyof typeof openState) =>
    setOpenState((current) => ({ ...current, [key]: !current[key] }));

  return (
    <div className="ui-surface-subtle px-3 py-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
        Local Documentation Tree
      </div>

      <div className="relative border-l border-neutral-200/80 pl-1">
        <TreeFolder
          label="C:"
          depth={0}
          open={openState.cDrive}
          onToggle={() => toggle('cDrive')}
        >
          <TreeFolder
            label="Escritorio"
            depth={1}
            open={openState.desktop}
            onToggle={() => toggle('desktop')}
          >
            <TreeFolder
              label="Proyectos"
              depth={2}
              open={openState.projects}
              onToggle={() => toggle('projects')}
            >
              <TreeFolder
                label={projectName}
                depth={3}
                open={openState.project}
                onToggle={() => toggle('project')}
              >
                <TreeFolder
                  label="Conversations"
                  depth={4}
                  open={openState.conversations}
                  onToggle={() => toggle('conversations')}
                >
                  <div className="grid gap-0.5">
                    {groupedFiles.conversations.length > 0 ? (
                      groupedFiles.conversations.map((file) => (
                        <FileBranch
                          key={file.id}
                          file={file}
                          extension="txt"
                          depth={5}
                          onOpenFile={onOpenFile}
                        />
                      ))
                    ) : (
                      <div
                        className="px-1.5 py-0.5 text-[11px] text-neutral-400"
                        style={{ paddingLeft: `${5 * 14}px` }}
                      >
                        No files yet.
                      </div>
                    )}
                  </div>
                </TreeFolder>

                <TreeFolder
                  label="Documents"
                  depth={4}
                  open={openState.documents}
                  onToggle={() => toggle('documents')}
                >
                  <div className="grid gap-0.5">
                    {groupedFiles.documents.length > 0 ? (
                      groupedFiles.documents.map((file) => (
                        <FileBranch
                          key={file.id}
                          file={file}
                          extension="docx"
                          depth={5}
                          onOpenFile={onOpenFile}
                        />
                      ))
                    ) : (
                      <div
                        className="px-1.5 py-0.5 text-[11px] text-neutral-400"
                        style={{ paddingLeft: `${5 * 14}px` }}
                      >
                        No files yet.
                      </div>
                    )}
                  </div>
                </TreeFolder>

                <TreeFolder
                  label="Reports"
                  depth={4}
                  open={openState.reports}
                  onToggle={() => toggle('reports')}
                >
                  <div className="grid gap-0.5">
                    {groupedFiles.reports.length > 0 ? (
                      groupedFiles.reports.map((file) => (
                        <FileBranch
                          key={file.id}
                          file={file}
                          extension="md"
                          depth={5}
                          onOpenFile={onOpenFile}
                        />
                      ))
                    ) : (
                      <div
                        className="px-1.5 py-0.5 text-[11px] text-neutral-400"
                        style={{ paddingLeft: `${5 * 14}px` }}
                      >
                        No files yet.
                      </div>
                    )}
                  </div>
                </TreeFolder>
              </TreeFolder>
            </TreeFolder>
          </TreeFolder>
        </TreeFolder>
      </div>
    </div>
  );
}
