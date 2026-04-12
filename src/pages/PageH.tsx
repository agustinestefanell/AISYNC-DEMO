import { useEffect, useMemo, useState } from 'react';
import { getWorkspaceVersionReferenceFromLocation } from '../auditLogLaunch';
import {
  SECONDARY_WORKSPACE_STORAGE_KEY,
  TEAM_MANAGER_THREAD_ID,
  setSecondaryWorkspaceFocusThread,
  getSecondaryWorkspaceStore,
  setWorkspaceThreadDraft,
  type SecondaryWorkspaceStore,
} from '../crossVerificationRouting';
import { getInitialTeamsMapState, getNodeById, getTeamTheme } from '../data/teams';
import { useApp } from '../context';
import type {
  AgentRole,
  SecondaryWorkspaceTarget,
  WorkspaceVersion,
  WorkspaceVersionReference,
} from '../types';

type CheckpointRecord = {
  id: string;
  source: 'main' | 'team';
  accentColor: string;
  workspaceLabel: string;
  threadLabel: string;
  threadId: string;
  teamId?: string;
  agent?: AgentRole;
  panelScope?: string;
  page?: 'A' | 'B' | 'C' | 'E';
  workspaceTarget?: SecondaryWorkspaceTarget;
  version: WorkspaceVersion;
};

const MAIN_AGENT_LABELS: Record<AgentRole, string> = {
  manager: 'AI General Manager',
  worker1: 'Worker 1',
  worker2: 'Worker 2',
};

const MAIN_AGENT_ACCENTS: Record<AgentRole, string> = {
  manager: 'var(--color-role-manager-accent)',
  worker1: 'var(--color-role-worker1-accent)',
  worker2: 'var(--color-role-worker2-accent)',
};

