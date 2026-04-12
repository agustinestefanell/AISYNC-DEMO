import { useEffect, useState } from 'react';
import { AgentPanel } from '../components/AgentPanel';
import { DividerRail } from '../components/DividerRail';
import { useApp } from '../context';
import type { AgentRole } from '../types';

export function PageA() {
  const { state } = useApp();
  const panelWidth = 'calc((100% - 32px) / 3)';
  const focusClass = 'ui-selection-ring';
  const [mobileAgent, setMobileAgent] = useState<AgentRole>('manager');
  const [tabletWorker, setTabletWorker] = useState<'worker1' | 'worker2'>('worker1');

  useEffect(() => {
    if (!state.workspaceFocusAgent) {
      return;
    }

    setMobileAgent(state.workspaceFocusAgent);
    if (state.workspaceFocusAgent === 'worker1' || state.workspaceFocusAgent === 'worker2') {
      setTabletWorker(state.workspaceFocusAgent);
    }
  }, [state.workspaceFocusAgent]);

  const workspaceTabs: Array<{ agent: AgentRole; label: string; mobileLabel: string }> = [
    { agent: 'manager', label: 'Manager', mobileLabel: 'Mgr' },
    { agent: 'worker1', label: 'Worker 1', mobileLabel: 'W1' },
    { agent: 'worker2', label: 'Worker 2', mobileLabel: 'W2' },
  ];

  const renderPanel = (agent: AgentRole) => (
    <AgentPanel
      agent={agent}
      auditSourcePage="A"
      editableRole={agent !== 'manager'}
      selectionScope={`page-a:${agent}`}
      className={state.workspaceFocusAgent === agent ? focusClass : ''}
    />
  );

  return (
    <div className="app-page-shell h-full min-h-0 min-w-0 overflow-hidden px-2 py-2 sm:px-3 sm:py-3">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col gap-2">
        <div className="ui-surface ui-workspace-tabs app-short-landscape-grid grid grid-cols-3 gap-1 p-1 sm:hidden">
          {workspaceTabs.map((tab) => (
            <button
              key={tab.agent}
              data-workspace-tab={tab.agent}
              className={`ui-workspace-tab min-h-10 min-w-0 rounded-[10px] px-2 text-xs font-medium ${
                mobileAgent === tab.agent
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
              onClick={() => setMobileAgent(tab.agent)}
            >
              <span className="sm:hidden">{tab.mobileLabel}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="ui-surface app-short-landscape-hide hidden items-center justify-between gap-3 px-3 py-2 sm:flex lg:hidden">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
            Tablet Workspace
          </div>
          <div className="flex items-center gap-1 rounded-[10px] bg-neutral-100 p-1">
            {(['worker1', 'worker2'] as const).map((worker) => (
              <button
                key={worker}
                className={`min-h-9 rounded-[8px] px-3 text-xs font-medium ${
                  tabletWorker === worker
                    ? 'bg-white text-neutral-900 shadow-[var(--shadow-soft)]'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
                onClick={() => setTabletWorker(worker)}
              >
                {worker === 'worker1' ? 'Worker 1' : 'Worker 2'}
              </button>
            ))}
          </div>
        </div>

        <div className="app-frame app-short-landscape-flex flex min-h-0 flex-1 overflow-hidden sm:hidden">
          {renderPanel(mobileAgent)}
        </div>

        <div className="app-frame app-short-landscape-hide hidden min-h-0 flex-1 overflow-hidden sm:flex lg:hidden">
          <AgentPanel
            agent="manager"
            auditSourcePage="A"
            selectionScope="page-a:manager"
            className={state.workspaceFocusAgent === 'manager' ? focusClass : ''}
            style={{ width: 'calc((100% - 16px) / 2)' }}
          />
          <DividerRail />
          <AgentPanel
            agent={tabletWorker}
            auditSourcePage="A"
            editableRole
            selectionScope={`page-a:${tabletWorker}`}
            className={state.workspaceFocusAgent === tabletWorker ? focusClass : ''}
            style={{ width: 'calc((100% - 16px) / 2)' }}
          />
        </div>

        <div className="app-frame hidden min-h-0 flex-1 overflow-hidden lg:flex">
          <AgentPanel
            agent="manager"
            auditSourcePage="A"
            selectionScope="page-a:manager"
            className={state.workspaceFocusAgent === 'manager' ? focusClass : ''}
            style={{ width: panelWidth }}
          />
          <DividerRail />
          <AgentPanel
            agent="worker1"
            auditSourcePage="A"
            editableRole
            selectionScope="page-a:worker1"
            className={state.workspaceFocusAgent === 'worker1' ? focusClass : ''}
            style={{ width: panelWidth }}
          />
          <DividerRail />
          <AgentPanel
            agent="worker2"
            auditSourcePage="A"
            editableRole
            selectionScope="page-a:worker2"
            className={state.workspaceFocusAgent === 'worker2' ? focusClass : ''}
            style={{ width: panelWidth }}
          />
        </div>
      </div>
    </div>
  );
}
