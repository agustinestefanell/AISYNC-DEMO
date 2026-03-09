import { useState, type ChangeEvent } from 'react';
import { useApp } from '../context';
import type { AIProvider } from '../types';
import { Modal } from './Modal';
import { Toast } from './Toast';

function getProviderDisplayName(provider: AIProvider) {
  return provider === 'Google' ? 'Gemini' : provider;
}

function NavButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`ui-nav-button transition-colors ${
        active ? 'text-white' : 'text-white/78 hover:text-white'
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function BottomNav() {
  const { state, dispatch, saveWorkerConfig } = useApp();
  const [showSettings, setShowSettings] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showWorkerModal, setShowWorkerModal] = useState(false);
  const [toast, setToast] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [provider, setProvider] = useState<AIProvider>('OpenAI');
  const [promptFileName, setPromptFileName] = useState('');
  const [promptContent, setPromptContent] = useState('');

  const closeMenus = () => {
    setShowSettings(false);
    setShowAdvanced(false);
  };

  const resetWorkerForm = () => {
    setWorkerName('');
    setProvider('OpenAI');
    setPromptFileName('');
    setPromptContent('');
  };

  const handlePromptUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setPromptFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setPromptContent(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => {
      setPromptContent('');
    };
    reader.readAsText(file);
  };

  const handleSaveWorker = () => {
    if (!workerName.trim()) {
      setToast('Worker name is required.');
      return;
    }

    saveWorkerConfig({
      workerName: workerName.trim(),
      provider,
      promptFileName: promptFileName || 'No prompt uploaded',
      promptContent,
    });
    setShowWorkerModal(false);
    setToast('Worker configuration saved.');
    resetWorkerForm();
  };

  const ribbonColor =
    state.currentPage === 'F' && state.secondaryWorkspace
      ? state.secondaryWorkspace.color
      : '#111111';

  return (
    <>
      <nav
        className="ui-bottomnav relative shrink-0 px-4 text-white"
        style={{ backgroundColor: ribbonColor }}
      >
        <div className="mx-auto flex h-12 max-w-[1600px] min-w-0 items-center justify-center gap-3 overflow-hidden lg:gap-5">
          <NavButton
            label="+ Worker"
            onClick={() => {
              closeMenus();
              setShowWorkerModal(true);
            }}
          />

          <span className="text-white/20">|</span>

          <NavButton
            label="Main Workspace"
            active={state.currentPage === 'A'}
            onClick={() => {
              dispatch({ type: 'SET_PAGE', page: 'A' });
              closeMenus();
            }}
          />

          <span className="text-white/20">|</span>

          <NavButton
            label="Teams Map"
            active={state.currentPage === 'D'}
            onClick={() => {
              dispatch({ type: 'SET_PAGE', page: 'D' });
              closeMenus();
            }}
          />

          <span className="text-white/20">|</span>

          <NavButton
            label="Documentation Mode"
            active={state.currentPage === 'B'}
            onClick={() => {
              dispatch({ type: 'SET_PAGE', page: 'B' });
              closeMenus();
            }}
          />

          <span className="text-white/20">|</span>

          <NavButton
            label="Traceability Calendar"
            active={state.currentPage === 'C'}
            onClick={() => {
              dispatch({ type: 'SET_PAGE', page: 'C' });
              closeMenus();
            }}
          />

          <span className="text-white/20">|</span>

          <NavButton
            label="Prompts Library"
            active={state.currentPage === 'E'}
            onClick={() => {
              dispatch({ type: 'SET_PAGE', page: 'E' });
              closeMenus();
            }}
          />

          <span className="text-white/20">|</span>

          <div className="relative">
            <button
              className="ui-nav-button text-white/78 transition-colors hover:text-white"
              onClick={() => {
                setShowSettings((value) => !value);
                setShowAdvanced(false);
              }}
            >
              Settings
            </button>
            {showSettings && (
              <div className="ui-popover absolute bottom-12 left-1/2 min-w-44 -translate-x-1/2 py-1">
                {['Project Settings', 'Agent Labels', 'Theme Preset'].map((item) => (
                  <button
                    key={item}
                    className="block w-full px-4 py-2 text-left text-xs text-white/86 transition-colors hover:bg-white/8"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="text-white/20">|</span>

          <div className="relative">
            <button
              className="ui-nav-button text-white/78 transition-colors hover:text-white"
              onClick={() => {
                setShowAdvanced((value) => !value);
                setShowSettings(false);
              }}
            >
              Advanced
            </button>
            {showAdvanced && (
              <div className="ui-popover absolute bottom-12 right-0 min-w-48 py-1">
                {['Session Inspector', 'Forwarding Audit', 'Backup Notes'].map((item) => (
                  <button
                    key={item}
                    className="block w-full px-4 py-2 text-left text-xs text-white/65 transition-colors hover:bg-white/8"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </nav>

      {showWorkerModal && (
        <Modal
          title="Configure demo worker"
          onClose={() => {
            setShowWorkerModal(false);
            resetWorkerForm();
          }}
          width="max-w-2xl"
        >
          <div className="grid gap-4">
            <label className="grid gap-1">
              <span className="ui-label">Worker name</span>
              <input
                className="ui-input"
                value={workerName}
                onChange={(event) => setWorkerName(event.target.value)}
                placeholder="Example: Research Worker"
                autoFocus
              />
            </label>

            <div className="grid gap-1">
              <span className="ui-label">AI provider</span>
              <div className="flex flex-wrap gap-2">
                {(['OpenAI', 'Anthropic', 'Google'] as AIProvider[]).map((item) => (
                  <button
                    key={item}
                    className={`ui-button ${
                      provider === item
                        ? 'ui-button-primary text-white'
                        : 'text-neutral-700'
                    }`}
                    onClick={() => setProvider(item)}
                  >
                    {getProviderDisplayName(item)}
                  </button>
                ))}
              </div>
            </div>

            <label className="grid gap-1">
              <span className="ui-label">Upload prompts</span>
              <input
                className="ui-input"
                type="file"
                onChange={handlePromptUpload}
              />
            </label>

            <div className="ui-surface-subtle px-3 py-3 text-xs text-neutral-600">
              <div className="font-medium text-neutral-800">
                Prompt file: {promptFileName || 'No file selected'}
              </div>
              <div className="mt-1 max-h-14 overflow-hidden">
                {promptContent || 'File content is optional in demo mode. The file name will still be saved.'}
              </div>
            </div>

            {state.workerConfigs.length > 0 && (
              <div className="ui-surface px-3 py-3">
                <div className="mb-2 text-xs font-semibold tracking-[0.08em] text-neutral-700">
                  Saved demo workers
                </div>
                <div className="grid gap-2">
                  {state.workerConfigs.slice(0, 3).map((config) => (
                    <div key={config.id} className="flex items-center justify-between text-xs text-neutral-600">
                      <span>{config.workerName}</span>
                      <span>{getProviderDisplayName(config.provider)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                className="ui-button text-neutral-700"
                onClick={() => {
                  setShowWorkerModal(false);
                  resetWorkerForm();
                }}
              >
                Cancel
              </button>
              <button
                className="ui-button ui-button-primary text-white"
                onClick={handleSaveWorker}
              >
                Save
              </button>
            </div>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </>
  );
}