function formatSavedAt(savedAt: string) {
  return new Date(savedAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildResumeDraft(checkpoint: CheckpointRecord) {
  return [
    `Resume from Version ${checkpoint.version.versionNumber}`,
    `${checkpoint.workspaceLabel} | ${checkpoint.threadLabel}`,
    `Saved ${formatSavedAt(checkpoint.version.savedAt)}`,
    '',
    checkpoint.version.snapshotContent,
  ].join('\n');
}

function buildVersionTarget(checkpoint: CheckpointRecord): WorkspaceVersionReference {
  return {
    source: checkpoint.source,
    versionId: checkpoint.version.id,
    threadId: checkpoint.threadId,
    agent: checkpoint.agent,
    teamId: checkpoint.teamId,
    panelScope: checkpoint.panelScope,
  };
}

function matchesSelectedVersion(
  checkpoint: CheckpointRecord,
  target: WorkspaceVersionReference | null,
) {
  if (!target) {
    return false;
  }

  return (
    checkpoint.source === target.source &&
    checkpoint.version.id === target.versionId &&
    checkpoint.threadId === target.threadId &&
    (target.source === 'main'
      ? checkpoint.agent === target.agent && (checkpoint.panelScope ?? undefined) === (target.panelScope ?? undefined)
      : checkpoint.teamId === target.teamId)
  );
}

function getMainScopeConfig(scope: string) {
  if (scope === 'manager') {
    return {
      agent: 'manager' as const,
      accentColor: MAIN_AGENT_ACCENTS.manager,
      workspaceLabel: 'Main Workspace',
      threadLabel: MAIN_AGENT_LABELS.manager,
      page: 'A' as const,
    };
  }

  if (scope === 'worker1') {
    return {
      agent: 'worker1' as const,
      accentColor: MAIN_AGENT_ACCENTS.worker1,
      workspaceLabel: 'Main Workspace',
      threadLabel: MAIN_AGENT_LABELS.worker1,
      page: 'A' as const,
    };
  }

  if (scope === 'worker2') {
    return {
      agent: 'worker2' as const,
      accentColor: MAIN_AGENT_ACCENTS.worker2,
      workspaceLabel: 'Main Workspace',
      threadLabel: MAIN_AGENT_LABELS.worker2,
      page: 'A' as const,
    };
  }

  if (scope === 'page-b:manager') {
    return {
      agent: 'manager' as const,
      accentColor: MAIN_AGENT_ACCENTS.manager,
      workspaceLabel: 'Documentation Mode',
      threadLabel: 'Documentation Manager',
      page: 'B' as const,
    };
  }

  if (scope === 'page-c:manager') {
    return {
      agent: 'manager' as const,
      accentColor: MAIN_AGENT_ACCENTS.manager,
      workspaceLabel: 'Audit Log',
      threadLabel: 'Audit Log Manager',
      page: 'C' as const,
    };
  }

  if (scope === 'page-e:manager') {
    return {
      agent: 'manager' as const,
      accentColor: MAIN_AGENT_ACCENTS.manager,
      workspaceLabel: 'Prompts Library',
      threadLabel: 'Prompts Manager',
      page: 'E' as const,
    };
  }

  return null;
}

export function PageH() {
  const { state, dispatch } = useApp();
  const versionTargetFromLocation = useMemo(getWorkspaceVersionReferenceFromLocation, []);
  const [secondaryWorkspaceStore, setSecondaryWorkspaceStore] = useState<SecondaryWorkspaceStore>(
    getSecondaryWorkspaceStore,
  );
  const [workspaceFilter, setWorkspaceFilter] = useState<'all' | 'main' | 'team'>('all');
  const [lockFilter, setLockFilter] = useState<'all' | 'locked' | 'unlocked'>('all');
  const teamsState = useMemo(getInitialTeamsMapState, []);

  const checkpoints = useMemo<CheckpointRecord[]>(() => {
    const mainCheckpoints: CheckpointRecord[] = Object.entries(state.workspaceVersions).flatMap(
      ([scope, versions]) => {
        const config = getMainScopeConfig(scope);
        if (!config) {
          return [];
        }

        return versions.map((version) => ({
          id: `main:${scope}:${version.id}`,
          source: 'main' as const,
          accentColor: config.accentColor,
          workspaceLabel: config.workspaceLabel,
          threadLabel: config.threadLabel,
          threadId: scope,
          agent: config.agent,
          panelScope: scope === config.agent ? undefined : scope,
          page: config.page,
          version,
        }));
      },
    );

    const teamCheckpoints: CheckpointRecord[] = Object.entries(secondaryWorkspaceStore).flatMap(
      ([workspaceRootId, threads]) => {
        const rootNode = getNodeById(teamsState.teamsGraph, workspaceRootId);
        if (!rootNode) {
          return [];
        }

        const teamId = rootNode.teamId;
        const teamLabel = rootNode.label;
        const workspaceTarget: SecondaryWorkspaceTarget = {
          teamId,
          label: teamLabel,
          color: getTeamTheme(teamId).ribbon,
          nodeId: rootNode.id,
          nodeType: rootNode.type,
          rootNodeId: rootNode.id,
          focusNodeId: rootNode.id,
        };
        const workspaceMembers =
          rootNode.type === 'worker'
            ? [rootNode]
            : teamsState.teamsGraph.filter((node) => node.parentId === rootNode.id);

        return Object.entries(threads).flatMap(([threadId, threadState]) => {
          const threadLabel =
            threadId === TEAM_MANAGER_THREAD_ID
              ? `${teamLabel} Sub-Manager`
              : workspaceMembers.find((worker) => worker.id === threadId)?.label ?? threadId;
          const threadTarget =
            threadId === TEAM_MANAGER_THREAD_ID
              ? workspaceTarget
              : {
                  ...workspaceTarget,
                  nodeId: threadId,
                  nodeType:
                    workspaceMembers.find((worker) => worker.id === threadId)?.type ?? rootNode.type,
                  focusNodeId: threadId,
                };

          return threadState.versions.map((version) => ({
            id: `team:${workspaceRootId}:${threadId}:${version.id}`,
            source: 'team' as const,
            accentColor: workspaceTarget.color,
            workspaceLabel: teamLabel,
            threadLabel,
            threadId,
            teamId: workspaceRootId,
            workspaceTarget: threadTarget,
            version,
          }));
        });
      },
    );

    return [...mainCheckpoints, ...teamCheckpoints].sort(
      (left, right) =>
        new Date(right.version.savedAt).getTime() - new Date(left.version.savedAt).getTime(),
    );
  }, [secondaryWorkspaceStore, state.workspaceVersions, teamsState.teamsGraph]);

  const filteredCheckpoints = useMemo(
    () =>
      checkpoints.filter((checkpoint) => {
        const workspaceMatches =
          workspaceFilter === 'all' || checkpoint.source === workspaceFilter;
        const lockMatches =
          lockFilter === 'all' ||
          (lockFilter === 'locked' ? checkpoint.version.locked : !checkpoint.version.locked);

        return workspaceMatches && lockMatches;
      }),
    [checkpoints, lockFilter, workspaceFilter],
  );

  useEffect(() => {
    if (state.selectedWorkspaceVersion || !versionTargetFromLocation) {
      return;
    }

    dispatch({
      type: 'OPEN_WORKSPACE_VERSION_DETAIL',
      target: versionTargetFromLocation,
    });
  }, [dispatch, state.selectedWorkspaceVersion, versionTargetFromLocation]);

  useEffect(() => {
    const syncStore = () => {
      setSecondaryWorkspaceStore(getSecondaryWorkspaceStore());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== SECONDARY_WORKSPACE_STORAGE_KEY) {
        return;
      }

      syncStore();
    };

    window.addEventListener('focus', syncStore);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('focus', syncStore);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const detailCheckpoint = useMemo(
    () =>
      checkpoints.find((checkpoint) =>
        matchesSelectedVersion(
          checkpoint,
          state.selectedWorkspaceVersion ?? versionTargetFromLocation,
        ),
      ) ?? null,
    [checkpoints, state.selectedWorkspaceVersion, versionTargetFromLocation],
  );

  const handleResumeWork = (checkpoint: CheckpointRecord) => {
    const resumeDraft = buildResumeDraft(checkpoint);
    const relatedCheckpoint =
      state.savedObjects.find(
        (savedObject) =>
          savedObject.objectType === 'checkpoint' &&
          savedObject.payload.legacyVersionId === checkpoint.version.id,
      ) ?? null;

    dispatch({
      type: 'ADD_ACTIVITY_EVENT',
      event: {
        id: `activity_${Date.now()}`,
        eventType: 'resume',
        createdAt: new Date().toISOString(),
        actor: state.userName,
        sourceWorkspace:
          checkpoint.source === 'main' ? 'main-workspace' : 'team-workspace',
        sourceTeamId: checkpoint.source === 'team' ? checkpoint.teamId ?? null : 'global',
        sourceTeamLabel: checkpoint.workspaceLabel,
        sourcePanelId: checkpoint.threadId,
        sourcePanelLabel: checkpoint.threadLabel,
        projectId: relatedCheckpoint?.projectId ?? state.projects[0]?.id ?? null,
        relatedObjectId: relatedCheckpoint?.id ?? null,
        detail: `Resume Work opened from ${checkpoint.threadLabel}`,
        metadata: {
          versionNumber: checkpoint.version.versionNumber,
          workspace: checkpoint.workspaceLabel,
        },
      },
    });

    if (checkpoint.source === 'main' && checkpoint.agent) {
      dispatch({
        type: 'SET_DRAFT',
        agent: checkpoint.agent,
        value: resumeDraft,
        panelScope: checkpoint.panelScope,
      });
      if ((checkpoint.page ?? 'A') === 'A') {
        dispatch({ type: 'SET_WORKSPACE_FOCUS', agent: checkpoint.agent });
      }
      dispatch({ type: 'SET_PAGE', page: checkpoint.page ?? 'A' });
      return;
    }

    if (checkpoint.source === 'team' && checkpoint.teamId && checkpoint.workspaceTarget) {
      setWorkspaceThreadDraft(checkpoint.teamId, checkpoint.threadId, resumeDraft);
      setSecondaryWorkspaceFocusThread(checkpoint.teamId, checkpoint.threadId);
      dispatch({
        type: 'SET_SECONDARY_WORKSPACE',
        workspace: checkpoint.workspaceTarget,
      });
      dispatch({ type: 'SET_PAGE', page: 'F' });
    }
  };

  const openCheckpointDetail = (checkpoint: CheckpointRecord) => {
    dispatch({
      type: 'OPEN_WORKSPACE_VERSION_DETAIL',
      target: buildVersionTarget(checkpoint),
    });
  };

  const openHistory = () => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.search = '';
      url.searchParams.set('page', 'H');
      window.history.replaceState({}, '', url.toString());
    }

    dispatch({ type: 'OPEN_WORKSPACE_VERSION_HISTORY' });
  };

  const backToAuditLog = () => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.search = '';
      url.searchParams.set('page', 'C');
      window.history.replaceState({}, '', url.toString());
    }

    dispatch({ type: 'SET_PAGE', page: 'C' });
  };

  if (state.selectedWorkspaceVersion || versionTargetFromLocation) {
    return (
      <div className="app-page-shell h-full min-h-0 min-w-0 overflow-hidden px-2 py-2 sm:px-3 sm:py-3">
        <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col gap-2">
          <div className="ui-surface shrink-0 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  Saved Chat Detail
                </div>
                <h1 className="mt-1 text-lg font-semibold text-neutral-900 sm:text-[22px]">
                  Open checkpoint and resume approved work
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-neutral-600">
                  This detail view is the operational bridge between Audit Log and resumable work.
                </p>
              </div>
              <button className="ui-button px-3 text-xs text-neutral-700" onClick={backToAuditLog}>
                Back to Audit Log
              </button>
            </div>
          </div>

          {!detailCheckpoint ? (
            <div className="ui-surface flex min-h-0 flex-1 items-center justify-center px-6 py-6">
              <div className="max-w-xl text-center">
                <div className="text-lg font-semibold text-neutral-900">Checkpoint not available</div>
                <p className="mt-2 text-sm text-neutral-600">
                  The selected version is no longer available in local state. Open the history view
                  to inspect the currently saved checkpoints.
                </p>
                <div className="mt-4 flex justify-center">
                  <button className="ui-button px-3 text-xs text-neutral-700" onClick={backToAuditLog}>
                    Back to Audit Log
                  </button>
                  <button className="ui-button ui-button-primary text-white" onClick={openHistory}>
                    View History
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="ui-surface flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 sm:px-5">
              <div className="ui-surface-subtle flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                    Ready to Resume
                  </div>
                  <div className="mt-1 text-sm text-neutral-700">
                    Resume Work opens the original workspace and loads this checkpoint into the
                    destination draft without destructive restore.
                  </div>
                  <div className="mt-2 text-[11px] text-neutral-500">
                    Route: Audit Log {'->'} Saved Chat Detail {'->'} View History {'->'} Resume Work
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="ui-button ui-button-primary px-4 text-sm text-white"
                    onClick={() => handleResumeWork(detailCheckpoint)}
                  >
                    Resume Work
                  </button>
                  <button className="ui-button px-3 text-xs text-neutral-700" onClick={openHistory}>
                    View History
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="ui-pill border-neutral-200 bg-white text-neutral-700">
                  Version {detailCheckpoint.version.versionNumber}
                </span>
                <span className="ui-pill border-neutral-200 bg-white text-neutral-700">
                  {detailCheckpoint.version.locked ? 'Locked' : 'Unlocked'}
                </span>
                <span className="ui-pill border-neutral-200 bg-white text-neutral-700">
                  {detailCheckpoint.version.messageCount} messages
                </span>
                {detailCheckpoint.version.label && (
                  <span className="ui-pill border-neutral-200 bg-white text-neutral-600">
                    {detailCheckpoint.version.label}
                  </span>
                )}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="ui-surface-subtle px-4 py-3 text-sm text-neutral-700">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                    Workspace
                  </div>
                  <div className="mt-1 font-medium text-neutral-900">
                    {detailCheckpoint.workspaceLabel}
                  </div>
                  <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                    Thread
                  </div>
                  <div className="mt-1">{detailCheckpoint.threadLabel}</div>
                </div>

                <div className="ui-surface-subtle px-4 py-3 text-sm text-neutral-700">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                    Saved
                  </div>
                  <div className="mt-1 font-medium text-neutral-900">
                    {formatSavedAt(detailCheckpoint.version.savedAt)}
                  </div>
                  <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                    Checkpoint Role
                  </div>
                  <div className="mt-1">
                    {detailCheckpoint.source === 'main'
                      ? 'Main Workspace checkpoint'
                      : 'Team Workspace checkpoint'}
                  </div>
                </div>
              </div>

              <div className="ui-surface-subtle mt-3 min-h-0 flex-1 overflow-hidden px-4 py-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  Snapshot Content
                </div>
                <div className="mt-3 h-full max-h-full overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-neutral-800">
                  {detailCheckpoint.version.snapshotContent || 'No snapshot content captured.'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app-page-shell h-full min-h-0 min-w-0 overflow-hidden px-2 py-2 sm:px-3 sm:py-3">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col gap-2">
        <div className="ui-surface shrink-0 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Version History
              </div>
              <h1 className="mt-1 text-lg font-semibold text-neutral-900 sm:text-[22px]">
                Full history of saved chat checkpoints
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-neutral-600">
                Use this page for the complete list. Audit Log remains the operational entry point
                for recent or relevant version events.
              </p>
            </div>
            <div className="ui-surface-subtle flex flex-wrap items-center gap-2 px-3 py-2 text-[11px] text-neutral-600">
              <span className="ui-pill border-neutral-200 bg-white text-neutral-700">
                {filteredCheckpoints.length} of {checkpoints.length} checkpoint
                {checkpoints.length === 1 ? '' : 's'}
              </span>
              <span>Open any row to inspect the checkpoint detail and resume from there.</span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-neutral-200 pt-3">
            <div className="min-w-[160px] flex-1">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                Workspace
              </div>
              <div className="ui-forward-select-wrap">
                <select
                  className="ui-forward-select"
                  value={workspaceFilter}
                  onChange={(event) =>
                    setWorkspaceFilter(event.target.value as 'all' | 'main' | 'team')
                  }
                >
                  <option value="all">All Workspaces</option>
                  <option value="main">Main Workspace</option>
                  <option value="team">Team Workspaces</option>
                </select>
                <span className="ui-forward-select-caret">v</span>
              </div>
            </div>

            <div className="min-w-[160px] flex-1">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                Lock State
              </div>
              <div className="ui-forward-select-wrap">
                <select
                  className="ui-forward-select"
                  value={lockFilter}
                  onChange={(event) =>
                    setLockFilter(event.target.value as 'all' | 'locked' | 'unlocked')
                  }
                >
                  <option value="all">All Checkpoints</option>
                  <option value="locked">Locked Only</option>
                  <option value="unlocked">Unlocked Only</option>
                </select>
                <span className="ui-forward-select-caret">v</span>
              </div>
            </div>
          </div>
        </div>

        <div className="ui-surface min-h-0 flex-1 overflow-hidden">
          <div className="border-b border-neutral-200 px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Historical Savings
            </div>
            <div className="mt-1 text-sm font-medium text-neutral-900">
              Full checkpoint list
            </div>
          </div>

          <div className="max-h-full overflow-y-auto px-3 py-3">
            {filteredCheckpoints.length === 0 ? (
              <div className="ui-surface-subtle px-4 py-4 text-sm text-neutral-600">
                No checkpoints match the current filter. Adjust the filter panel or save a new
                version from a workspace panel.
              </div>
            ) : (
              <div className="grid gap-2">
                {filteredCheckpoints.map((checkpoint) => (
                  <div
                    key={checkpoint.id}
                    className="ui-surface-subtle flex flex-wrap items-center justify-between gap-3 rounded-[14px] px-4 py-3"
                    style={{ borderLeft: `4px solid ${checkpoint.accentColor}` }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="ui-role-dot"
                          style={{ backgroundColor: checkpoint.accentColor }}
                        />
                        <span className="text-sm font-semibold text-neutral-900">
                          Version {checkpoint.version.versionNumber}
                        </span>
                        <span className="ui-pill border-neutral-200 bg-white text-neutral-700">
                          {checkpoint.version.locked ? 'Locked' : 'Unlocked'}
                        </span>
                        {checkpoint.version.label && (
                          <span className="ui-pill border-neutral-200 bg-white text-neutral-600">
                            {checkpoint.version.label}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-neutral-500">
                        {checkpoint.workspaceLabel} | {checkpoint.threadLabel}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
                        <span>Saved {formatSavedAt(checkpoint.version.savedAt)}</span>
                        <span>{checkpoint.version.messageCount} messages</span>
                      </div>
                    </div>

                    <button
                      className="ui-button min-h-8 px-3 text-[11px] text-neutral-700"
                      onClick={() => openCheckpointDetail(checkpoint)}
                    >
                      Open
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
