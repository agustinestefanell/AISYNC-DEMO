import { Fragment, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { DividerRail } from '../components/DividerRail';
import { SecondaryWorkspacePanel, type TeamMessage } from '../components/SecondaryWorkspacePanel';
import {
  TeamSubManagerPanel,
  type TeamSubManagerForwardOption,
} from '../components/TeamSubManagerPanel';
import { useApp } from '../context';
import {
  consumeSecondaryWorkspaceFocusThread,
  SECONDARY_WORKSPACE_STORAGE_KEY,
  TEAM_MANAGER_THREAD_ID,
  getSecondaryWorkspaceStore,
  type WorkspaceThreadState,
} from '../crossVerificationRouting';
import {
  CROSS_VERIFICATION_TEAM_ID,
  getInitialTeamsMapState,
  getNodeById,
  getTeamTheme,
} from '../data/teams';
import {
  getTeamSubManagerForwardTargets,
  getTeamWorkerForwardTargets,
  isValidTeamSubManagerForwardTarget,
} from '../reviewForwardPolicy';
import {
  getTeamWorkspaceLaunchIdFromLocation,
  readTeamWorkspaceLaunch,
} from '../teamWorkspaceLaunch';
import type { AIProvider, AgentRole, ReviewForwardTargetOption, TeamsGraphNode } from '../types';
import { createWorkspaceVersion, createWorkspaceVersionEvent } from '../versioning';

const SAVE_AGENT_ORDER: AgentRole[] = ['worker1', 'worker2', 'manager'];

type SecondaryWorkspaceStore = Record<string, Record<string, WorkspaceThreadState>>;

function sortWorkspaceMembers(nodes: TeamsGraphNode[]) {
  return [...nodes].sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === 'senior_manager' ? -1 : 1;
    }

    return left.label.localeCompare(right.label);
  });
}

