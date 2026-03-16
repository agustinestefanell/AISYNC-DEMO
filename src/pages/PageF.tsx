import { Fragment, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { DividerRail } from '../components/DividerRail';
import { SecondaryWorkspacePanel, type TeamMessage } from '../components/SecondaryWorkspacePanel';
import { useApp } from '../context';
import { getInitialTeamsMapState, getTeamTheme, getWorkersByTeam } from '../data/teams';
import type { AIProvider, AgentRole, TeamsGraphNode } from '../types';

const SECONDARY_WORKSPACE_STORAGE_KEY = 'aisync_secondary_workspaces_v1';
const SAVE_AGENT_ORDER: AgentRole[] = ['worker1', 'worker2', 'manager'];

interface WorkerThreadState {
  messages: TeamMessage[];
  selectedIds: string[];
  draft: string;
}

type SecondaryWorkspaceStore = Record<string, Record<string, WorkerThreadState>>;

function createMessageId() {
  return `team_seed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getProviderLabel(provider: AIProvider) {
  return provider === 'Google' ? 'Gemini' : provider;
}

function buildSeedMessages(teamLabel: string, workerLabel: string, provider: AIProvider): TeamMessage[] {
  const providerLabel = getProviderLabel(provider);

  return [
    {
      id: createMessageId(),
      role: 'user',
      content: `Prepare the active operating queue for ${teamLabel} and isolate the highest-priority task.`,
      timestamp: '09:10',
      senderLabel: 'User',
    },
    {
      id: createMessageId(),
      role: 'agent',
      content: `${workerLabel} is working the current ${teamLabel} lane and has isolated the next deliverable with dependencies called out explicitly.`,
      timestamp: '09:11',
      senderLabel: providerLabel,
    },
    {
      id: createMessageId(),
      role: 'user',
      content: 'Condense the next action into one line so it can be forwarded internally.',
      timestamp: '09:12',
      senderLabel: 'User',
    },
    {
      id: createMessageId(),
      role: 'agent',
      content: `Next action: ${workerLabel} completes the immediate ${teamLabel.toLowerCase()} step, surfaces blockers, and returns a short execution note for the team lead.`,
      timestamp: '09:13',
      senderLabel: providerLabel,
    },
  ];
}

function buildSeedWorkspace(teamLabel: string, workers: TeamsGraphNode[]) {
  return workers.reduce<Record<string, WorkerThreadState>>((accumulator, worker) => {
    accumulator[worker.id] = {
      messages: buildSeedMessages(teamLabel, worker.label, worker.provider),
      selectedIds: [],
      draft: '',
    };
    return accumulator;
  }, {});
}

function loadSecondaryWorkspaceStore() {
  if (typeof window === 'undefined') {
    return {} as SecondaryWorkspaceStore;
  }

  try {
    const saved = window.localStorage.getItem(SECONDARY_WORKSPACE_STORAGE_KEY);
    if (!saved) {
      return {};
    }

    const parsed = JSON.parse(saved) as SecondaryWorkspaceStore;
    return parsed ?? {};
  } catch {
    return {};
  }
}

export function PageF() {
  const { state, dispatch } = useApp();
  const [workspaceStore, setWorkspaceStore] = useState<SecondaryWorkspaceStore>(
    loadSecondaryWorkspaceStore,
  );
  const [activeWorkerId, setActiveWorkerId] = useState('');

  const teamsState = useMemo(getInitialTeamsMapState, [state.secondaryWorkspace?.teamId]);
  const teamId = state.secondaryWorkspace?.teamId ?? '';
  const teamLabel = state.secondaryWorkspace?.label ?? 'Secondary Workspace';
  const workersByTeam = useMemo(() => getWorkersByTeam(teamsState.teamsGraph), [teamsState.teamsGraph]);
  const workers = workersByTeam[teamId] ?? [];
  const theme = getTeamTheme(teamId);

  useEffect(() => {
    window.localStorage.setItem(
      SECONDARY_WORKSPACE_STORAGE_KEY,
      JSON.stringify(workspaceStore),
    );
  }, [workspaceStore]);

  useEffect(() => {
    if (!teamId || workers.length === 0 || workspaceStore[teamId]) {
      return;
    }

    setWorkspaceStore((current) => ({
      ...current,
      [teamId]: buildSeedWorkspace(teamLabel, workers),
    }));
  }, [teamId, teamLabel, workers, workspaceStore]);

  useEffect(() => {
    if (workers.length === 0) {
      setActiveWorkerId('');
      return;
    }

    if (!workers.some((worker) => worker.id === activeWorkerId)) {
      setActiveWorkerId(workers[0].id);
    }
  }, [activeWorkerId, workers]);

  const teamWorkspace = workspaceStore[teamId] ?? buildSeedWorkspace(teamLabel, workers);
  const panelWidth =
    workers.length > 1
      ? `calc((100% - ${(workers.length - 1) * 16}px) / ${workers.length})`
      : '100%';

  const updateWorkerState = (
    workerId: string,
    updater: (current: WorkerThreadState) => WorkerThreadState,
  ) => {
    setWorkspaceStore((current) => {
      const currentTeamState = current[teamId] ?? buildSeedWorkspace(teamLabel, workers);
      const nextWorkerState = updater(
        currentTeamState[workerId] ?? {
          messages: buildSeedMessages(
            teamLabel,
            workers.find((worker) => worker.id === workerId)?.label ?? workerId,
            workers.find((worker) => worker.id === workerId)?.provider ?? 'OpenAI',
          ),
          selectedIds: [],
          draft: '',
        },
      );

      return {
        ...current,
        [teamId]: {
          ...currentTeamState,
          [workerId]: nextWorkerState,
        },
      };
    });
  };

  const renderWorkerPanel = (worker: TeamsGraphNode, style?: CSSProperties) => {
    const workerIndex = Math.max(
      0,
      workers.findIndex((candidate) => candidate.id === worker.id),
    );
    const workerState = teamWorkspace[worker.id] ?? {
      messages: buildSeedMessages(teamLabel, worker.label, worker.provider),
      selectedIds: [],
      draft: '',
    };

    return (
      <SecondaryWorkspacePanel
        teamLabel={teamLabel}
        workerId={worker.id}
        workerLabel={worker.label}
        provider={worker.provider}
        saveAgent={SAVE_AGENT_ORDER[workerIndex % SAVE_AGENT_ORDER.length]}
        theme={theme}
        messages={workerState.messages}
        selectedIds={workerState.selectedIds}
        draft={workerState.draft}
        seedMessages={buildSeedMessages(teamLabel, worker.label, worker.provider)}
        forwardOptions={workers
          .filter((candidate) => candidate.id !== worker.id)
          .map((candidate) => ({
            id: candidate.id,
            label: candidate.label,
          }))}
        style={style}
        onSetDraft={(value) =>
          updateWorkerState(worker.id, (current) => ({
            ...current,
            draft: value,
          }))
        }
        onToggleSelect={(messageId) =>
          updateWorkerState(worker.id, (current) => ({
            ...current,
            selectedIds: current.selectedIds.includes(messageId)
              ? current.selectedIds.filter((id) => id !== messageId)
              : [...current.selectedIds, messageId],
          }))
        }
        onClearSelection={() =>
          updateWorkerState(worker.id, (current) => ({
            ...current,
            selectedIds: [],
          }))
        }
        onAddUserMessage={(message) =>
          updateWorkerState(worker.id, (current) => ({
            ...current,
            messages: [...current.messages, message],
          }))
        }
        onAddAgentReply={(message) =>
          updateWorkerState(worker.id, (current) => ({
            ...current,
            messages: [...current.messages, message],
          }))
        }
        onForwardSelection={(targetWorkerId, message) =>
          updateWorkerState(targetWorkerId, (current) => ({
            ...current,
            messages: [...current.messages, message],
          }))
        }
        onResetToSeed={(seedMessages) =>
          updateWorkerState(worker.id, (current) => ({
            ...current,
            messages: seedMessages,
            selectedIds: [],
            draft: '',
          }))
        }
        onClearChat={() =>
          updateWorkerState(worker.id, (current) => ({
            ...current,
            messages: [],
            selectedIds: [],
            draft: '',
          }))
        }
      />
    );
  };

  if (!state.secondaryWorkspace || !teamId || workers.length === 0) {
    return (
      <div className="app-page-shell h-full min-h-0 min-w-0 overflow-hidden px-2 py-2 sm:px-3 sm:py-3">
        <div className="app-frame mx-auto flex h-full min-h-0 w-full max-w-[1600px] items-center justify-center overflow-hidden px-6 py-6">
          <div className="max-w-lg text-center">
            <h1 className="ui-title">Secondary Workspace</h1>
            <p className="mt-3 text-sm text-neutral-600">
              Open a team workspace from Teams Map to load the corresponding sub-team workspace.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <button
                className="ui-button ui-button-primary text-white"
                onClick={() => dispatch({ type: 'SET_PAGE', page: 'D' })}
              >
                Go to Teams Map
              </button>
              <button
                className="ui-button text-neutral-700"
                onClick={() => dispatch({ type: 'SET_PAGE', page: 'A' })}
              >
                Go to Main Workspace
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activeWorker = workers.find((worker) => worker.id === activeWorkerId) ?? workers[0];

  return (
    <div className="app-page-shell h-full min-h-0 min-w-0 overflow-hidden px-2 py-2 sm:px-3 sm:py-3">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col gap-2">
        <div className="ui-surface ui-workspace-tabs scrollbar-thin flex items-center gap-1 overflow-x-auto p-1 lg:hidden">
          {workers.map((worker) => (
            <button
              key={worker.id}
              className={`ui-workspace-tab min-h-10 shrink-0 rounded-[10px] px-3 text-xs font-medium ${
                activeWorker?.id === worker.id
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
              onClick={() => setActiveWorkerId(worker.id)}
            >
              {worker.label}
            </button>
          ))}
        </div>

        <div className="app-frame flex min-h-0 flex-1 overflow-hidden lg:hidden">
          {renderWorkerPanel(activeWorker)}
        </div>

        <div className="app-frame hidden min-h-0 flex-1 overflow-hidden lg:flex">
          {workers.map((worker, index) => (
            <Fragment key={worker.id}>
              {index > 0 && <DividerRail />}
              {renderWorkerPanel(worker, { width: panelWidth })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
