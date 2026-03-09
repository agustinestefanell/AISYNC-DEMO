import { AgentPanel } from '../components/AgentPanel';
import { DividerRail } from '../components/DividerRail';
import { useApp } from '../context';

export function PageA() {
  const { state } = useApp();
  const panelWidth = 'calc((100% - 32px) / 3)';
  const focusClass = 'ui-selection-ring';

  return (
    <div className="app-page-shell h-full min-h-0 min-w-0 overflow-hidden px-3 py-3">
      <div className="app-frame mx-auto flex h-full min-h-0 w-full max-w-[1600px] overflow-hidden">
        <AgentPanel
          agent="manager"
          className={state.workspaceFocusAgent === 'manager' ? focusClass : ''}
          style={{ width: panelWidth }}
        />
        <DividerRail />
        <AgentPanel
          agent="worker1"
          editableRole
          className={state.workspaceFocusAgent === 'worker1' ? focusClass : ''}
          style={{ width: panelWidth }}
        />
        <DividerRail />
        <AgentPanel
          agent="worker2"
          editableRole
          className={state.workspaceFocusAgent === 'worker2' ? focusClass : ''}
          style={{ width: panelWidth }}
        />
      </div>
    </div>
  );
}
