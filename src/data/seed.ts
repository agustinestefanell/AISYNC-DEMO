import type { AgentRole, CalendarEvent, Message, Project, SavedFile, WorkPhaseState } from '../types';
import { CROSS_VERIFICATION_TEAM_ID } from './teams';

export const seedProjects: Project[] = [
  { id: 'proj1', name: 'Project 1' },
  { id: 'proj2', name: 'Project 2' },
];

export const seedMessages: Record<'manager' | 'worker1' | 'worker2', Message[]> = {
  manager: [
    {
      id: 'mgr_1',
      role: 'user',
      senderLabel: 'User',
      content: 'Set up a simple repository structure for a consulting engagement.',
      timestamp: '09:12',
      agent: 'manager',
    },
    {
      id: 'mgr_2',
      role: 'agent',
      senderLabel: 'Gemini',
      content:
        'Recommended baseline: 00_Admin, 01_Client_Input, 02_Working_Sessions, 03_Analysis, 04_Deliverables, 05_Archive.',
      timestamp: '09:13',
      agent: 'manager',
    },
    {
      id: 'mgr_3',
      role: 'user',
      senderLabel: 'User',
      content: 'Add a dedicated folder for stakeholder material and meeting notes.',
      timestamp: '09:14',
      agent: 'manager',
    },
    {
      id: 'mgr_4',
      role: 'agent',
      senderLabel: 'Gemini',
      content:
        'Added 02_Stakeholders with subfolders for interviews, meeting notes, and action logs. That keeps qualitative inputs separate from analysis outputs.',
      timestamp: '09:15',
      agent: 'manager',
    },
    {
      id: 'mgr_5',
      role: 'user',
      senderLabel: 'User',
      content: 'Prepare a short brief so I can forward it to Worker 1 and Worker 2.',
      timestamp: '09:16',
      agent: 'manager',
    },
    {
      id: 'mgr_6',
      role: 'agent',
      senderLabel: 'Gemini',
      content:
        'Brief ready: Worker 1 validates structure and naming discipline. Worker 2 turns it into reusable documentation guidance for future projects.',
      timestamp: '09:17',
      agent: 'manager',
    },
  ],
  worker1: [
    {
      id: 'w1_1',
      role: 'user',
      senderLabel: 'User',
      content: 'Check whether the structural calculation summary is internally consistent.',
      timestamp: '09:20',
      agent: 'worker1',
    },
    {
      id: 'w1_2',
      role: 'agent',
      senderLabel: 'Claude',
      content:
        'Beam check passes with comfortable margin. Column sizing is conservative. Foundation plate stress remains below the assumed soil capacity.',
      timestamp: '09:21',
      agent: 'worker1',
    },
    {
      id: 'w1_3',
      role: 'user',
      senderLabel: 'User',
      content: 'Call out the riskiest assumption in one line.',
      timestamp: '09:22',
      agent: 'worker1',
    },
    {
      id: 'w1_4',
      role: 'agent',
      senderLabel: 'Claude',
      content:
        'The only assumption worth flagging is the allowable bearing pressure. If the site condition changes, the plate check should be repeated.',
      timestamp: '09:23',
      agent: 'worker1',
    },
    {
      id: 'w1_5',
      role: 'user',
      senderLabel: 'User',
      content: 'Convert that into an engineer-friendly note for the final report.',
      timestamp: '09:24',
      agent: 'worker1',
    },
    {
      id: 'w1_6',
      role: 'agent',
      senderLabel: 'Claude',
      content:
        'Report note: Results are acceptable under the assumed site parameters. Reconfirm bearing capacity if geotechnical inputs change during execution.',
      timestamp: '09:25',
      agent: 'worker1',
    },
  ],
  worker2: [
    {
      id: 'w2_1',
      role: 'user',
      senderLabel: 'User',
      content: 'Summarize the main differences between pre-seed and seed venture funds.',
      timestamp: '09:30',
      agent: 'worker2',
    },
    {
      id: 'w2_2',
      role: 'agent',
      senderLabel: 'GPT-5',
      content:
        'Pre-seed funds back earlier uncertainty, write smaller checks, and care more about founder conviction than traction. Seed funds expect a tighter narrative and early evidence of execution.',
      timestamp: '09:31',
      agent: 'worker2',
    },
    {
      id: 'w2_3',
      role: 'user',
      senderLabel: 'User',
      content: 'Give me a shortlist of signals a founder should compare before reaching out.',
      timestamp: '09:32',
      agent: 'worker2',
    },
    {
      id: 'w2_4',
      role: 'agent',
      senderLabel: 'GPT-5',
      content:
        'Compare stage fit, typical check size, geography, sector thesis, pace of decision-making, and how active the partner is after the investment.',
      timestamp: '09:33',
      agent: 'worker2',
    },
    {
      id: 'w2_5',
      role: 'user',
      senderLabel: 'User',
      content: 'Now turn that into plain language for a first-time founder.',
      timestamp: '09:34',
      agent: 'worker2',
    },
    {
      id: 'w2_6',
      role: 'agent',
      senderLabel: 'GPT-5',
      content:
        'Use the fund that matches your current reality. If you only have an early idea, talk to investors built for that stage. If you already have traction, target seed investors that can help you scale.',
      timestamp: '09:35',
      agent: 'worker2',
    },
  ],
};

