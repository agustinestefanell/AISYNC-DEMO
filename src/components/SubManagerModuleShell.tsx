import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AgentPanel } from './AgentPanel';

const ASSIST_PANEL_STORAGE_KEY = 'aisync_sub_manager_shell_collapsed_v1';

function readInitialCollapsedState() {
  if (typeof window === 'undefined') {
    return false;
  }

  const assistMode = new URLSearchParams(window.location.search).get('assist');
  if (assistMode === 'collapsed') {
    return true;
  }

  if (assistMode === 'open') {
    return false;
  }

  try {
    return window.localStorage.getItem(ASSIST_PANEL_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function SubManagerModuleShell({
  managerDisplayName,
  children,
  mobileToggleDataAttr,
}: {
  managerDisplayName: string;
  children: ReactNode;
  mobileToggleDataAttr?: string;
}) {
  const [showManagerMobile, setShowManagerMobile] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(readInitialCollapsedState);

  useEffect(() => {
    try {
      window.localStorage.setItem(ASSIST_PANEL_STORAGE_KEY, String(isCollapsed));
    } catch {
      // Ignore local persistence failures and keep the shell functional.
    }
  }, [isCollapsed]);

  const mobileToggleAttrs = useMemo(
    () =>
      mobileToggleDataAttr
        ? ({
            [mobileToggleDataAttr]: 'true',
          } as Record<string, string>)
        : {},
    [mobileToggleDataAttr],
  );

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col gap-2">
      <div className="ui-surface app-short-landscape-flex flex items-center justify-between gap-3 px-3 py-2 sm:hidden">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
          Sub-Manager Panel
        </div>
        <button
          {...mobileToggleAttrs}
          className="ui-button min-h-9 px-3 text-xs text-neutral-700"
          onClick={() => setShowManagerMobile((value) => !value)}
        >
          {showManagerMobile ? 'Hide Sub-Manager' : 'Show Sub-Manager'}
        </button>
      </div>

      {showManagerMobile && (
        <div className="app-frame app-short-landscape-flex flex h-[46dvh] min-h-0 overflow-hidden sm:hidden">
          <AgentPanel agent="manager" managerDisplayName={managerDisplayName} />
        </div>
      )}

      <div className="app-frame app-short-landscape-flex flex min-h-0 flex-1 overflow-hidden sm:hidden">
        {children}
      </div>

      <div className="app-frame app-short-landscape-hide hidden min-h-0 flex-1 overflow-hidden sm:flex">
        <div
          className="app-assist-shell flex min-h-0 min-w-0 flex-1 overflow-hidden"
          data-assist-shell="true"
          data-assist-collapsed={isCollapsed ? 'true' : 'false'}
        >
          <div
            id="aisync-sub-manager-panel"
            className="app-assist-panel-wrap flex min-h-0 shrink-0 overflow-hidden"
            data-assist-panel-wrap="true"
            data-collapsed={isCollapsed ? 'true' : 'false'}
          >
            <AgentPanel
              agent="manager"
              managerDisplayName={managerDisplayName}
              className="app-assist-panel flex-1"
            />
          </div>

          <button
            type="button"
            className="app-assist-toggle-rail"
            data-assist-collapse-trigger="true"
            data-state={isCollapsed ? 'collapsed' : 'expanded'}
            aria-controls="aisync-sub-manager-panel"
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? 'Expand Sub-Manager panel' : 'Collapse Sub-Manager panel'}
            onClick={() => setIsCollapsed((value) => !value)}
          >
            <span className="app-assist-toggle-chip">{isCollapsed ? 'AI' : 'SM'}</span>
            <span className="app-assist-toggle-label">Assist Layer</span>
            <span className="app-assist-toggle-arrow" aria-hidden="true">
              {isCollapsed ? '>' : '<'}
            </span>
          </button>

          <div
            className="app-assist-main flex min-h-0 min-w-0 flex-1 overflow-hidden"
            data-assist-main="true"
          >
            <div className="app-assist-main-inner flex min-h-0 min-w-0 flex-1 overflow-hidden">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
