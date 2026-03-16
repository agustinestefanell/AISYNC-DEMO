import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useApp } from '../context';
import type { AIProvider, Page } from '../types';
import { Modal } from './Modal';
import { Toast } from './Toast';

const PAGE_ITEMS: Array<{ label: string; shortLabel: string; page: Page }> = [
  { label: 'Main Workspace', shortLabel: 'Main', page: 'A' },
  { label: 'Documentation Mode', shortLabel: 'Docs', page: 'B' },
  { label: 'Traceability Calendar', shortLabel: 'Cal', page: 'C' },
  { label: 'Teams Map', shortLabel: 'Teams', page: 'D' },
  { label: 'Prompts Library', shortLabel: 'Prompts', page: 'E' },
];

const SETTINGS_ITEMS = ['Project Settings', 'Agent Labels', 'Theme Preset'];
const ADVANCED_ITEMS = ['Session Inspector', 'Forwarding Audit', 'Backup Notes'];

function getShouldUseCompactNav() {
  if (typeof window === 'undefined') {
    return true;
  }

  return (
    window.matchMedia('(max-width: 639px)').matches ||
    window.matchMedia('(orientation: landscape) and (max-width: 915px) and (max-height: 480px)')
      .matches
  );
}

function getProviderDisplayName(provider: AIProvider) {
  return provider === 'Google' ? 'Gemini' : provider;
}

