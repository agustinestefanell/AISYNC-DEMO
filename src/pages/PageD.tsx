import { useEffect, useMemo, useState } from 'react';
import { AgentPanel } from '../components/AgentPanel';
import { FileViewer } from '../components/FileViewer';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { useApp } from '../context';
import type {
  AIProvider,
  AgentRole,
  FileType,
  SavedFile,
  TeamFolderItem,
  TeamsGraphNode,
} from '../types';

const TEAMS_STORAGE_KEY = 'aisync_teams_map_v1';
const PROVIDERS: AIProvider[] = ['OpenAI', 'Anthropic', 'Google'];
const CHAT_AGENT_ORDER: AgentRole[] = ['worker1', 'worker2', 'manager'];

function getProviderDisplayName(provider: AIProvider) {
  return provider === 'Google' ? 'Gemini' : provider;
}

interface TeamsMapState {
  teamsGraph: TeamsGraphNode[];
  foldersByTeam: Record<string, TeamFolderItem[]>;
}

function createFile(
  id: string,
  name: string,
  fileType: FileType,
  content: string,
  createdAt: string,
): TeamFolderItem {
  return {
    id,
    name,
    type: 'file',
    fileType,
    content,
    createdAt,
  };
}

function createFolder(
  id: string,
  name: string,
  children: TeamFolderItem[],
): TeamFolderItem {
  return {
    id,
    name,
    type: 'folder',
    children,
  };
}

function getTeamCode(teamId: string) {
  if (teamId === 'team_legal') return 'LC';
  if (teamId === 'team_marketing') return 'MK';
  if (teamId === 'team_clients') return 'CL';
  if (teamId.startsWith('team_dynamic_')) {
    return `T${teamId.split('_').pop() ?? '00'}`;
  }
  return 'TM';
}

function createWorkerLabel(teamId: string, index: number) {
  return `W-${getTeamCode(teamId)}${String(index).padStart(2, '0')}`;
}

function buildFolderSeed(teamId: string, teamLabel: string): TeamFolderItem[] {
  const code = getTeamCode(teamId);
  const normalized = teamLabel.replace(/[^a-zA-Z0-9]+/g, '-');

  return [
    createFolder(`${teamId}_conversations`, 'Conversations', [
      createFile(
        `${teamId}_conv_1`,
        `2026-03-04_${normalized}_Session01.txt`,
        'Conversation',
        `${teamLabel} session 01.\n\nRouting summary, active tasks, and worker handoff notes.`,
        '2026-03-04T09:15:00.000Z',
      ),
      createFile(
        `${teamId}_conv_2`,
        `2026-03-05_${normalized}_Session02.txt`,
        'Conversation',
        `${teamLabel} session 02.\n\nFollow-up actions, open questions, and context inheritance details.`,
        '2026-03-05T11:10:00.000Z',
      ),
    ]),
    createFolder(`${teamId}_documents`, 'Documents', [
      createFolder(`${teamId}_documents_drafts`, 'Drafts', [
        createFile(
          `${teamId}_doc_1`,
          `${code}_Strategy-Draft.docx`,
          'Document',
          `${teamLabel} draft.\n\nOutline, workstreams, and interim deliverables for the current sprint.`,
          '2026-03-05T13:00:00.000Z',
        ),
      ]),
      createFolder(`${teamId}_documents_specs`, 'Specs', [
        createFile(
          `${teamId}_doc_2`,
          `${code}_Technical-Specs.docx`,
          'Document',
          `${teamLabel} technical specs.\n\nDependencies, sequencing, and review criteria.`,
          '2026-03-06T14:20:00.000Z',
        ),
      ]),
    ]),
    createFolder(`${teamId}_reports`, 'Reports', [
      createFile(
        `${teamId}_report_1`,
        `2026-03-06_Daily-Summary.md`,
        'Report',
        `${teamLabel} daily summary.\n\nCompleted work, blockers, and next operating window.`,
        '2026-03-06T16:40:00.000Z',
      ),
      createFolder(`${teamId}_reports_phase`, 'Phase Reports', [
        createFile(
          `${teamId}_report_2`,
          `${code}_Phase-01-Report.md`,
          'Report',
          `${teamLabel} phase report.\n\nMilestones reached, evidence attached, and decisions logged.`,
          '2026-03-07T10:25:00.000Z',
        ),
      ]),
    ]),
    createFolder(`${teamId}_logs`, 'Logs', [
      createFile(
        `${teamId}_log_1`,
        `${code}_Decision-Log.txt`,
        'Conversation',
        `${teamLabel} decision log.\n\nCompact operational trace of approvals and escalations.`,
        '2026-03-07T11:45:00.000Z',
      ),
    ]),
  ];
}

