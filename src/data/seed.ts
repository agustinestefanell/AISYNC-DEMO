import type { CalendarEvent, Message, Project, SavedFile } from '../types';

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
    title: '2026-03-05_Daily-Summary',
    type: 'Report',
    content:
      'Project 2 daily summary.\n\nDocumentation, handoff, and review windows are synchronized.',
    createdAt: '2026-03-05T16:10:00.000Z',
  },
];

const fileLookup = Object.fromEntries(seedFiles.map((file) => [file.id, file]));
const businessSlots = ['09:05', '09:45', '10:30', '11:20', '13:05', '14:10', '15:25', '16:40'];

const denseCalendarBlueprint = [
  { date: '2026-02-16', fileIds: ['file_1', 'file_2', 'file_4'] },
  { date: '2026-02-17', fileIds: ['file_3', 'file_5'] },
  { date: '2026-02-18', fileIds: ['file_4', 'file_6'] },
  { date: '2026-02-20', fileIds: ['file_2', 'file_6'] },
  { date: '2026-03-01', fileIds: ['file_7', 'file_8', 'file_9'] },
  { date: '2026-03-02', fileIds: ['file_8', 'file_9', 'file_10'] },
  { date: '2026-03-03', fileIds: ['file_1', 'file_7', 'file_9'] },
  { date: '2026-03-04', fileIds: ['file_2', 'file_5', 'file_10'] },
  { date: '2026-03-05', fileIds: ['file_3', 'file_8', 'file_10'] },
  { date: '2026-03-06', fileIds: ['file_4', 'file_7'] },
  { date: '2026-03-09', fileIds: ['file_5', 'file_8', 'file_9'] },
  { date: '2026-03-10', fileIds: ['file_1', 'file_6', 'file_10'] },
  { date: '2026-03-11', fileIds: ['file_2', 'file_4'] },
  { date: '2026-03-12', fileIds: ['file_3', 'file_5', 'file_9'] },
  { date: '2026-03-13', fileIds: ['file_7', 'file_8'] },
  { date: '2026-03-16', fileIds: ['file_1', 'file_4', 'file_6'] },
  { date: '2026-03-17', fileIds: ['file_2', 'file_9'] },
  { date: '2026-03-18', fileIds: ['file_3', 'file_8', 'file_10'] },
  { date: '2026-03-19', fileIds: ['file_5', 'file_7'] },
  { date: '2026-03-20', fileIds: ['file_1', 'file_9', 'file_10'] },
  { date: '2026-03-23', fileIds: ['file_2', 'file_4'] },
  { date: '2026-03-24', fileIds: ['file_3', 'file_6', 'file_8'] },
  { date: '2026-03-25', fileIds: ['file_5', 'file_7', 'file_10'] },
  { date: '2026-03-26', fileIds: ['file_4', 'file_9'] },
  { date: '2026-03-27', fileIds: ['file_2', 'file_8', 'file_10'] },
  { date: '2026-03-30', fileIds: ['file_1', 'file_3', 'file_7'] },
  { date: '2026-03-31', fileIds: ['file_5', 'file_9', 'file_10'] },
];

function getAgentLabel(agent: SavedFile['agent']) {
  if (agent === 'manager') return 'Manager';
  if (agent === 'worker1') return 'Worker 1';
  return 'Worker 2';
}

export const seedCalendarEvents: CalendarEvent[] = denseCalendarBlueprint.flatMap(
  (day, dayIndex) =>
    day.fileIds.map((fileId, fileIndex) => {
      const file = fileLookup[fileId] as SavedFile;
      const projectName =
        seedProjects.find((project) => project.id === file.projectId)?.name ?? file.projectId;
      return {
        id: `evt_${dayIndex + 1}_${fileIndex + 1}`,
        projectId: file.projectId,
        agent: file.agent,
        fileId: file.id,
        title: `${projectName} | ${getAgentLabel(file.agent)} | ${file.title}`,
        date: day.date,
        time: businessSlots[(dayIndex + fileIndex) % businessSlots.length],
      };
    }),
);