export const seedFiles: SavedFile[] = [
  {
    id: 'file_1',
    projectId: 'proj1',
    agent: 'manager',
    phaseState: 'Open',
    title: '2026-02-16_Manager_Session01',
    type: 'Conversation',
    content:
      'Manager session log.\n\nRepository layout agreed.\nStakeholder material separated from deliverables.\nForward-ready brief prepared for both workers.',
    createdAt: '2026-02-16T09:18:00.000Z',
  },
  {
    id: 'file_2',
    projectId: 'proj1',
    agent: 'worker1',
    phaseState: 'In Review',
    title: '2026-02-16_Worker_Backend_Session01',
    type: 'Conversation',
    content:
      'Worker 1 session.\n\nStructural calculations reviewed and summarized for report packaging.',
    createdAt: '2026-02-16T10:05:00.000Z',
  },
  {
    id: 'file_3',
    projectId: 'proj1',
    agent: 'manager',
    phaseState: 'In Review',
    title: '2026-02-17_Manager_Session02',
    type: 'Conversation',
    content:
      'Manager session 02.\n\nForward packets reviewed and routing notes documented for the team.',
    createdAt: '2026-02-17T11:30:00.000Z',
  },
  {
    id: 'file_4',
    projectId: 'proj1',
    agent: 'manager',
    phaseState: 'Open',
    title: 'Strategy-Draft-v1',
    type: 'Document',
    content:
      'Strategy draft.\n\nOutline, deliverable structure, and meeting sequence for the consulting engagement.',
    createdAt: '2026-02-18T13:10:00.000Z',
  },
  {
    id: 'file_5',
    projectId: 'proj1',
    agent: 'worker1',
    phaseState: 'Closed',
    title: 'Technical-Specs',
    type: 'Document',
    content:
      'Technical specs.\n\nCondensed validation memo for beam, column, and plate checks.',
    createdAt: '2026-02-19T14:05:00.000Z',
  },
  {
    id: 'file_6',
    projectId: 'proj1',
    agent: 'manager',
    phaseState: 'Closed',
    title: '2026-02-20_Daily-Summary',
    type: 'Report',
    content:
      'Daily summary.\n\nDocumentation mode ready. Pending handoff notes assigned to workers.',
    createdAt: '2026-02-20T16:40:00.000Z',
  },
  {
    id: 'file_7',
    projectId: 'proj2',
    agent: 'manager',
    phaseState: 'Open',
    title: '2026-03-01_Manager_Session01',
    type: 'Conversation',
    content:
      'Project 2 kickoff session.\n\nScope, owners, and timing for investor-facing materials were defined.',
    createdAt: '2026-03-01T09:00:00.000Z',
  },
  {
    id: 'file_8',
    projectId: 'proj2',
    agent: 'worker2',
    phaseState: 'In Review',
    title: '2026-03-02_Worker_Backend_Session01',
    type: 'Conversation',
    content:
      'Worker 2 drafting session.\n\nSeed and pre-seed guidance translated into plain-language copy.',
    createdAt: '2026-03-02T10:25:00.000Z',
  },
  {
    id: 'file_9',
    projectId: 'proj2',
    agent: 'manager',
    phaseState: 'In Review',
    title: 'Strategy-Draft-v1',
    type: 'Document',
    content:
      'Project 2 strategy draft.\n\nNarrative structure for investor documentation and executive summary.',
    createdAt: '2026-03-03T12:15:00.000Z',
  },
  {
    id: 'file_10',
    projectId: 'proj2',
    agent: 'manager',
    phaseState: 'Closed',
    title: '2026-03-05_Daily-Summary',
    type: 'Report',
    content:
      'Project 2 daily summary.\n\nDocumentation, handoff, and review windows are synchronized.',
    createdAt: '2026-03-05T16:10:00.000Z',
  },
];