function getPageLabel(page: Page, secondaryWorkspaceLabel?: string) {
  if (page === 'A') return 'Main Workspace';
  if (page === 'B') return 'Documentation Mode';
  if (page === 'C') return 'Traceability Calendar';
  if (page === 'D') return 'Teams Map';
  if (page === 'E') return 'Prompts Library';
  return secondaryWorkspaceLabel ? `Secondary Workspace | ${secondaryWorkspaceLabel}` : 'Secondary Workspace';
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
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [useCompactNav, setUseCompactNav] = useState(getShouldUseCompactNav);
  const [showWorkerModal, setShowWorkerModal] = useState(false);
  const [toast, setToast] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [provider, setProvider] = useState<AIProvider>('OpenAI');
  const [promptFileName, setPromptFileName] = useState('');
  const [promptContent, setPromptContent] = useState('');
  const currentPageLabel = useMemo(
    () => getPageLabel(state.currentPage, state.secondaryWorkspace?.label),
    [state.currentPage, state.secondaryWorkspace],
  );
  const mobilePages = useMemo(() => {
    if (!state.secondaryWorkspace) {
      return PAGE_ITEMS;
    }

    return [
      ...PAGE_ITEMS,
      {
        label: `Secondary Workspace | ${state.secondaryWorkspace.label}`,
        shortLabel: 'Workspace',
        page: 'F' as const,
      },
    ];
  }, [state.secondaryWorkspace]);

  const closeMenus = () => {
    setShowSettings(false);
    setShowAdvanced(false);
    setShowMobileMenu(false);
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

  const navigateToPage = (page: Page) => {
    dispatch({ type: 'SET_PAGE', page });
    closeMenus();
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const diagnosticsParams = new URLSearchParams(window.location.search);
    if (diagnosticsParams.has('responsive_diag') && diagnosticsParams.has('open_mobile_menu')) {
      setShowMobileMenu(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const compactWidth = window.matchMedia('(max-width: 639px)');
    const compactLandscape = window.matchMedia(
      '(orientation: landscape) and (max-width: 915px) and (max-height: 480px)',
    );

    const syncNavMode = () => {
      const nextUseCompactNav = compactWidth.matches || compactLandscape.matches;
      setUseCompactNav(nextUseCompactNav);

      if (!nextUseCompactNav) {
        setShowMobileMenu(false);
      }
    };

    syncNavMode();

    compactWidth.addEventListener('change', syncNavMode);
    compactLandscape.addEventListener('change', syncNavMode);

    return () => {
      compactWidth.removeEventListener('change', syncNavMode);
      compactLandscape.removeEventListener('change', syncNavMode);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <nav
        className="ui-bottomnav relative shrink-0 px-2 text-white sm:px-4"
        style={{ backgroundColor: ribbonColor }}
      >
        <div
          className={`ui-bottomnav-desktop mx-auto max-w-[1600px] min-w-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 py-1 lg:h-12 lg:flex-nowrap lg:gap-5 lg:py-0 ${
            useCompactNav ? 'hidden' : 'flex'
          }`}
        >
          <NavButton
            label="+ Worker"
            onClick={() => {
              closeMenus();
              setShowWorkerModal(true);
            }}
          />

          <span className="hidden text-white/20 lg:block">|</span>

          <NavButton
            label="Main Workspace"
            active={state.currentPage === 'A'}
            onClick={() => navigateToPage('A')}
          />

          <span className="hidden text-white/20 lg:block">|</span>

          <NavButton
            label="Teams Map"
            active={state.currentPage === 'D'}
            onClick={() => navigateToPage('D')}
          />

          <span className="hidden text-white/20 lg:block">|</span>

          <NavButton
            label="Documentation Mode"
            active={state.currentPage === 'B'}
            onClick={() => navigateToPage('B')}
          />

          <span className="hidden text-white/20 lg:block">|</span>

          <NavButton
            label="Traceability Calendar"
            active={state.currentPage === 'C'}
            onClick={() => navigateToPage('C')}
          />

          <span className="hidden text-white/20 lg:block">|</span>

          <NavButton
            label="Prompts Library"
            active={state.currentPage === 'E'}
            onClick={() => navigateToPage('E')}
          />

          {state.secondaryWorkspace && (
            <>
              <span className="hidden text-white/20 lg:block">|</span>
              <NavButton
                label="Secondary Workspace"
                active={state.currentPage === 'F'}
                onClick={() => navigateToPage('F')}
              />
            </>
          )}

          <span className="hidden text-white/20 lg:block">|</span>

          <div className="relative">
            <button
              className="ui-nav-button text-white/78 transition-colors hover:text-white"
              onClick={() => {
                setShowSettings((value) => !value);
                setShowAdvanced(false);
                setShowMobileMenu(false);
              }}
            >
              Settings
            </button>
            {showSettings && (
              <div className="ui-popover absolute bottom-12 left-1/2 min-w-44 -translate-x-1/2 py-1">
                {SETTINGS_ITEMS.map((item) => (
                  <button
                    key={item}
                    className="block w-full px-4 py-2 text-left text-xs text-white/86 transition-colors hover:bg-white/8"
                    onClick={closeMenus}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="hidden text-white/20 lg:block">|</span>

          <div className="relative">
            <button
              className="ui-nav-button text-white/78 transition-colors hover:text-white"
              onClick={() => {
                setShowAdvanced((value) => !value);
                setShowSettings(false);
                setShowMobileMenu(false);
              }}
            >
              Advanced
            </button>
            {showAdvanced && (
              <div className="ui-popover absolute bottom-12 right-0 min-w-48 py-1">
                {ADVANCED_ITEMS.map((item) => (
                  <button
                    key={item}
                    className="block w-full px-4 py-2 text-left text-xs text-white/65 transition-colors hover:bg-white/8"
                    onClick={closeMenus}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          className={`ui-bottomnav-mobile mx-auto min-h-14 max-w-[1600px] min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-1 ${
            useCompactNav ? 'grid' : 'hidden'
          }`}
        >
          <div className="min-w-0 px-2">
            <div className="ui-bottomnav-current-label truncate text-[10px] uppercase tracking-[0.16em] text-white/45">
              Navigation
            </div>
            <div className="ui-bottomnav-current-page truncate text-sm font-medium text-white">
              {currentPageLabel}
            </div>
          </div>

          <button
            data-mobile-menu-button
            aria-controls="mobile-navigation-sheet"
            aria-expanded={showMobileMenu}
            className="ui-bottomnav-menu-button inline-flex min-h-11 items-center gap-2 rounded-full border border-white/12 bg-white/10 px-4 text-xs font-semibold tracking-[0.14em] text-white transition-colors hover:bg-white/16"
            onClick={() => {
              setShowMobileMenu((value) => !value);
              setShowSettings(false);
              setShowAdvanced(false);
            }}
          >
            <span className="ui-bottomnav-menu-icon flex h-3.5 w-4 shrink-0 flex-col justify-between" aria-hidden="true">
              <span className="block h-[1.5px] rounded-full bg-current" />
              <span className="block h-[1.5px] rounded-full bg-current" />
              <span className="block h-[1.5px] rounded-full bg-current" />
            </span>
            <span>MENU</span>
          </button>
        </div>
      </nav>

      {showMobileMenu && useCompactNav && (
        <div
          className="app-short-landscape-block fixed inset-0 z-[170] bg-black/35"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeMenus();
            }
          }}
        >
          <div className="absolute inset-x-0 bottom-0 flex justify-center px-2 pb-[calc(env(safe-area-inset-bottom)+4.5rem)] pt-4">
            <div
              id="mobile-navigation-sheet"
              data-mobile-menu-sheet
              className="ui-popover ui-bottomnav-menu-sheet fade-in w-full max-w-sm overflow-hidden"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-white/10 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">
                  Navigate
                </div>
                <div className="mt-1 text-sm font-medium text-white">Choose a destination</div>
              </div>

              <div className="ui-bottomnav-menu-scroll max-h-[min(68dvh,26rem)] overflow-y-auto py-1">
                {mobilePages.map((item) => (
                  <button
                    key={item.page}
                    data-mobile-menu-item={item.label}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-white/86 transition-colors hover:bg-white/8"
                    onClick={() => navigateToPage(item.page)}
                  >
                    <span>{item.label}</span>
                    <span className="text-[10px] uppercase tracking-[0.16em] text-white/45">
                      {state.currentPage === item.page ? 'Current' : item.shortLabel}
                    </span>
                  </button>
                ))}

                <div className="border-b border-t border-white/10 px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-white/45">
                  Tools
                </div>
                <button
                  data-mobile-menu-item="+ Worker"
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-white/86 transition-colors hover:bg-white/8"
                  onClick={() => {
                    closeMenus();
                    setShowWorkerModal(true);
                  }}
                >
                  <span>+ Worker</span>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-white/45">Open</span>
                </button>

                <div className="border-b border-t border-white/10 px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-white/45">
                  Settings
                </div>
                {SETTINGS_ITEMS.map((item) => (
                  <button
                    key={item}
                    data-mobile-menu-item={item}
                    className="block w-full px-4 py-3 text-left text-sm text-white/72 transition-colors hover:bg-white/8 hover:text-white"
                    onClick={closeMenus}
                  >
                    {item}
                  </button>
                ))}

                <div className="border-b border-t border-white/10 px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-white/45">
                  Advanced
                </div>
                {ADVANCED_ITEMS.map((item) => (
                  <button
                    key={item}
                    data-mobile-menu-item={item}
                    className="block w-full px-4 py-3 text-left text-sm text-white/72 transition-colors hover:bg-white/8 hover:text-white"
                    onClick={closeMenus}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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
