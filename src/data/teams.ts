import type {
  AIProvider,
  FileType,
  SecondaryWorkspaceTarget,
  TeamFolderItem,
  TeamsGraphNode,
} from '../types';

export interface TeamsMapState {
  teamsGraph: TeamsGraphNode[];
  foldersByTeam: Record<string, TeamFolderItem[]>;
}

interface TeamTheme {
  ribbon: string;
  soft: string;
  border: string;
  accent: string;
}

export const TEAMS_STORAGE_KEY = 'aisync_teams_map_v2';
export const PROVIDERS: AIProvider[] = ['OpenAI', 'Anthropic', 'Google'];

const DYNAMIC_TEAM_THEMES: TeamTheme[] = [
  {
    ribbon: '#7c3aed',
    soft: 'rgba(124, 58, 237, 0.08)',
    border: 'rgba(124, 58, 237, 0.2)',
    accent: '#6d28d9',
  },
  {
    ribbon: '#c2410c',
    soft: 'rgba(194, 65, 12, 0.08)',
    border: 'rgba(194, 65, 12, 0.2)',
    accent: '#9a3412',
  },
  {
    ribbon: '#15803d',
    soft: 'rgba(21, 128, 61, 0.08)',
    border: 'rgba(21, 128, 61, 0.2)',
    accent: '#166534',
  },
];

export function getProviderDisplayName(provider: AIProvider) {
  return provider === 'Google' ? 'Gemini' : provider;
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

export function getTeamCode(teamId: string) {
  if (teamId === 'team_legal') return 'LC';
  if (teamId === 'team_marketing') return 'MK';
  if (teamId === 'team_clients') return 'CL';
  if (teamId.startsWith('team_dynamic_')) {
    return `T${teamId.split('_').pop() ?? '00'}`;
  }
  return 'TM';
}

export function createWorkerLabel(teamId: string, index: number) {
  return `W-${getTeamCode(teamId)}${String(index).padStart(2, '0')}`;
}

export function buildFolderSeed(teamId: string, teamLabel: string): TeamFolderItem[] {
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

export function createSeedTeamsMapState(): TeamsMapState {
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

export function normalizeTeamsMapState(input: TeamsMapState): TeamsMapState {
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

export function getInitialTeamsMapState(): TeamsMapState {
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

export function saveTeamsMapState(state: TeamsMapState) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(state));
}

export function countArtifacts(
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

export function getRoleLabel(type: TeamsGraphNode['type']) {
  if (type === 'general_manager') return 'General Manager';
  if (type === 'senior_manager') return 'Senior Manager';
  return 'Worker';
}

export function getTeamTheme(teamId: string): TeamTheme {
  if (teamId === 'team_legal') {
    return {
      ribbon: '#8f1d1d',
      soft: 'rgba(143, 29, 29, 0.08)',
      border: 'rgba(143, 29, 29, 0.2)',
      accent: '#7f1d1d',
    };
  }

  if (teamId === 'team_marketing') {
    return {
      ribbon: '#1d4ed8',
      soft: 'rgba(29, 78, 216, 0.08)',
      border: 'rgba(29, 78, 216, 0.2)',
      accent: '#1d4ed8',
    };
  }

  if (teamId === 'team_clients') {
    return {
      ribbon: '#0f766e',
      soft: 'rgba(15, 118, 110, 0.08)',
      border: 'rgba(15, 118, 110, 0.2)',
      accent: '#0f766e',
    };
  }

  const dynamicIndex = Number(teamId.split('_').pop() ?? '0') % DYNAMIC_TEAM_THEMES.length;
  return DYNAMIC_TEAM_THEMES[dynamicIndex] ?? DYNAMIC_TEAM_THEMES[0];
}

export function getTopLevelUnits(teamsGraph: TeamsGraphNode[]) {
  const orderIndex = (node: TeamsGraphNode) => {
    if (node.teamId === 'team_legal') return 0;
    if (node.teamId === 'team_marketing') return 1;
    if (node.teamId === 'team_clients') return 2;
    return 3;
  };

  return [...teamsGraph]
    .filter((node) => node.parentId === 'gm_1')
    .sort((left, right) => {
      const leftOrder = orderIndex(left);
      const rightOrder = orderIndex(right);

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.label.localeCompare(right.label);
    });
}

export function getWorkersByTeam(teamsGraph: TeamsGraphNode[]) {
  const workers = teamsGraph.filter((node) => node.type === 'worker');
  return workers.reduce<Record<string, TeamsGraphNode[]>>((accumulator, worker) => {
    accumulator[worker.teamId] = [...(accumulator[worker.teamId] ?? []), worker].sort((left, right) =>
      left.label.localeCompare(right.label),
    );
    return accumulator;
  }, {});
}

export function getWorkspaceAgentForTeam(teamId: string, teamsGraph: TeamsGraphNode[]) {
  const topLevelUnits = getTopLevelUnits(teamsGraph);
  const order = ['worker1', 'worker2', 'manager'] as const;
  const index = topLevelUnits.findIndex((node) => node.teamId === teamId);
  if (index === -1) {
    return 'manager';
  }

  return order[index % order.length];
}

export function getSecondaryWorkspaceTarget(
  node: TeamsGraphNode,
): SecondaryWorkspaceTarget {
  return {
    teamId: node.teamId,
    label: node.label,
    color: getTeamTheme(node.teamId).ribbon,
  };
}