function createSeedTeamsMapState(): TeamsMapState {
  const teams = [
    {
      teamId: 'team_legal',
      label: 'SM-Legal',
      provider: 'Anthropic' as AIProvider,
      workers: ['W-LC01', 'W-LC02', 'W-LC03'],
    },
    {
      teamId: 'team_marketing',
      label: 'SM-Marketing',
      provider: 'OpenAI' as AIProvider,
      workers: ['W-MK01', 'W-MK02', 'W-MK03'],
    },
    {
      teamId: 'team_clients',
      label: 'W-Clients / Projects',
      provider: 'Google' as AIProvider,
      workers: ['W-Clients / Projects'],
    },
  ];

  const teamsGraph: TeamsGraphNode[] = [
    {
      id: 'gm_1',
      type: 'general_manager',
      label: 'AI General Manager',
      provider: 'OpenAI',
      parentId: null,
      teamId: 'global',
    },
  ];

  const foldersByTeam: Record<string, TeamFolderItem[]> = {};

  teams.forEach((team, teamIndex) => {
    if (team.teamId === 'team_clients') {
      teamsGraph.push({
        id: `${team.teamId}_worker_1`,
        type: 'worker',
        label: team.label,
        provider: team.provider,
        parentId: 'gm_1',
        teamId: team.teamId,
      });
    } else {
      teamsGraph.push({
        id: `${team.teamId}_sm`,
        type: 'senior_manager',
        label: team.label,
        provider: team.provider,
        parentId: 'gm_1',
        teamId: team.teamId,
      });

      team.workers.forEach((workerLabel, workerIndex) => {
        teamsGraph.push({
          id: `${team.teamId}_worker_${workerIndex + 1}`,
          type: 'worker',
          label: workerLabel,
          provider: PROVIDERS[(teamIndex + workerIndex) % PROVIDERS.length],
          parentId: `${team.teamId}_sm`,
          teamId: team.teamId,
        });
      });
    }

    foldersByTeam[team.teamId] = buildFolderSeed(team.teamId, team.label);
  });

  return { teamsGraph, foldersByTeam };
}

function normalizeTeamsMapState(input: TeamsMapState): TeamsMapState {
  const clientManager = input.teamsGraph.find(
    (node) => node.type === 'senior_manager' && node.teamId === 'team_clients',
  );
  const clientWorkers = input.teamsGraph
    .filter((node) => node.type === 'worker' && node.teamId === 'team_clients')
    .sort((left, right) => left.id.localeCompare(right.id));
  const remainingNodes = input.teamsGraph.filter((node) => node.teamId !== 'team_clients');
  const primaryWorker = clientWorkers[0];
  const clientWorker: TeamsGraphNode = primaryWorker
    ? {
        ...primaryWorker,
        label: 'W-Clients / Projects',
        parentId: 'gm_1',
        provider: primaryWorker.provider || clientManager?.provider || 'Google',
      }
    : {
        id: 'team_clients_worker_1',
        type: 'worker',
        label: 'W-Clients / Projects',
        provider: clientManager?.provider || 'Google',
        parentId: 'gm_1',
        teamId: 'team_clients',
      };

  return {
    teamsGraph: [...remainingNodes, clientWorker],
    foldersByTeam: {
      ...input.foldersByTeam,
      team_clients:
        input.foldersByTeam.team_clients ??
        buildFolderSeed('team_clients', 'W-Clients / Projects'),
    },
  };
}