const businessSlots = [
  '08:05',
  '08:35',
  '09:05',
  '09:35',
  '10:05',
  '10:35',
  '11:05',
  '11:35',
  '12:05',
  '12:35',
  '13:05',
  '13:35',
  '14:05',
  '14:35',
  '15:05',
  '15:35',
  '16:05',
  '16:35',
  '17:05',
  '17:35',
  '18:05',
  '18:35',
];

interface AuditTeamSeed {
  teamId: string;
  teamLabel: string;
  managerLabel: string;
  code: string;
  projectId: string;
  userPool: string[];
  workers: Array<{ label: string; agent: AgentRole }>;
  outputs: string[];
}

const auditTeamSeeds: AuditTeamSeed[] = [
  {
    teamId: 'team_legal',
    teamLabel: 'SM-Legal',
    managerLabel: 'SM-Legal',
    code: 'LC',
    projectId: 'proj1',
    userPool: ['Agustin E.', 'Legal Ops Lead', 'Compliance Reviewer'],
    workers: [
      { label: 'W-LC01', agent: 'worker1' },
      { label: 'W-LC02', agent: 'worker2' },
      { label: 'W-LC03', agent: 'worker1' },
    ],
    outputs: ['Risk memo', 'Clause pack', 'Compliance summary'],
  },
  {
    teamId: 'team_marketing',
    teamLabel: 'SM-Marketing',
    managerLabel: 'SM-Marketing',
    code: 'MK',
    projectId: 'proj2',
    userPool: ['Agustin E.', 'Brand Lead', 'Campaign Owner'],
    workers: [
      { label: 'W-MK01', agent: 'worker1' },
      { label: 'W-MK02', agent: 'worker2' },
      { label: 'W-MK03', agent: 'worker1' },
    ],
    outputs: ['Campaign brief', 'Message frame', 'Launch note'],
  },
  {
    teamId: 'team_clients',
    teamLabel: 'SM-Clients / Projects',
    managerLabel: 'AI General Manager',
    code: 'CL',
    projectId: 'proj2',
    userPool: ['Agustin E.', 'Client Partner', 'Project Coordinator'],
    workers: [
      { label: 'W-CL01', agent: 'worker1' },
      { label: 'W-CL02', agent: 'worker2' },
    ],
    outputs: ['Client checkpoint', 'Project memo', 'Stakeholder digest'],
  },
  {
    teamId: CROSS_VERIFICATION_TEAM_ID,
    teamLabel: 'Cross Verification',
    managerLabel: 'Cross Verification',
    code: 'CV',
    projectId: 'proj1',
    userPool: ['Agustin E.', 'Risk Analyst', 'Verification Lead'],
    workers: [
      { label: 'Verifier A', agent: 'worker1' },
      { label: 'Verifier B', agent: 'worker2' },
    ],
    outputs: ['Divergence matrix', 'Evidence comparison', 'Final synthesis'],
  },
];

const managerActionsByPhase: Record<WorkPhaseState, string[]> = {
  Open: ['Review window opened', 'Routing scope confirmed', 'Intake logged'],
  'In Review': ['Forward packet reviewed', 'Decision notes compiled', 'Human review queued'],
  Closed: ['Checkpoint closed', 'Synthesis approved', 'Closure note recorded'],
};

const workerActionsByPhase: Record<WorkPhaseState, string[]> = {
  Open: ['Draft prepared', 'Evidence capture started', 'Context bundle assembled'],
  'In Review': ['Revision notes added', 'Comparison notes updated', 'Spec review expanded'],
  Closed: ['Output saved', 'Summary delivered', 'Reference memo filed'],
};

function getMonthSeedEventCount(monthIndex: number, day: number) {
  const weekday = new Date(2026, monthIndex, day).getDay();
  if (weekday === 0) return day === 1 ? 2 : 1;
  if (weekday === 6) return 3;
  return 6;
}

function getAprilEventCount(_day: number) {
  return 20;
}

function getPhaseState(slotIndex: number, count: number): WorkPhaseState {
  if (slotIndex === 0) return 'Open';
  if (slotIndex >= count - 2) return 'Closed';
  return 'In Review';
}

