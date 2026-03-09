import { useMemo, useRef, type InputHTMLAttributes } from 'react';
import { Modal } from './Modal';

export interface ContextUploadItem {
  id: string;
  label: string;
  sizeLabel: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildItems(fileList: FileList, source: 'files' | 'folder') {
  return Array.from(fileList).map((file, index) => ({
    id: `${source}_${Date.now()}_${index}`,
    label: source === 'folder' ? file.webkitRelativePath || file.name : file.name,
    sizeLabel: formatSize(file.size),
  }));
}

export function ContextUploadModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (items: ContextUploadItem[]) => void;
}) {
  const filesInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const folderInputProps = useMemo(
    () =>
      ({
        directory: '',
        webkitdirectory: '',
      }) as InputHTMLAttributes<HTMLInputElement> & {
        directory?: string;
        webkitdirectory?: string;
      },
    [],
  );

  if (!open) {
    return null;
  }

  return (
    <Modal title="Upload context" onClose={onClose}>
      <div className="grid gap-4">
        <div className="ui-surface-subtle px-3 py-3 text-xs leading-5 text-neutral-700">
          Select files or a local folder through the browser. AISync only receives the files you
          explicitly choose in this demo.
        </div>

        <div className="grid gap-2">
          <button
            className="ui-button ui-button-primary text-white"
            onClick={() => filesInputRef.current?.click()}
          >
            Choose Files
          </button>
          <button
            className="ui-button text-neutral-700"
            onClick={() => folderInputRef.current?.click()}
          >
            Choose Folder
          </button>
        </div>

        <div className="text-[11px] text-neutral-500">
          Folder uploads preserve relative paths when the browser supports directory selection.
        </div>

        <input
          ref={filesInputRef}
          className="hidden"
          type="file"
          multiple
          onChange={(event) => {
            const files = event.target.files;
            if (!files || files.length === 0) {
              return;
            }
            onSelect(buildItems(files, 'files'));
            event.target.value = '';
            onClose();
          }}
        />

        <input
          {...folderInputProps}
          ref={folderInputRef}
          className="hidden"
          type="file"
          onChange={(event) => {
            const files = event.target.files;
            if (!files || files.length === 0) {
              return;
            }
            onSelect(buildItems(files, 'folder'));
            event.target.value = '';
            onClose();
          }}
        />
      </div>
    </Modal>
  );
}