function getInitialTeamsMapState(): TeamsMapState {
  if (typeof window === 'undefined') {
    return createSeedTeamsMapState();
  }

  try {
    const saved = window.localStorage.getItem(TEAMS_STORAGE_KEY);
    if (!saved) {
      return createSeedTeamsMapState();
    }
    return normalizeTeamsMapState(JSON.parse(saved) as TeamsMapState);
  } catch {
    return createSeedTeamsMapState();
  }
}

function countArtifacts(
  nodes: TeamFolderItem[],
): { conversations: number; documents: number; reports: number } {
  return nodes.reduce(
    (accumulator, node) => {
      if (node.type === 'file') {
        if (node.fileType === 'Conversation') accumulator.conversations += 1;
        if (node.fileType === 'Document') accumulator.documents += 1;
        if (node.fileType === 'Report') accumulator.reports += 1;
        return accumulator;
      }

      const nested = countArtifacts(node.children ?? []);
      return {
        conversations: accumulator.conversations + nested.conversations,
        documents: accumulator.documents + nested.documents,
        reports: accumulator.reports + nested.reports,
      };
    },
    { conversations: 0, documents: 0, reports: 0 },
  );
}

function getRoleLabel(type: TeamsGraphNode['type']) {
  if (type === 'general_manager') return 'General Manager';
  if (type === 'senior_manager') return 'Senior Manager';
  return 'Worker';
}

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
  compact,
  onOpenFile,
}: {
  items: TeamFolderItem[];
  compact?: boolean;
  onOpenFile?: (item: TeamFolderItem) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.filter((item) => item.type === 'folder').map((item) => [item.id, true])),
  );

  const renderItems = (nodes: TeamFolderItem[], depth = 0) => {
    const visibleNodes = compact
      ? nodes.slice(0, depth === 0 ? 3 : 2)
      : nodes;

    return visibleNodes.map((node) => {
      const isFolder = node.type === 'folder';
      const isOpen = compact ? true : expanded[node.id] ?? depth === 0;
      const canRenderChildren =
        isFolder &&
        (compact ? depth < 1 : isOpen) &&
        (node.children?.length ?? 0) > 0;

      return (
        <div key={node.id}>
          <button
            className={`flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left ${
              compact ? 'text-[10px]' : 'text-[11px]'
            } text-neutral-700 transition-colors hover:bg-neutral-50`}
            onClick={() => {
              if (isFolder && !compact) {
                setExpanded((current) => ({ ...current, [node.id]: !current[node.id] }));
                return;
              }

              if (!isFolder) {
                onOpenFile?.(node);
              }
            }}
          >
            {isFolder ? <Chevron open={isOpen} /> : <span className="inline-block w-3" />}
            {isFolder ? <FolderIcon /> : <FileIcon />}
            <span className="truncate">{node.name}</span>
          </button>

          {canRenderChildren && (
            <div className="ml-3 border-l border-neutral-200 pl-3">
              {renderItems(node.children ?? [], depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return <div className="grid gap-1">{renderItems(items)}</div>;
}

function OrgNodeCard({
  node,
  subtle,
  onClick,
}: {
  node: TeamsGraphNode;
  subtle?: boolean;
  onClick: () => void;
}) {
  const isGeneralManager = node.type === 'general_manager';
  const isSeniorManager = node.type === 'senior_manager';

  return (
    <button
      className={`w-full rounded-[12px] border px-3 py-3 text-left transition-colors hover:border-neutral-500 ${
        subtle
          ? 'border-neutral-200 bg-white shadow-[var(--shadow-soft)]'
          : isGeneralManager
            ? 'border-[rgba(17,17,17,0.12)] bg-[rgba(17,17,17,0.03)] shadow-[var(--shadow-soft)]'
          : isSeniorManager
            ? 'border-[rgba(0,122,255,0.12)] bg-[rgba(0,122,255,0.04)] shadow-[var(--shadow-soft)]'
            : 'border-neutral-300 bg-white shadow-[var(--shadow-soft)]'
      }`}
      onClick={onClick}
    >
      <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-400">
        {getRoleLabel(node.type)}
      </div>
      <div className="mt-1 text-sm font-semibold text-neutral-900">{node.label}</div>
      <div className="ui-pill mt-2 text-[10px]">
        {getProviderDisplayName(node.provider)}
      </div>
    </button>
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

  useEffect(() => {
    window.localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(teamsState));
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
  const topLevelUnits = useMemo(() => {
    const orderIndex = (node: TeamsGraphNode) => {
      if (node.teamId === 'team_legal') return 0;
      if (node.teamId === 'team_marketing') return 1;
      if (node.teamId === 'team_clients') return 2;
      return 3;
    };

    return [...teamsState.teamsGraph]
      .filter((node) => node.parentId === 'gm_1')
      .sort((left, right) => {
        const leftOrder = orderIndex(left);
        const rightOrder = orderIndex(right);

        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }

        return left.label.localeCompare(right.label);
      });
  }, [teamsState.teamsGraph]);
  const seniorManagers = useMemo(
    () => teamsState.teamsGraph.filter((node) => node.type === 'senior_manager'),
    [teamsState.teamsGraph],
  );
  const workersByTeam = useMemo(
    () =>
      Object.fromEntries(
        seniorManagers.map((manager) => [
          manager.teamId,
          teamsState.teamsGraph.filter(
            (node) => node.type === 'worker' && node.teamId === manager.teamId,
          ),
        ]),
      ) as Record<string, TeamsGraphNode[]>,
    [seniorManagers, teamsState.teamsGraph],
  );

  const totalWorkers = teamsState.teamsGraph.filter((node) => node.type === 'worker').length;

  const getWorkspaceAgentForTeam = (teamId: string): AgentRole => {
    const index = topLevelUnits.findIndex((node) => node.teamId === teamId);
    if (index === -1) {
      return 'manager';
    }
    return CHAT_AGENT_ORDER[index % CHAT_AGENT_ORDER.length];
  };

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
      agent: getWorkspaceAgentForTeam(teamId),
      title: item.name.replace(/\.[^.]+$/, ''),
      type: item.fileType ?? 'Document',
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

  return (
    <div className="app-page-shell h-full min-h-0 min-w-0 overflow-hidden px-3 py-3">
      <div className="app-frame mx-auto flex h-full min-h-0 w-full max-w-[1600px] overflow-hidden">
        <AgentPanel agent="manager" style={{ width: 360, flexShrink: 0 }} />

        <div className="ui-divider-rail flex w-4 shrink-0 items-start justify-center pt-4 text-[10px]">
          <div className="grid gap-1 text-center">
            <span>{'<'}</span>
            <span>{'>'}</span>
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--color-surface-soft)]">
          <div className="scrollbar-thin flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
            <section className="flex min-h-full flex-col gap-6 px-6 py-6">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h1 className="ui-title">
                  Operational Structure (Teams)
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-neutral-600">
                  AISync scales from one general manager into multiple senior managers and worker pods without changing the documentation backbone.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
                {PROVIDERS.map((provider) => (
                  <span
                    key={provider}
                    className="ui-pill"
                  >
                    {getProviderDisplayName(provider)}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className="ui-button ui-button-primary text-white"
                onClick={handleAddTeam}
              >
                + Add Team
              </button>
              <button
                className="ui-button text-neutral-700"
                onClick={handleScaleUp}
              >
                Scale Up
              </button>
              <button
                className="ui-button text-neutral-700"
                onClick={handleScaleDown}
              >
                Scale Down
              </button>
              <div className="ui-surface ml-auto px-3 py-2 text-xs text-neutral-600">
                Teams: {seniorManagers.length} | Workers: {totalWorkers}
              </div>
            </div>

            <div className="ui-surface flex-1 p-6">
              {generalManager && (
                <div className="flex flex-col items-center">
                  <div className="w-full max-w-[280px]">
                    <OrgNodeCard node={generalManager} onClick={() => setSelectedNodeId(generalManager.id)} />
                  </div>

                  <div className="mt-4 h-6 w-px bg-neutral-300" />
                  <div className="h-px w-[76%] bg-neutral-300" />

                  <div className="mt-4 grid w-full gap-6 xl:grid-cols-3">
                    {topLevelUnits.map((unit) => {
                      const topLevelCardWidthClass = 'w-full';
                      const teamWorkers =
                        unit.type === 'senior_manager' ? workersByTeam[unit.teamId] ?? [] : [];
                      const workerGridClass =
                        teamWorkers.length === 1
                          ? 'mx-auto grid w-full max-w-[220px] gap-3'
                          : 'grid w-full gap-3 md:grid-cols-3 xl:grid-cols-3';

                      return (
                        <div key={unit.id} className="ui-surface-subtle flex flex-col items-center p-4">
                          <div className="mb-3 h-5 w-px bg-neutral-300" />
                          <div className={topLevelCardWidthClass}>
                            <OrgNodeCard
                              node={unit}
                              subtle={unit.type === 'worker'}
                              onClick={() => setSelectedNodeId(unit.id)}
                            />
                          </div>

                          {unit.type === 'senior_manager' && (
                            <>
                              <div className="mt-4 h-5 w-px bg-neutral-300" />
                              <div className={workerGridClass}>
                                {teamWorkers.map((worker) => (
                                  <div key={worker.id} className="flex flex-col items-center">
                                    <div className="mb-2 h-4 w-px bg-neutral-300" />
                                    <OrgNodeCard
                                      node={worker}
                                      subtle
                                      onClick={() => setSelectedNodeId(worker.id)}
                                    />
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="ui-surface px-4 py-4">
              <div className="mb-4 text-sm font-semibold tracking-[0.16em] text-neutral-900">
                Documentation Structure (Outputs)
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                {topLevelUnits.map((unit) => {
                  const counts = countArtifacts(teamsState.foldersByTeam[unit.teamId] ?? []);
                  return (
                    <div key={unit.teamId} className="ui-surface-subtle p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-neutral-800">{unit.label}</div>
                        <div className="text-[10px] text-neutral-500">
                          C {counts.conversations} | D {counts.documents} | R {counts.reports}
                        </div>
                      </div>

                      <TeamTree items={teamsState.foldersByTeam[unit.teamId] ?? []} compact />
                    </div>
                  );
                })}
              </div>
            </div>
            </section>

            <section className="border-t border-neutral-200 bg-white px-6 py-6">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-neutral-900">Project Folders (Full)</h2>
                <p className="mt-1 text-sm text-neutral-600">
                  The full tree reveals the depth of each team&apos;s operational outputs using the same folder data shown in the mini strip above.
                </p>
              </div>

              <div className="grid gap-5 xl:grid-cols-3">
                {topLevelUnits.map((unit) => (
                  <div key={unit.teamId} className="ui-surface-subtle p-4">
                    <div className="mb-3 text-sm font-semibold text-neutral-900">{unit.label}</div>
                    <TeamTree
                      items={teamsState.foldersByTeam[unit.teamId] ?? []}
                      onOpenFile={(item) => openFolderFile(item, unit.teamId, unit.label)}
                    />
                  </div>
                ))}
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

            <div className="ui-surface-subtle px-3 py-2 text-xs text-neutral-600">
              Open Chat will highlight the{' '}
              <span className="font-medium text-neutral-900">
                {selectedNode.type === 'general_manager'
                  ? 'Manager'
                  : getWorkspaceAgentForTeam(selectedNode.teamId) === 'worker1'
                    ? 'Worker 1'
                    : getWorkspaceAgentForTeam(selectedNode.teamId) === 'worker2'
                      ? 'Worker 2'
                      : 'Manager'}
              </span>{' '}
              panel in Main Workspace.
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className="ui-button ui-button-primary text-white"
                onClick={() => {
                  dispatch({
                    type: 'SET_WORKSPACE_FOCUS',
                    agent:
                      selectedNode.type === 'general_manager'
                        ? 'manager'
                        : getWorkspaceAgentForTeam(selectedNode.teamId),
                  });
                  dispatch({ type: 'SET_PAGE', page: 'A' });
                  setSelectedNodeId(null);
                }}
              >
                Open Chat
              </button>
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
              <button
                className="ui-button ml-auto text-neutral-700"
                onClick={handleSaveNode}
              >
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