function pickSeedFile(
  projectId: string,
  agent: AgentRole,
  phaseState: WorkPhaseState,
  eventIndex: number,
) {
  const phaseCandidates = seedFiles.filter(
    (file) => file.agent === agent && file.phaseState === phaseState,
  );
  const agentCandidates = seedFiles.filter((file) => file.agent === agent);
  const projectCandidates = seedFiles.filter((file) => file.projectId === projectId);
  const pool =
    phaseCandidates.length > 0
      ? phaseCandidates
      : agentCandidates.length > 0
        ? agentCandidates
        : projectCandidates.length > 0
          ? projectCandidates
          : seedFiles;

  return pool[eventIndex % pool.length] as SavedFile;
}

function buildOutputLabel(team: AuditTeamSeed, phaseState: WorkPhaseState, index: number) {
  const root = team.outputs[index % team.outputs.length];
  if (phaseState === 'Open') return `${root} draft`;
  if (phaseState === 'In Review') return `${root} review pack`;
  return `${root} final`;
}

function buildAuditSeedMonth({
  year,
  month,
  daysInMonth,
  countForDay,
  idPrefix,
  maxEvents,
  monthShift = 0,
}: {
  year: number;
  month: number;
  daysInMonth: number;
  countForDay: (day: number) => number;
  idPrefix: string;
  maxEvents?: number;
  monthShift?: number;
}) {
  const events = Array.from({ length: daysInMonth }, (_, index) => index + 1).flatMap((day, dayIndex) => {
    const count = countForDay(day);
    return Array.from({ length: count }, (_, slotIndex) => {
      const rotationIndex = dayIndex + slotIndex + monthShift;
      const team = auditTeamSeeds[rotationIndex % auditTeamSeeds.length] as AuditTeamSeed;
      const phaseState = getPhaseState(slotIndex, count);
      const useManager = slotIndex === 0 || (phaseState === 'Closed' && slotIndex === count - 1);
      const worker = team.workers[rotationIndex % team.workers.length];
      const agent = useManager ? 'manager' : worker.agent;
      const actorLabel = useManager ? team.managerLabel : worker.label;
      const workerLabel = useManager ? undefined : worker.label;
      const actionPool = useManager
        ? managerActionsByPhase[phaseState]
        : workerActionsByPhase[phaseState];
      const actionLabel = actionPool[rotationIndex % actionPool.length] as string;
      const outputLabel = buildOutputLabel(team, phaseState, rotationIndex);
      const file = pickSeedFile(team.projectId, agent, phaseState, rotationIndex);
      const dayString = String(day).padStart(2, '0');
      const monthString = String(month).padStart(2, '0');
      const slotOffset = (dayIndex + monthShift) % 2;

      return {
        id: `${idPrefix}_${dayString}_${String(slotIndex + 1).padStart(2, '0')}`,
        projectId: team.projectId,
        agent,
        sourceLabel: actorLabel,
        teamId: team.teamId,
        teamLabel: team.teamLabel,
        userLabel: team.userPool[rotationIndex % team.userPool.length],
        actorLabel,
        managerLabel: team.managerLabel,
        workerLabel,
        actionLabel,
        outputLabel,
        phaseState,
        fileId: file.id,
        title: `${team.code} | ${actionLabel}`,
        date: `${year}-${monthString}-${dayString}`,
        time: businessSlots[slotIndex + slotOffset] ?? businessSlots[slotIndex],
      };
    });
  });

  return (typeof maxEvents === 'number' ? events.slice(0, maxEvents) : events).map((event) => ({
    ...event,
    title: `${event.title} | ${event.outputLabel}`,
  }));
}

const marchSeedCalendarEvents = buildAuditSeedMonth({
  year: 2026,
  month: 3,
  daysInMonth: 31,
  countForDay: (day) => getMonthSeedEventCount(2, day),
  idPrefix: 'audit_evt_202603',
  maxEvents: 150,
});

const aprilSeedCalendarEvents = buildAuditSeedMonth({
  year: 2026,
  month: 4,
  daysInMonth: 30,
  countForDay: getAprilEventCount,
  idPrefix: 'audit_evt_202604',
  maxEvents: 600,
  monthShift: 7,
});

export const seedCalendarEvents: CalendarEvent[] = [
  ...marchSeedCalendarEvents,
  ...aprilSeedCalendarEvents,
];