function createMessageId() {
  return `team_seed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getProviderLabel(provider: AIProvider) {
  return provider === 'Google' ? 'Gemini' : provider;
}

function buildSeedMessages(
  teamId: string,
  teamLabel: string,
  workerLabel: string,
  provider: AIProvider,
): TeamMessage[] {
  const providerLabel = getProviderLabel(provider);

  if (teamId === CROSS_VERIFICATION_TEAM_ID) {
    return [
      {
        id: createMessageId(),
        role: 'user',
        content: 'Compare this question independently and preserve any uncertainty in your answer.',
        timestamp: '09:10',
        senderLabel: 'User',
      },
      {
        id: createMessageId(),
        role: 'agent',
        content: `${workerLabel} is evaluating the claim independently and will return a comparable answer with uncertainty called out explicitly.`,
        timestamp: '09:11',
        senderLabel: providerLabel,
      },
      {
        id: createMessageId(),
        role: 'user',
        content: 'Condense your position so the manager can compare it against the other workers.',
        timestamp: '09:12',
        senderLabel: 'User',
      },
      {
        id: createMessageId(),
        role: 'agent',
        content: `Next action: ${workerLabel} returns a comparison-ready answer, highlights what remains uncertain, and avoids forcing consensus too early.`,
        timestamp: '09:13',
        senderLabel: providerLabel,
      },
    ];
  }

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

function buildTeamManagerSeedMessages(teamLabel: string, provider: AIProvider = 'OpenAI'): TeamMessage[] {
  return [
    {
      id: createMessageId(),
      role: 'user',
      content: `Review the current ${teamLabel} queue and prepare the next reviewed handoff.`,
      timestamp: '09:09',
      senderLabel: 'User',
    },
    {
      id: createMessageId(),
      role: 'agent',
      content: `${teamLabel} Sub-Manager is holding the active reviewed thread and can route work back into the team circuit when needed.`,
      timestamp: '09:10',
      senderLabel: getProviderLabel(provider),
    },
  ];
}

function buildSeedWorkspace(
  teamId: string,
  teamLabel: string,
  workers: TeamsGraphNode[],
  rootProvider: AIProvider = 'OpenAI',
) {
  return workers.reduce<Record<string, WorkspaceThreadState>>((accumulator, worker) => {
    accumulator[worker.id] = {
      messages: buildSeedMessages(teamId, teamLabel, worker.label, worker.provider),
      selectedIds: [],
      draft: '',
      locked: false,
      versions: [],
    };
    return accumulator;
  }, {
    [TEAM_MANAGER_THREAD_ID]: {
      messages: buildTeamManagerSeedMessages(teamLabel, rootProvider),
      selectedIds: [],
      draft: '',
      locked: false,
      versions: [],
    },
  });
}

export function PageF() {
  const { state, dispatch } = useApp();
  const [workspaceStore, setWorkspaceStore] = useState<SecondaryWorkspaceStore>(
    getSecondaryWorkspaceStore,
  );
  const launchId = useMemo(getTeamWorkspaceLaunchIdFromLocation, []);
  const [launchHydrated, setLaunchHydrated] = useState(false);
  const [activePanelId, setActivePanelId] = useState('');
  const [teamsState, setTeamsState] = useState(getInitialTeamsMapState);

  const teamId = state.secondaryWorkspace?.teamId ?? '';
  const workspaceRootId = state.secondaryWorkspace?.rootNodeId ?? '';
  const focusNodeId = state.secondaryWorkspace?.focusNodeId ?? '';
  const rootNode = useMemo(
    () => getNodeById(teamsState.teamsGraph, workspaceRootId),
    [teamsState.teamsGraph, workspaceRootId],
  );
  const focusNode = useMemo(
    () => getNodeById(teamsState.teamsGraph, focusNodeId) ?? rootNode,
    [focusNodeId, rootNode, teamsState.teamsGraph],
  );
  const teamLabel = rootNode?.label ?? state.secondaryWorkspace?.label ?? 'Secondary Workspace';
  const workspaceMembers = useMemo(() => {
    if (!rootNode) {
      return [];
    }

    if (rootNode.type === 'worker') {
      return [rootNode];
    }

    return sortWorkspaceMembers(
      teamsState.teamsGraph.filter(
        (node) => node.parentId === rootNode.id && node.type === 'worker',
      ),
    );
  }, [rootNode, teamsState.teamsGraph]);
  const workspaceStoreKey = teamId || rootNode?.id || '';
  const legacyWorkspaceStoreKey =
    rootNode?.id && rootNode.id !== workspaceStoreKey ? rootNode.id : '';
  const theme = getTeamTheme(teamId);
  const isCrossVerificationTeam = teamId === CROSS_VERIFICATION_TEAM_ID;
  const shouldShowTeamManager = rootNode?.type === 'senior_manager';

  useEffect(() => {
    if (!launchId || launchHydrated) {
      return;
    }

    const launch = readTeamWorkspaceLaunch(launchId);
    if (launch?.workspace) {
      if (launch.teamsStateSnapshot) {
        setTeamsState(launch.teamsStateSnapshot);
      }

      dispatch({
        type: 'SET_SECONDARY_WORKSPACE',
        workspace: launch.workspace,
      });
    }

    setLaunchHydrated(true);
  }, [dispatch, launchHydrated, launchId]);

  useEffect(() => {
    window.localStorage.setItem(
      SECONDARY_WORKSPACE_STORAGE_KEY,
      JSON.stringify(workspaceStore),
    );
  }, [workspaceStore]);

  useEffect(() => {
    if (!workspaceStoreKey || !legacyWorkspaceStoreKey || !workspaceStore[legacyWorkspaceStoreKey]) {
      return;
    }

    if (workspaceStore[workspaceStoreKey]) {
      return;
    }

    setWorkspaceStore((current) => {
      const legacyWorkspace = current[legacyWorkspaceStoreKey];
      if (!legacyWorkspace || current[workspaceStoreKey]) {
        return current;
      }

      const { [legacyWorkspaceStoreKey]: _legacyWorkspace, ...rest } = current;
      return {
        ...rest,
        [workspaceStoreKey]: legacyWorkspace,
      };
    });
  }, [legacyWorkspaceStoreKey, workspaceStore, workspaceStoreKey]);

  useEffect(() => {
    if (!workspaceStoreKey || workspaceMembers.length === 0 || workspaceStore[workspaceStoreKey]) {
      return;
    }

    setWorkspaceStore((current) => ({
      ...current,
      [workspaceStoreKey]: buildSeedWorkspace(teamId, teamLabel, workspaceMembers, rootNode?.provider),
    }));
  }, [teamId, teamLabel, workspaceMembers, workspaceStore, workspaceStoreKey]);

  useEffect(() => {
    if (workspaceMembers.length === 0) {
      setActivePanelId('');
      return;
    }

    const availablePanelIds = shouldShowTeamManager
      ? [TEAM_MANAGER_THREAD_ID, ...workspaceMembers.map((worker) => worker.id)]
      : workspaceMembers.map((worker) => worker.id);
    const resumeThreadId = workspaceStoreKey
      ? consumeSecondaryWorkspaceFocusThread(workspaceStoreKey)
      : null;
    const targetPanelId =
      focusNode?.id === rootNode?.id && shouldShowTeamManager
        ? TEAM_MANAGER_THREAD_ID
        : focusNode?.id ?? '';

    if (resumeThreadId && availablePanelIds.includes(resumeThreadId)) {
      setActivePanelId(resumeThreadId);
      return;
    }

    if (targetPanelId && availablePanelIds.includes(targetPanelId)) {
      setActivePanelId(targetPanelId);
      return;
    }

    if (!availablePanelIds.includes(activePanelId)) {
      setActivePanelId(availablePanelIds[0] ?? '');
    }
  }, [activePanelId, focusNode, rootNode, shouldShowTeamManager, workspaceMembers, workspaceStoreKey]);

  useEffect(() => {
    const syncWorkspaceStore = () => {
      const persisted = getSecondaryWorkspaceStore();
      const latestTeamsState = getInitialTeamsMapState();

      setWorkspaceStore((current) =>
        Object.keys(persisted).length === 0 ? current : persisted,
      );
      setTeamsState(latestTeamsState);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== SECONDARY_WORKSPACE_STORAGE_KEY) {
        return;
      }

      syncWorkspaceStore();
    };

    window.addEventListener('focus', syncWorkspaceStore);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('focus', syncWorkspaceStore);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const teamWorkspace =
    workspaceStore[workspaceStoreKey] ??
    buildSeedWorkspace(teamId, teamLabel, workspaceMembers, rootNode?.provider);
  const teamManagerState = teamWorkspace[TEAM_MANAGER_THREAD_ID] ?? {
    messages: buildTeamManagerSeedMessages(teamLabel, rootNode?.provider),
    selectedIds: [],
    draft: '',
    locked: false,
    versions: [],
  };
  const panelCount = shouldShowTeamManager ? workspaceMembers.length + 1 : workspaceMembers.length;
  const panelWidth =
    panelCount > 1
      ? `calc((100% - ${(panelCount - 1) * 16}px) / ${panelCount})`
      : '100%';

  const updateWorkerState = (
    threadId: string,
    updater: (current: WorkspaceThreadState) => WorkspaceThreadState,
  ) => {
    setWorkspaceStore((current) => {
      const currentTeamState =
        current[workspaceStoreKey] ??
        buildSeedWorkspace(teamId, teamLabel, workspaceMembers, rootNode?.provider);
      const nextWorkerState = updater(
        currentTeamState[threadId] ?? {
          messages:
            threadId === TEAM_MANAGER_THREAD_ID
              ? buildTeamManagerSeedMessages(teamLabel, rootNode?.provider)
              : buildSeedMessages(
                  teamId,
                  teamLabel,
                  workspaceMembers.find((worker) => worker.id === threadId)?.label ?? threadId,
                  workspaceMembers.find((worker) => worker.id === threadId)?.provider ?? 'OpenAI',
                ),
          selectedIds: [],
          draft: '',
          locked: false,
          versions: [],
        },
      );

      return {
        ...current,
        [workspaceStoreKey]: {
          ...currentTeamState,
          [threadId]: nextWorkerState,
        },
      };
    });
  };

  const renderWorkerPanel = (worker: TeamsGraphNode, style?: CSSProperties) => {
    const workerIndex = Math.max(
      0,
      workspaceMembers.findIndex((candidate) => candidate.id === worker.id),
    );
    const workerState = teamWorkspace[worker.id] ?? {
      messages: buildSeedMessages(teamId, teamLabel, worker.label, worker.provider),
      selectedIds: [],
      draft: '',
      locked: false,
      versions: [],
    };

    const workerForwardOptions = getTeamWorkerForwardTargets(worker.id, teamsState.teamsGraph);

    return (
      <SecondaryWorkspacePanel
        teamId={teamId}
        teamLabel={teamLabel}
        workerId={worker.id}
        workerLabel={worker.label}
        provider={worker.provider}
        saveAgent={SAVE_AGENT_ORDER[workerIndex % SAVE_AGENT_ORDER.length]}
        theme={theme}
        messages={workerState.messages}
        selectedIds={workerState.selectedIds}
        draft={workerState.draft}
        documentLocked={workerState.locked}
        workspaceVersions={workerState.versions}
        seedMessages={buildSeedMessages(teamId, teamLabel, worker.label, worker.provider)}
        forwardOptions={workerForwardOptions}
        style={style}
        onSetDraft={(value) =>
          updateWorkerState(worker.id, (current) => ({
            ...current,
            draft: value,
          }))
        }
        onToggleDocumentLock={() =>
          updateWorkerState(worker.id, (current) => ({
            ...current,
            locked: !current.locked,
          }))
        }
        onSaveVersion={() =>
          updateWorkerState(worker.id, (current) => {
            const version = createWorkspaceVersion(
              current.messages,
              current.draft,
              current.locked,
              current.versions,
              current.locked ? 'Locked checkpoint' : undefined,
            );

            dispatch({
              type: 'ADD_CALENDAR_EVENT',
              event: createWorkspaceVersionEvent({
                version,
                projectId: state.projects[0]?.id ?? 'project_1',
                agent: SAVE_AGENT_ORDER[workerIndex % SAVE_AGENT_ORDER.length],
                userLabel: state.userName,
                sourceLabel: `${teamLabel} | ${worker.label}`,
                teamId,
                teamLabel,
                threadLabel: worker.label,
                actorLabel: worker.label,
                managerLabel: `${teamLabel} Sub-Manager`,
                workerLabel: worker.label,
                versionSource: 'team',
                versionThreadId: worker.id,
              }),
            });

            return {
              ...current,
              versions: [...current.versions, version],
            };
          })
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
        onForwardSelection={(target, message) => {
          if (target.kind === 'team-worker' && target.workerId) {
            updateWorkerState(target.workerId, (current) => ({
              ...current,
              messages: [...current.messages, message],
            }));
            return;
          }

          if (target.kind === 'team-sub-manager') {
            updateWorkerState(TEAM_MANAGER_THREAD_ID, (current) => ({
              ...current,
              messages: [...current.messages, message],
            }));
          }
        }}
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

  const renderManagerPanel = (style?: CSSProperties) => {
    const forwardOptions: TeamSubManagerForwardOption[] = getTeamSubManagerForwardTargets(
      rootNode?.id ?? '',
      teamsState.teamsGraph,
    );

    return (
      <TeamSubManagerPanel
        teamId={teamId}
        teamLabel={teamLabel}
        provider={rootNode?.provider ?? 'OpenAI'}
        theme={theme}
        messages={teamManagerState.messages}
        selectedIds={teamManagerState.selectedIds}
        draft={teamManagerState.draft}
        documentLocked={teamManagerState.locked}
        workspaceVersions={teamManagerState.versions}
        seedMessages={buildTeamManagerSeedMessages(teamLabel, rootNode?.provider)}
        forwardOptions={forwardOptions}
        style={style}
        onSetDraft={(value) =>
          updateWorkerState(TEAM_MANAGER_THREAD_ID, (current) => ({
            ...current,
            draft: value,
          }))
        }
        onToggleDocumentLock={() =>
          updateWorkerState(TEAM_MANAGER_THREAD_ID, (current) => ({
            ...current,
            locked: !current.locked,
          }))
        }
        onSaveVersion={() =>
          updateWorkerState(TEAM_MANAGER_THREAD_ID, (current) => {
            const version = createWorkspaceVersion(
              current.messages,
              current.draft,
              current.locked,
              current.versions,
              current.locked ? 'Locked checkpoint' : undefined,
            );

            dispatch({
              type: 'ADD_CALENDAR_EVENT',
              event: createWorkspaceVersionEvent({
                version,
                projectId: state.projects[0]?.id ?? 'project_1',
                agent: 'manager',
                userLabel: state.userName,
                sourceLabel: `${teamLabel} | ${teamLabel} Sub-Manager`,
                teamId,
                teamLabel,
                threadLabel: `${teamLabel} Sub-Manager`,
                actorLabel: `${teamLabel} Sub-Manager`,
                managerLabel: `${teamLabel} Sub-Manager`,
                versionSource: 'team',
                versionThreadId: TEAM_MANAGER_THREAD_ID,
              }),
            });

            return {
              ...current,
              versions: [...current.versions, version],
            };
          })
        }
        onToggleSelect={(messageId) =>
          updateWorkerState(TEAM_MANAGER_THREAD_ID, (current) => ({
            ...current,
            selectedIds: current.selectedIds.includes(messageId)
              ? current.selectedIds.filter((id) => id !== messageId)
              : [...current.selectedIds, messageId],
          }))
        }
        onClearSelection={() =>
          updateWorkerState(TEAM_MANAGER_THREAD_ID, (current) => ({
            ...current,
            selectedIds: [],
          }))
        }
        onAddUserMessage={(message) =>
          updateWorkerState(TEAM_MANAGER_THREAD_ID, (current) => ({
            ...current,
            messages: [...current.messages, message],
          }))
        }
        onAddAgentReply={(message) =>
          updateWorkerState(TEAM_MANAGER_THREAD_ID, (current) => ({
            ...current,
            messages: [...current.messages, message],
          }))
        }
        onForwardSelection={(target, message) => {
          if (!isValidTeamSubManagerForwardTarget(target, forwardOptions)) {
            return;
          }

          if (target.workerId) {
            updateWorkerState(target.workerId, (current) => ({
              ...current,
              messages: [...current.messages, message],
            }));
            return;
          }

          if (target.agentRole) {
            dispatch({
              type: 'ADD_MESSAGE',
              agent: target.agentRole,
              message: {
                ...message,
                agent: target.agentRole,
              },
            });
            return;
          }

          if (target.kind === 'team-sub-manager') {
            updateWorkerState(TEAM_MANAGER_THREAD_ID, (current) => ({
              ...current,
              messages: [...current.messages, message],
            }));
          }
        }}
        onResetToSeed={(seedMessages) =>
          updateWorkerState(TEAM_MANAGER_THREAD_ID, (current) => ({
            ...current,
            messages: seedMessages,
            selectedIds: [],
            draft: '',
          }))
        }
        onClearChat={() =>
          updateWorkerState(TEAM_MANAGER_THREAD_ID, (current) => ({
            ...current,
            messages: [],
            selectedIds: [],
            draft: '',
          }))
        }
      />
    );
  };

  if (launchId && (!launchHydrated || !state.secondaryWorkspace)) {
    return (
      <div className="app-page-shell h-full min-h-0 min-w-0 overflow-hidden px-2 py-2 sm:px-3 sm:py-3">
        <div className="app-frame mx-auto flex h-full min-h-0 w-full max-w-[1600px] items-center justify-center overflow-hidden px-6 py-6">
          <div className="max-w-lg text-center">
            <h1 className="ui-title">Loading Team Workspace</h1>
            <p className="mt-3 text-sm text-neutral-600">
              Restoring the selected team workspace in this new window.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!state.secondaryWorkspace || !teamId || !rootNode) {
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

  const activeWorker =
    workspaceMembers.find((worker) => worker.id === activePanelId) ?? workspaceMembers[0] ?? null;

  return (
    <div className="app-page-shell h-full min-h-0 min-w-0 overflow-hidden px-2 py-2 sm:px-3 sm:py-3">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col gap-2">
        {isCrossVerificationTeam && (
          <div
            className="ui-surface-subtle px-4 py-3"
            style={{ borderColor: theme.border, backgroundColor: theme.soft }}
          >
            <div
              className="text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: theme.accent }}
            >
              Cross Verification Sub-Manager
            </div>
            <div className="mt-1 text-sm text-neutral-900">
              Enter the question, topic, or claim you want to cross-verify.
            </div>
          </div>
        )}

        {focusNode && rootNode && focusNode.id !== rootNode.id && (
          <div
            className="ui-surface-subtle px-4 py-3"
            style={{ borderColor: theme.border, backgroundColor: theme.soft }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: theme.accent }}>
              Focused Node
            </div>
            <div className="mt-1 text-sm text-neutral-900">
              {focusNode.label} | {focusNode.type === 'senior_manager' ? 'Sub-Manager' : 'Worker'}
            </div>
          </div>
        )}

        <div className="ui-surface ui-workspace-tabs scrollbar-thin flex items-center gap-1 overflow-x-auto p-1 lg:hidden">
          {shouldShowTeamManager && (
            <button
              className={`ui-workspace-tab min-h-10 shrink-0 rounded-[10px] px-3 text-xs font-medium ${
                activePanelId === TEAM_MANAGER_THREAD_ID
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
              onClick={() => setActivePanelId(TEAM_MANAGER_THREAD_ID)}
            >
              Sub-Manager
            </button>
          )}
          {workspaceMembers.map((worker) => (
            <button
              key={worker.id}
              className={`ui-workspace-tab min-h-10 shrink-0 rounded-[10px] px-3 text-xs font-medium ${
                activeWorker?.id === worker.id
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
              onClick={() => setActivePanelId(worker.id)}
            >
              {worker.label}
            </button>
          ))}
        </div>

        <div className="app-frame flex min-h-0 flex-1 overflow-hidden lg:hidden">
          {activePanelId === TEAM_MANAGER_THREAD_ID && shouldShowTeamManager
            ? renderManagerPanel()
            : activeWorker
              ? renderWorkerPanel(activeWorker)
              : null}
        </div>

        <div className="app-frame hidden min-h-0 flex-1 overflow-hidden lg:flex">
          {shouldShowTeamManager && (
            <>{renderManagerPanel({ width: panelWidth })}</>
          )}
          {workspaceMembers.map((worker, index) => (
            <Fragment key={worker.id}>
              {(index > 0 || shouldShowTeamManager) && <DividerRail />}
              {renderWorkerPanel(worker, { width: panelWidth })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
