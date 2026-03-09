import { useEffect, useMemo, useState } from 'react';
import { AgentPanel } from '../components/AgentPanel';
import { DividerRail } from '../components/DividerRail';
import { FileViewer } from '../components/FileViewer';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { useApp } from '../context';
import {
  PROVIDERS,
  buildFolderSeed,
  countArtifacts,
  createWorkerLabel,
  getInitialTeamsMapState,
  getProviderDisplayName,
  getRoleLabel,
  getSecondaryWorkspaceTarget,
  getTeamTheme,
  getTopLevelUnits,
  getWorkersByTeam,
  getWorkspaceAgentForTeam,
  saveTeamsMapState,
  type TeamsMapState,
} from '../data/teams';
import type { AIProvider, FileType, SavedFile, TeamFolderItem, TeamsGraphNode } from '../types';
import { SECONDARY_MANAGER_PANEL_WIDTH } from '../layout';

type TeamsViewMode = 'map' | 'tree';

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3 w-3 transition-transform ${open ? 'rotate-90' : ''}`}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M4 2.5L8 6L4 9.5" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-amber-500" viewBox="0 0 16 16" fill="currentColor">
      <path d="M1.5 3.25h4l1 1.25h8v7.75H1.5z" />
      <path d="M1.5 4.5h13v-1H6.9L5.9 2.25H1.5z" className="opacity-70" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-neutral-500" viewBox="0 0 16 16" fill="currentColor">
      <path d="M3 1.5h6.5L13 5v9.5H3z" />
      <path d="M9.5 1.5V5H13" className="opacity-50" />
    </svg>
  );
}

function TeamTree({
  items,
  onOpenFile,
}: {
  items: TeamFolderItem[];
  onOpenFile?: (item: TeamFolderItem) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.filter((item) => item.type === 'folder').map((item) => [item.id, true])),
  );

  const renderItems = (nodes: TeamFolderItem[], depth = 0) =>
    nodes.map((node) => {
      const isFolder = node.type === 'folder';
      const isOpen = expanded[node.id] ?? depth === 0;

      return (
        <div key={node.id}>
          <button
            className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] text-neutral-700 transition-colors hover:bg-neutral-50"
            style={{ paddingLeft: `${depth * 14 + 4}px` }}
            onClick={() => {
              if (isFolder) {
                setExpanded((current) => ({ ...current, [node.id]: !current[node.id] }));
                return;
              }

              onOpenFile?.(node);
            }}
          >
            {isFolder ? <Chevron open={isOpen} /> : <span className="inline-block w-3" />}
            {isFolder ? <FolderIcon /> : <FileIcon />}
            <span className="truncate">{node.name}</span>
          </button>

          {isFolder && isOpen && node.children && (
            <div className="border-l border-neutral-200 pl-2">
              {renderItems(node.children, depth + 1)}
            </div>
          )}
        </div>
      );
    });

  return <div className="grid gap-1">{renderItems(items)}</div>;
}

function TeamCard({
  node,
  workers,
  counts,
  onEdit,
  onOpenWorkspace,
}: {
  node: TeamsGraphNode;
  workers: TeamsGraphNode[];
  counts: ReturnType<typeof countArtifacts>;
  onEdit: () => void;
  onOpenWorkspace: () => void;
}) {
  const theme = getTeamTheme(node.teamId);

  return (
    <div
      className="rounded-[16px] border p-4 shadow-[var(--shadow-soft)]"
      style={{ borderColor: theme.border, backgroundColor: theme.soft }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: theme.accent }}>
            {node.type === 'senior_manager' ? 'Operational Team' : 'Direct Team'}
          </div>
          <div className="mt-1 text-lg font-semibold text-neutral-900">{node.label}</div>
        </div>
        <span className="ui-pill border-transparent text-white" style={{ backgroundColor: theme.ribbon }}>
          {getProviderDisplayName(node.provider)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="ui-pill" style={{ borderColor: theme.border, color: theme.accent }}>
          Workers | {workers.length}
        </span>
        <span className="ui-pill" style={{ borderColor: theme.border, color: theme.accent }}>
          Color | {theme.ribbon}
        </span>
      </div>

      <div className="mt-4 grid gap-2 text-[11px] text-neutral-600 md:grid-cols-3">
        <div className="ui-surface-subtle px-3 py-2">
          Conversations
          <div className="mt-1 text-lg font-semibold text-neutral-900">{counts.conversations}</div>
        </div>
        <div className="ui-surface-subtle px-3 py-2">
          Documents
          <div className="mt-1 text-lg font-semibold text-neutral-900">{counts.documents}</div>
        </div>
        <div className="ui-surface-subtle px-3 py-2">
          Reports
          <div className="mt-1 text-lg font-semibold text-neutral-900">{counts.reports}</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
          Team Workers
        </div>
        <div className="flex flex-wrap gap-2">
          {workers.map((worker) => (
            <button
              key={worker.id}
              className="ui-pill border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
              onClick={onEdit}
            >
              {worker.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          className="ui-button ui-button-primary text-white"
          style={{ backgroundColor: theme.ribbon, borderColor: theme.ribbon }}
          onClick={onOpenWorkspace}
        >
          Go to Workspace
        </button>
        <button className="ui-button text-neutral-700" onClick={onEdit}>
          Edit Team
        </button>
      </div>
    </div>
  );
}

function TreeWorkspaceCard({
  title,
  subtitle,
  ribbonColor,
  borderColor,
  accentColor,
  chips,
  compact,
  outlineOnly,
  actionLabel,
  onClick,
}: {
  title: string;
  subtitle: string;
  ribbonColor: string;
  borderColor: string;
  accentColor: string;
  chips: string[];
  compact?: boolean;
  outlineOnly?: boolean;
  actionLabel: string;
  onClick: () => void;
}) {
  const shellBackground = outlineOnly ? '#ffffff' : ribbonColor;
  const shellColor = outlineOnly ? accentColor : '#ffffff';

  return (
    <button
      className={`w-full overflow-hidden rounded-[16px] border text-left shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-[1px] ${
        compact ? 'max-w-[180px]' : ''
      }`}
      style={{ borderColor: outlineOnly ? accentColor : borderColor, backgroundColor: '#ffffff' }}
      onClick={onClick}
    >
      <div
        className="px-3 py-2"
        style={{
          backgroundColor: shellBackground,
          color: shellColor,
          borderBottom: outlineOnly ? `1px solid ${borderColor}` : undefined,
        }}
      >
        <div className="text-[9px] uppercase tracking-[0.18em] opacity-75">{subtitle}</div>
        <div className={`mt-1 font-semibold ${compact ? 'text-[11px]' : 'text-[12px]'}`}>{title}</div>
      </div>

      <div className={`grid gap-2 px-3 py-3 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
        <div className="flex flex-wrap gap-1">
          {chips.slice(0, compact ? 2 : 3).map((chip) => (
            <span
              key={`${title}_${chip}`}
              className="rounded-full border px-2 py-0.5"
              style={{ borderColor, color: accentColor, backgroundColor: '#ffffff' }}
            >
              {chip}
            </span>
          ))}
        </div>

        <div className="grid gap-1">
          <div className="h-2.5 rounded-full bg-neutral-100" />
          <div className="h-2.5 rounded-full bg-neutral-100" />
          {!compact && <div className="h-2.5 w-[72%] rounded-full bg-neutral-100" />}
        </div>

        <div className="flex gap-1">
          <span
            className="rounded-md px-2 py-1 text-[9px] font-medium text-white"
            style={{ backgroundColor: ribbonColor }}
          >
            {actionLabel}
          </span>
          <span className="rounded-md border border-neutral-200 px-2 py-1 text-[9px] text-neutral-600">
            Edit
          </span>
        </div>
      </div>
    </button>
  );
}

