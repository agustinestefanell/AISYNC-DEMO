import { useEffect, useState } from 'react';
import { AgentPanel } from './AgentPanel';
import { DividerRail } from './DividerRail';

interface CollapsibleManagerSidebarProps {
  className?: string;
  managerDisplayName: string;
  storageKey: string;
  selectionScope?: string;
  panelScope?: string;
}

function readCollapsedState(storageKey: string) {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return window.localStorage.getItem(storageKey) === '1';
  } catch {
    return false;
  }
}

export function CollapsibleManagerSidebar({
  className,
  managerDisplayName,
  storageKey,
  selectionScope,
  panelScope,
}: CollapsibleManagerSidebarProps) {
  const [collapsed, setCollapsed] = useState(() => readCollapsedState(storageKey));

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(storageKey, collapsed ? '1' : '0');
    } catch {
      // Ignore storage failures and keep the in-memory state.
    }
  }, [collapsed, storageKey]);

  return (
    <>
      {collapsed ? (
        <div className="ui-panel-sidebar flex w-[52px] shrink-0 flex-col items-center justify-between px-2 py-3">
          <button
            type="button"
            className="ui-button min-h-9 w-full px-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-700"
            onClick={() => setCollapsed(false)}
            title="Expand Sub-Manager panel"
            aria-label="Expand Sub-Manager panel"
          >
            Open
          </button>
          <div className="grid justify-items-center gap-2 text-center">
            <div className="[writing-mode:vertical-rl] rotate-180 text-[9px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
              SM Panel
            </div>
            <div className="[writing-mode:vertical-rl] rotate-180 text-[8px] font-medium uppercase tracking-[0.1em] text-neutral-400">
              Expand
            </div>
          </div>
        </div>
      ) : (
        <AgentPanel
          agent="manager"
          managerDisplayName={managerDisplayName}
          selectionScope={selectionScope}
          panelScope={panelScope}
          className={className}
        />
      )}
      <DividerRail
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
        title={collapsed ? 'Expand Sub-Manager panel' : 'Collapse Sub-Manager panel'}
      />
    </>
  );
}