function TreeStructureView({
  projectName,
  generalManager,
  topLevelUnits,
  workersByTeam,
  onOpenMainWorkspace,
  onOpenWorkspace,
  onEdit,
}: {
  projectName: string;
  generalManager: TeamsGraphNode;
  topLevelUnits: TeamsGraphNode[];
  workersByTeam: Record<string, TeamsGraphNode[]>;
  onOpenMainWorkspace: () => void;
  onOpenWorkspace: (node: TeamsGraphNode) => void;
  onEdit: (nodeId: string) => void;
}) {
  return (
    <div className="ui-surface p-5">
      <div className="mb-5 grid gap-3 md:grid-cols-2">
        <div className="ui-surface-subtle px-4 py-3 text-sm text-neutral-700">
          Tree View is the structural reference for context recovery. It shows how the main project,
          the Main Workspace, and each sub-team connect when focused execution starts to fragment
          the big picture.
        </div>
        <div className="ui-surface-subtle px-4 py-3 text-sm text-neutral-700">
          This tree is organizational only. Documentation trees remain below as a separate file
          structure, so hierarchy and stored outputs never get conflated.
        </div>
      </div>

      <div className="flex flex-col items-center">
        <div className="rounded-[18px] border border-neutral-200 bg-white px-6 py-4 text-center shadow-[var(--shadow-soft)]">
          <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Main Project</div>
          <div className="mt-1 text-lg font-semibold text-neutral-900">{projectName}</div>
        </div>

        <div className="h-8 w-px bg-neutral-900/70" />

        <div className="w-full max-w-[760px] rounded-[20px] border border-[rgba(17,17,17,0.12)] bg-white shadow-[var(--shadow-soft)]">
          <div className="rounded-t-[20px] bg-neutral-950 px-5 py-3 text-white">
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/60">Main Workspace</div>
            <div className="mt-1 text-base font-semibold">{generalManager.label}</div>
          </div>

          <div className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(180px,1.15fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-[16px] border border-neutral-200 bg-[rgba(17,17,17,0.03)] px-4 py-4">
              <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Manager Node</div>
              <div className="mt-2 text-sm font-semibold text-neutral-900">{generalManager.label}</div>
              <div className="mt-2 text-[11px] text-neutral-500">{getProviderDisplayName(generalManager.provider)}</div>
            </div>
            {['Worker 1', 'Worker 2'].map((label) => (
              <div key={label} className="rounded-[16px] border border-neutral-200 bg-[var(--color-surface-soft)] px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Core Team</div>
                <div className="mt-2 text-sm font-semibold text-neutral-900">{label}</div>
                <div className="mt-2 text-[11px] text-neutral-500">Main Workspace chatbox</div>
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-2 border-t border-neutral-200 px-4 py-4">
            <button className="ui-button ui-button-primary text-white" onClick={onOpenMainWorkspace}>
              Go to Main Workspace
            </button>
            <button className="ui-button text-neutral-700" onClick={() => onEdit(generalManager.id)}>
              Edit
            </button>
          </div>
        </div>

        <div className="mt-6 h-8 w-px bg-neutral-900/70" />

        <div className="relative w-full pt-8">
          <div className="absolute left-1/2 top-0 h-8 w-px -translate-x-1/2 bg-neutral-900/70" />
          <div className="absolute left-[10%] right-[10%] top-8 h-px bg-neutral-900/70" />

          <div className="grid gap-6 pt-6 xl:grid-cols-3">
            {topLevelUnits.map((unit) => {
              const theme = getTeamTheme(unit.teamId);
              const workers = workersByTeam[unit.teamId] ?? [];
              const isDirectUnit = unit.type === 'worker';

              return (
                <div key={unit.id} className="relative flex flex-col items-center">
                  <div className="absolute top-0 h-6 w-px bg-neutral-900/70" />

                  <div className="w-full pt-6">
                    <div className="flex flex-col items-center">
                      <TreeWorkspaceCard
                        title={unit.label}
                        subtitle={
                          unit.type === 'senior_manager'
                            ? 'Sub-Team Workspace'
                            : 'Direct Team Workspace'
                        }
                        ribbonColor={theme.ribbon}
                        borderColor={theme.border}
                        accentColor={theme.accent}
                        chips={[
                          getProviderDisplayName(unit.provider),
                          `${workers.length} workers`,
                          isDirectUnit ? 'Direct' : 'Lead',
                        ]}
                        outlineOnly={isDirectUnit}
                        actionLabel="Open"
                        onClick={() => onOpenWorkspace(unit)}
                      />

                      {workers.length > 0 && !isDirectUnit && (
                        <>
                          <div className="h-5 w-px bg-neutral-900/70" />
                          <div className="relative w-full px-5 pt-3">
                            <div className="absolute left-[18%] right-[18%] top-0 h-px bg-neutral-900/70" />
                            <div
                              className="grid gap-3 pt-3"
                              style={{
                                gridTemplateColumns: `repeat(${Math.min(workers.length, 3)}, minmax(0, 1fr))`,
                              }}
                            >
                              {workers.map((worker) => (
                                <div key={worker.id} className="flex flex-col items-center">
                                  <div className="h-3 w-px bg-neutral-900/70" />
                                  <TreeWorkspaceCard
                                    title={worker.label}
                                    subtitle="Worker"
                                    ribbonColor={theme.ribbon}
                                    borderColor={theme.border}
                                    accentColor={theme.accent}
                                    chips={[getProviderDisplayName(worker.provider), 'Worker']}
                                    compact
                                    actionLabel="Open"
                                    onClick={() => onEdit(worker.id)}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PageD() {
  const { state, dispatch } = useApp();
  const [teamsState, setTeamsState] = useState<TeamsMapState>(getInitialTeamsMapState);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftProvider, setDraftProvider] = useState<AIProvider>('OpenAI');
  const [viewerState, setViewerState] = useState<{ file: SavedFile; projectName: string } | null>(
    null,
  );
  const [toast, setToast] = useState('');
  const [viewMode, setViewMode] = useState<TeamsViewMode>('map');

  useEffect(() => {
    saveTeamsMapState(teamsState);
  }, [teamsState]);

  const selectedNode =
    teamsState.teamsGraph.find((node) => node.id === selectedNodeId) ?? null;

  useEffect(() => {
    if (!selectedNode) {
      return;
    }
    setDraftLabel(selectedNode.label);
    setDraftProvider(selectedNode.provider);
  }, [selectedNode]);

  const generalManager = useMemo(
    () => teamsState.teamsGraph.find((node) => node.type === 'general_manager') ?? null,
    [teamsState.teamsGraph],
  );
  const topLevelUnits = useMemo(
    () => getTopLevelUnits(teamsState.teamsGraph),
    [teamsState.teamsGraph],
  );
  const seniorManagers = useMemo(
    () => teamsState.teamsGraph.filter((node) => node.type === 'senior_manager'),
    [teamsState.teamsGraph],
  );
  const workersByTeam = useMemo(
    () => getWorkersByTeam(teamsState.teamsGraph),
    [teamsState.teamsGraph],
  );
  const totalWorkers = teamsState.teamsGraph.filter((node) => node.type === 'worker').length;

  const openFolderFile = (item: TeamFolderItem, teamId: string, projectName: string) => {
    const linkedFile =
      item.linkedFileId
        ? state.savedFiles.find((file) => file.id === item.linkedFileId)
        : null;

    if (linkedFile) {
      setViewerState({ file: linkedFile, projectName });
      return;
    }

    const file: SavedFile = {
      id: item.id,
      projectId: teamId,
      agent: getWorkspaceAgentForTeam(teamId, teamsState.teamsGraph),
      title: item.name.replace(/\.[^.]+$/, ''),
      type: item.fileType ?? ('Document' as FileType),
      content: item.content ?? `${projectName}\n\nSeed file generated for the Teams Map demo.`,
      createdAt: item.createdAt ?? '2026-03-07T10:00:00.000Z',
    };

    setViewerState({ file, projectName });
  };

  const handleSaveNode = () => {
    if (!selectedNode) {
      return;
    }

    setTeamsState((current) => ({
      ...current,
      teamsGraph: current.teamsGraph.map((node) =>
        node.id === selectedNode.id
          ? { ...node, label: draftLabel.trim() || node.label, provider: draftProvider }
          : node,
      ),
    }));
    setToast('Node updated.');
  };

  const handleAddTeam = () => {
    const nextNumber = seniorManagers.length + 1;
    const suffix = String(nextNumber).padStart(2, '0');
    const teamId = `team_dynamic_${suffix}`;
    const managerId = `${teamId}_sm`;
    const label = `SM-Team ${suffix}`;

    const newNodes: TeamsGraphNode[] = [
      {
        id: managerId,
        type: 'senior_manager',
        label,
        provider: PROVIDERS[nextNumber % PROVIDERS.length],
        parentId: 'gm_1',
        teamId,
      },
      ...Array.from({ length: 3 }, (_, index) => ({
        id: `${teamId}_worker_${index + 1}`,
        type: 'worker' as const,
        label: createWorkerLabel(teamId, index + 1),
        provider: PROVIDERS[(nextNumber + index + 1) % PROVIDERS.length],
        parentId: managerId,
        teamId,
      })),
    ];

    setTeamsState((current) => ({
      teamsGraph: [...current.teamsGraph, ...newNodes],
      foldersByTeam: {
        ...current.foldersByTeam,
        [teamId]: buildFolderSeed(teamId, label),
      },
    }));
    setToast('New team added.');
  };

  const handleScaleUp = () => {
    const newWorkers: TeamsGraphNode[] = [];

    seniorManagers.forEach((manager, teamIndex) => {
      const workers = workersByTeam[manager.teamId] ?? [];
      if (workers.length >= 6) {
        return;
      }

      const nextIndex = workers.length + 1;
      newWorkers.push({
        id: `${manager.teamId}_worker_${nextIndex}`,
        type: 'worker',
        label: createWorkerLabel(manager.teamId, nextIndex),
        provider: PROVIDERS[(teamIndex + nextIndex) % PROVIDERS.length],
        parentId: manager.id,
        teamId: manager.teamId,
      });
    });

    if (newWorkers.length === 0) {
      setToast('Teams are already at the scale-up cap.');
      return;
    }

    setTeamsState((current) => ({
      ...current,
      teamsGraph: [...current.teamsGraph, ...newWorkers],
    }));
    setToast('Operational scale increased.');
  };

  const handleScaleDown = () => {
    const idsToRemove = new Set<string>();

    seniorManagers.forEach((manager) => {
      const workers = [...(workersByTeam[manager.teamId] ?? [])].sort((left, right) =>
        right.label.localeCompare(left.label),
      );
      if (workers.length <= 2) {
        return;
      }
      idsToRemove.add(workers[0].id);
    });

    if (idsToRemove.size === 0) {
      setToast('Teams are already at the minimum size.');
      return;
    }

    setTeamsState((current) => ({
      ...current,
      teamsGraph: current.teamsGraph.filter((node) => !idsToRemove.has(node.id)),
    }));
    setToast('Operational scale reduced.');
  };

  const openMainWorkspace = (focusAgent: TeamsGraphNode | null = null) => {
    dispatch({
      type: 'SET_WORKSPACE_FOCUS',
      agent:
        focusAgent?.type === 'general_manager'
          ? 'manager'
          : focusAgent
            ? getWorkspaceAgentForTeam(focusAgent.teamId, teamsState.teamsGraph)
            : 'manager',
    });
    dispatch({ type: 'SET_PAGE', page: 'A' });
  };

  const openTeamWorkspace = (node: TeamsGraphNode) => {
    dispatch({
      type: 'SET_SECONDARY_WORKSPACE',
      workspace: getSecondaryWorkspaceTarget(node),
    });
    dispatch({ type: 'SET_PAGE', page: 'F' });
  };

  return (
    <div className="app-page-shell h-full min-h-0 min-w-0 overflow-hidden px-3 py-3">
      <div className="app-frame mx-auto flex h-full min-h-0 w-full max-w-[1600px] overflow-hidden">
        <AgentPanel
          agent="manager"
          style={{ width: SECONDARY_MANAGER_PANEL_WIDTH, flexShrink: 0 }}
        />

        <DividerRail />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--color-surface-soft)]">
          <div className="scrollbar-thin flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
            <section className="flex min-h-full flex-col gap-6 px-6 py-6">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div>
                  <h1 className="ui-title">Teams Map</h1>
                  <p className="mt-2 max-w-3xl text-sm text-neutral-600">
                    Map View is for direct workspace access. Tree View is for structural orientation
                    and context recovery when execution detail starts to hide the overall system.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-full border border-neutral-200 bg-white p-1">
                    {(['map', 'tree'] as TeamsViewMode[]).map((mode) => (
                      <button
                        key={mode}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                          viewMode === mode
                            ? 'bg-neutral-900 text-white'
                            : 'text-neutral-600 hover:text-neutral-900'
                        }`}
                        onClick={() => setViewMode(mode)}
                      >
                        {mode === 'map' ? 'Map' : 'Tree'}
                      </button>
                    ))}
                  </div>

                  <div className="ui-surface px-3 py-2 text-xs text-neutral-600">
                    Teams: {seniorManagers.length} | Workers: {totalWorkers}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button className="ui-button ui-button-primary text-white" onClick={handleAddTeam}>
                  + Add Team
                </button>
                <button className="ui-button text-neutral-700" onClick={handleScaleUp}>
                  Scale Up
                </button>
                <button className="ui-button text-neutral-700" onClick={handleScaleDown}>
                  Scale Down
                </button>
              </div>

              {generalManager &&
                (viewMode === 'map' ? (
                  <div className="grid gap-6">
                    <div className="ui-surface p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                            Main Workspace Access
                          </div>
                          <div className="mt-1 text-xl font-semibold text-neutral-900">
                            {generalManager.label}
                          </div>
                          <div className="mt-2 text-sm text-neutral-600">
                            Main Workspace stays separate from team workspaces. Use the cards below
                            to jump directly into the right sub-team workspace.
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span className="ui-pill">{getProviderDisplayName(generalManager.provider)}</span>
                          <button
                            className="ui-button ui-button-primary text-white"
                            onClick={() => openMainWorkspace(generalManager)}
                          >
                            Go to Main Workspace
                          </button>
                          <button className="ui-button text-neutral-700" onClick={() => setSelectedNodeId(generalManager.id)}>
                            Edit
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-5 xl:grid-cols-3">
                      {topLevelUnits.map((unit) => (
                        <TeamCard
                          key={unit.id}
                          node={unit}
                          workers={workersByTeam[unit.teamId] ?? []}
                          counts={countArtifacts(teamsState.foldersByTeam[unit.teamId] ?? [])}
                          onEdit={() => setSelectedNodeId(unit.id)}
                          onOpenWorkspace={() => openTeamWorkspace(unit)}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <TreeStructureView
                    projectName={state.projectName}
                    generalManager={generalManager}
                    topLevelUnits={topLevelUnits}
                    workersByTeam={workersByTeam}
                    onOpenMainWorkspace={() => openMainWorkspace(generalManager)}
                    onOpenWorkspace={openTeamWorkspace}
                    onEdit={setSelectedNodeId}
                  />
                ))}

              <div className="ui-surface px-4 py-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold tracking-[0.16em] text-neutral-900">
                      Documentation Trees
                    </div>
                    <div className="mt-1 text-sm text-neutral-600">
                      File structure lives separately from the organizational tree above.
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  {topLevelUnits.map((unit) => {
                    const theme = getTeamTheme(unit.teamId);
                    const counts = countArtifacts(teamsState.foldersByTeam[unit.teamId] ?? []);

                    return (
                      <div key={unit.teamId} className="ui-surface-subtle p-3" style={{ borderColor: theme.border }}>
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold text-neutral-800">{unit.label}</div>
                            <div className="mt-1 text-[10px] uppercase tracking-[0.14em]" style={{ color: theme.accent }}>
                              {counts.conversations} conversations | {counts.documents} documents | {counts.reports} reports
                            </div>
                          </div>
                          <button
                            className="ui-button min-h-8 px-3 text-[11px] text-white"
                            style={{ backgroundColor: theme.ribbon, borderColor: theme.ribbon }}
                            onClick={() => openTeamWorkspace(unit)}
                          >
                            Go to Workspace
                          </button>
                        </div>

                        <TeamTree
                          items={teamsState.foldersByTeam[unit.teamId] ?? []}
                          onOpenFile={(item) => openFolderFile(item, unit.teamId, unit.label)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {selectedNode && (
        <Modal
          title={selectedNode.label}
          onClose={() => setSelectedNodeId(null)}
          width="max-w-xl"
        >
          <div className="grid gap-4">
            <div className="grid gap-1">
              <span className="ui-label">Name</span>
              <input
                className="ui-input text-xs"
                value={draftLabel}
                onChange={(event) => setDraftLabel(event.target.value)}
              />
            </div>

            <div className="grid gap-1">
              <span className="ui-label">Role type</span>
              <div className="ui-surface-subtle px-3 py-2 text-xs text-neutral-700">
                {getRoleLabel(selectedNode.type)}
              </div>
            </div>

            <div className="grid gap-1">
              <span className="ui-label">Provider</span>
              <div className="flex flex-wrap gap-2">
                {PROVIDERS.map((provider) => (
                  <button
                    key={provider}
                    className={`ui-button ${
                      draftProvider === provider
                        ? 'ui-button-primary text-white'
                        : 'text-neutral-700'
                    }`}
                    onClick={() => setDraftProvider(provider)}
                  >
                    {getProviderDisplayName(provider)}
                  </button>
                ))}
              </div>
            </div>

            {selectedNode.type !== 'general_manager' && (
              <div
                className="ui-surface-subtle px-3 py-2 text-xs"
                style={{
                  borderColor: getTeamTheme(selectedNode.teamId).border,
                  color: getTeamTheme(selectedNode.teamId).accent,
                }}
              >
                Secondary workspace color: {getTeamTheme(selectedNode.teamId).ribbon}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {selectedNode.type === 'general_manager' ? (
                <button
                  className="ui-button ui-button-primary text-white"
                  onClick={() => {
                    openMainWorkspace(selectedNode);
                    setSelectedNodeId(null);
                  }}
                >
                  Go to Main Workspace
                </button>
              ) : (
                <button
                  className="ui-button ui-button-primary text-white"
                  onClick={() => {
                    openTeamWorkspace(selectedNode);
                    setSelectedNodeId(null);
                  }}
                >
                  Go to Workspace
                </button>
              )}

              <button
                className="ui-button text-neutral-700"
                onClick={() => {
                  dispatch({ type: 'SET_PAGE', page: 'B' });
                  setSelectedNodeId(null);
                }}
              >
                Open Docs
              </button>
              <button
                className="ui-button text-neutral-700"
                onClick={() => {
                  dispatch({ type: 'SET_PAGE', page: 'C' });
                  setSelectedNodeId(null);
                }}
              >
                View Calendar
              </button>
              <button className="ui-button ml-auto text-neutral-700" onClick={handleSaveNode}>
                Save changes
              </button>
            </div>
          </div>
        </Modal>
      )}

      {viewerState && (
        <FileViewer
          file={viewerState.file}
          projectName={viewerState.projectName}
          onClose={() => setViewerState(null)}
        />
      )}

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}
