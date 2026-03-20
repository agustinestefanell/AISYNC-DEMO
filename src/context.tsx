import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react';
import type {
  AIProvider,
  AgentRole,
  AuditAnswerPayload,
  AppState,
  CalendarEvent,
  FileType,
  Message,
  Page,
  Project,
  SavedFile,
  SecondaryWorkspaceTarget,
  WorkspaceVersionReference,
  WorkspaceVersion,
  WorkerConfig,
} from './types';
import { seedCalendarEvents, seedFiles, seedMessages, seedProjects } from './data/seed';
import { DEFAULT_WORK_PHASE_STATE } from './phaseState';

const STORAGE_KEY = 'aisync_demo_state_v3';

type Action =
  | { type: 'SET_PAGE'; page: Page }
  | { type: 'SET_WORKSPACE_FOCUS'; agent: AgentRole | null }
  | { type: 'SET_SECONDARY_WORKSPACE'; workspace: SecondaryWorkspaceTarget | null }
  | { type: 'OPEN_CROSS_VERIFICATION_ROUTE'; payload?: AuditAnswerPayload | null }
  | { type: 'OPEN_WORKSPACE_VERSION_DETAIL'; target: WorkspaceVersionReference }
  | { type: 'OPEN_WORKSPACE_VERSION_HISTORY' }
  | { type: 'HYDRATE_PERSISTED_STATE'; persisted: PersistedState }
  | { type: 'SET_CROSS_VERIFICATION_DRAFT'; value: string }
  | { type: 'CLEAR_CROSS_VERIFICATION_CONTEXT' }
  | { type: 'ADD_MESSAGE'; agent: AgentRole; message: Message }
  | { type: 'TOGGLE_SELECT_MESSAGE'; agent: AgentRole; messageId: string }
  | { type: 'CLEAR_SELECTION'; agent: AgentRole }
  | { type: 'RESET_CHAT'; agent: AgentRole }
  | { type: 'CLEAR_CHAT'; agent: AgentRole }
  | { type: 'SET_DOCUMENT_LOCK'; agent: AgentRole; value: boolean }
  | { type: 'SAVE_WORKSPACE_VERSION'; agent: AgentRole; version: WorkspaceVersion }
  | { type: 'ADD_CALENDAR_EVENT'; event: CalendarEvent }
  | { type: 'SAVE_FILE'; file: SavedFile; event: CalendarEvent }
  | { type: 'ADD_PROJECT'; project: Project }
  | { type: 'SET_WORKER_ROLE'; worker: 'worker1' | 'worker2'; role: string }
  | { type: 'SET_DRAFT'; agent: AgentRole; value: string }
  | { type: 'SAVE_WORKER_CONFIG'; config: WorkerConfig };

interface PersistedState {
  projectName?: string;
  userName?: string;
  messages?: Partial<Record<AgentRole, Message[]>>;
  drafts?: Partial<Record<AgentRole, string>>;
  documentLocks?: Partial<Record<AgentRole, boolean>>;
  workspaceVersions?: Partial<Record<AgentRole, WorkspaceVersion[]>>;
  projects?: Project[];
  savedFiles?: SavedFile[];
  calendarEvents?: CalendarEvent[];
  workerRoles?: {
    worker1?: string;
    worker2?: string;
  };
  workerConfigs?: WorkerConfig[];
  worker1Role?: string;
  worker2Role?: string;
}

function buildSeedState(): AppState {
  return {
    currentPage: 'D',
    projectName: 'AISync Demo Project',
    userName: 'Agustin E.',
    messages: {
      manager: seedMessages.manager,
      worker1: seedMessages.worker1,
      worker2: seedMessages.worker2,
    },
    selectedMessages: {
      manager: [],
      worker1: [],
      worker2: [],
    },
    drafts: {
      manager: '',
      worker1: '',
      worker2: '',
    },
    documentLocks: {
      manager: false,
      worker1: false,
      worker2: false,
    },
    workspaceVersions: {
      manager: [],
      worker1: [],
      worker2: [],
    },
    projects: seedProjects,
    savedFiles: seedFiles,
    calendarEvents: seedCalendarEvents,
    workerRoles: {
      worker1: 'TBD',
      worker2: '',
    },
    workerConfigs: [],
    workspaceFocusAgent: null,
    secondaryWorkspace: null,
    auditAnswerPayload: null,
    crossVerificationDraft: '',
    selectedWorkspaceVersion: null,
  };
}

function getAgentLabel(agent: AgentRole) {
  if (agent === 'manager') return 'AI General Manager';
  if (agent === 'worker1') return 'Worker 1';
  return 'Worker 2';
}

function getDefaultActionLabel(type?: FileType) {
  if (type === 'Conversation') return 'Conversation logged';
  if (type === 'Report') return 'Report closed';
  return 'Document saved';
}

function getSourceSegments(sourceLabel?: string) {
  return sourceLabel
    ?.split('|')
    .map((segment) => segment.trim())
    .filter(Boolean) ?? [];
}

function getTeamIdFromLabel(teamLabel?: string) {
  if (!teamLabel || teamLabel === 'Main Workspace' || teamLabel === 'AI General Manager') {
    return 'global';
  }
  if (teamLabel === 'SM-Legal') return 'team_legal';
  if (teamLabel === 'SM-Marketing') return 'team_marketing';
  if (teamLabel === 'W-Clients / Projects') return 'team_clients';
  if (teamLabel === 'Cross Verification') return 'team_cross_verification';
  return undefined;
}

function normalizeCalendarEvent(event: CalendarEvent, userName: string): CalendarEvent {
  const sourceSegments = getSourceSegments(event.sourceLabel);
  const sourceTeamLabel = sourceSegments[0];
  const teamLabel = event.teamLabel ?? sourceTeamLabel ?? 'Main Workspace';
  const actorLabel =
    event.actorLabel ??
    event.sourceLabel ??
    (event.agent === 'manager' ? 'AI General Manager' : getAgentLabel(event.agent));
  const workerLabel =
    event.workerLabel ??
    (event.agent === 'manager' ? undefined : sourceSegments[sourceSegments.length - 1] ?? getAgentLabel(event.agent));
  const managerLabel =
    event.managerLabel ??
    (teamLabel === 'Main Workspace' ? 'AI General Manager' : sourceTeamLabel ?? 'AI General Manager');
  const outputLabel = event.outputLabel ?? event.title.split('|').pop()?.trim() ?? event.title;

  return {
    ...event,
    teamId: event.teamId ?? getTeamIdFromLabel(teamLabel),
    teamLabel,
    userLabel: event.userLabel ?? userName,
    actorLabel,
    managerLabel,
    workerLabel,
    actionLabel: event.actionLabel ?? 'Audit event logged',
    outputLabel,
    phaseState: event.phaseState ?? DEFAULT_WORK_PHASE_STATE,
  };
}

function getInitialState(): AppState {
  const seed = buildSeedState();
  if (typeof window === 'undefined') {
    return seed;
  }

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return seed;
    }

    const parsed = JSON.parse(saved) as PersistedState;
    const resolved = resolvePersistedState(parsed, seed);

    return {
      ...seed,
      ...resolved,
      selectedMessages: {
        manager: [],
        worker1: [],
        worker2: [],
      },
      workspaceFocusAgent: null,
      secondaryWorkspace: null,
      auditAnswerPayload: null,
      crossVerificationDraft: '',
      selectedWorkspaceVersion: null,
    };
  } catch {
    return seed;
  }
}

function resolvePersistedState(parsed: PersistedState, seed: AppState) {
  const resolvedUserName = parsed.userName ?? seed.userName;
  const seedPhaseByFileId = new Map(
    seed.savedFiles.map((file) => [file.id, file.phaseState ?? DEFAULT_WORK_PHASE_STATE]),
  );
  const savedFiles = (parsed.savedFiles ?? seed.savedFiles).map((file) => ({
    ...file,
    phaseState:
      file.phaseState ?? seedPhaseByFileId.get(file.id) ?? DEFAULT_WORK_PHASE_STATE,
  }));
  const parsedCalendarEvents = parsed.calendarEvents ?? [];
  const hasModernAuditSeed = parsedCalendarEvents.some((event) =>
    event.id.startsWith('audit_evt_'),
  );
  const preservedCustomEvents = parsedCalendarEvents.filter(
    (event) => !event.id.startsWith('evt_') && !event.id.startsWith('audit_evt_'),
  );
  const calendarEvents = (hasModernAuditSeed
    ? parsedCalendarEvents
    : [...seed.calendarEvents, ...preservedCustomEvents]
  )
    .map((event) => normalizeCalendarEvent(event, resolvedUserName))
    .sort((left, right) => `${left.date} ${left.time}`.localeCompare(`${right.date} ${right.time}`));

  return {
    projectName: parsed.projectName ?? seed.projectName,
    userName: resolvedUserName,
    messages: {
      manager: parsed.messages?.manager ?? seed.messages.manager,
      worker1: parsed.messages?.worker1 ?? seed.messages.worker1,
      worker2: parsed.messages?.worker2 ?? seed.messages.worker2,
    },
    drafts: {
      manager: parsed.drafts?.manager ?? '',
      worker1: parsed.drafts?.worker1 ?? '',
      worker2: parsed.drafts?.worker2 ?? '',
    },
    documentLocks: {
      manager: parsed.documentLocks?.manager ?? seed.documentLocks.manager,
      worker1: parsed.documentLocks?.worker1 ?? seed.documentLocks.worker1,
      worker2: parsed.documentLocks?.worker2 ?? seed.documentLocks.worker2,
    },
    workspaceVersions: {
      manager: parsed.workspaceVersions?.manager ?? seed.workspaceVersions.manager,
      worker1: parsed.workspaceVersions?.worker1 ?? seed.workspaceVersions.worker1,
      worker2: parsed.workspaceVersions?.worker2 ?? seed.workspaceVersions.worker2,
    },
    projects: parsed.projects ?? seed.projects,
    savedFiles,
    calendarEvents,
    workerRoles: {
      worker1:
        parsed.workerRoles?.worker1 ??
        parsed.worker1Role ??
        seed.workerRoles.worker1,
      worker2:
        parsed.workerRoles?.worker2 ??
        parsed.worker2Role ??
        seed.workerRoles.worker2,
    },
    workerConfigs: parsed.workerConfigs ?? [],
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_PAGE':
      return {
        ...state,
        currentPage: action.page,
        selectedWorkspaceVersion:
          action.page === 'H' ? state.selectedWorkspaceVersion : null,
      };
    case 'SET_WORKSPACE_FOCUS':
      return { ...state, workspaceFocusAgent: action.agent };
    case 'SET_SECONDARY_WORKSPACE':
      return { ...state, secondaryWorkspace: action.workspace };
    case 'OPEN_CROSS_VERIFICATION_ROUTE':
      return {
        ...state,
        currentPage: 'G',
        auditAnswerPayload: action.payload ?? null,
        crossVerificationDraft: action.payload?.content ?? '',
      };
    case 'OPEN_WORKSPACE_VERSION_DETAIL':
      return {
        ...state,
        currentPage: 'H',
        selectedWorkspaceVersion: action.target,
      };
    case 'OPEN_WORKSPACE_VERSION_HISTORY':
      return {
        ...state,
        currentPage: 'H',
        selectedWorkspaceVersion: null,
      };
    case 'HYDRATE_PERSISTED_STATE': {
      const seed = buildSeedState();
      const resolved = resolvePersistedState(action.persisted, seed);

      return {
        ...state,
        ...resolved,
      };
    }
    case 'SET_CROSS_VERIFICATION_DRAFT':
      return { ...state, crossVerificationDraft: action.value };
    case 'CLEAR_CROSS_VERIFICATION_CONTEXT':
      return {
        ...state,
        auditAnswerPayload: null,
        crossVerificationDraft: '',
      };
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.agent]: [...state.messages[action.agent], action.message],
        },
      };
    case 'TOGGLE_SELECT_MESSAGE': {
      const current = state.selectedMessages[action.agent];
      const exists = current.includes(action.messageId);
      return {
        ...state,
        selectedMessages: {
          ...state.selectedMessages,
          [action.agent]: exists
            ? current.filter((id) => id !== action.messageId)
            : [...current, action.messageId],
        },
      };
    }
    case 'CLEAR_SELECTION':
      return {
        ...state,
        selectedMessages: {
          ...state.selectedMessages,
          [action.agent]: [],
        },
      };
    case 'RESET_CHAT':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.agent]: seedMessages[action.agent],
        },
        selectedMessages: {
          ...state.selectedMessages,
          [action.agent]: [],
        },
        drafts: {
          ...state.drafts,
          [action.agent]: '',
        },
      };
    case 'CLEAR_CHAT':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.agent]: [],
        },
        selectedMessages: {
          ...state.selectedMessages,
          [action.agent]: [],
        },
        drafts: {
          ...state.drafts,
          [action.agent]: '',
        },
      };
    case 'SET_DOCUMENT_LOCK':
      return {
        ...state,
        documentLocks: {
          ...state.documentLocks,
          [action.agent]: action.value,
        },
      };
    case 'SAVE_WORKSPACE_VERSION':
      return {
        ...state,
        workspaceVersions: {
          ...state.workspaceVersions,
          [action.agent]: [...state.workspaceVersions[action.agent], action.version],
        },
      };
    case 'ADD_CALENDAR_EVENT':
      return {
        ...state,
        calendarEvents: [...state.calendarEvents, action.event],
      };
    case 'SAVE_FILE':
      return {
        ...state,
        savedFiles: [...state.savedFiles, action.file],
        calendarEvents: [...state.calendarEvents, action.event],
      };
    case 'ADD_PROJECT':
      return {
        ...state,
        projects: [...state.projects, action.project],
      };
    case 'SET_WORKER_ROLE':
      return {
        ...state,
        workerRoles: {
          ...state.workerRoles,
          [action.worker]: action.role,
        },
      };
    case 'SET_DRAFT':
      return {
        ...state,
        drafts: {
          ...state.drafts,
          [action.agent]: action.value,
        },
      };
    case 'SAVE_WORKER_CONFIG': {
      const workerRoles = { ...state.workerRoles };
      if (!workerRoles.worker1 || workerRoles.worker1 === 'TBD') {
        workerRoles.worker1 = action.config.workerName;
      } else if (!workerRoles.worker2) {
        workerRoles.worker2 = action.config.workerName;
      }

      return {
        ...state,
        workerRoles,
        workerConfigs: [
          action.config,
          ...state.workerConfigs.filter((config) => config.id !== action.config.id),
        ],
      };
    }
    default:
      return state;
  }
}

function serializeState(state: AppState): PersistedState {
  return {
    projectName: state.projectName,
    userName: state.userName,
    messages: state.messages,
    drafts: state.drafts,
    documentLocks: state.documentLocks,
    workspaceVersions: state.workspaceVersions,
    projects: state.projects,
    savedFiles: state.savedFiles,
    calendarEvents: state.calendarEvents,
    workerRoles: state.workerRoles,
    workerConfigs: state.workerConfigs,
  };
}

function getBusinessTime(now = new Date()) {
  const safeHour = Math.min(17, Math.max(9, now.getHours()));
  return `${String(safeHour).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

interface SaveFileArgs {
  agent: AgentRole;
  content: string;
  title: string;
  type: FileType;
  projectId: string;
  date?: string;
  sourceLabel?: string;
}

interface SaveWorkerConfigArgs {
  workerName: string;
  provider: AIProvider;
  promptFileName: string;
  promptContent: string;
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  saveFile: (args: SaveFileArgs) => void;
  saveWorkerConfig: (args: SaveWorkerConfigArgs) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialState);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeState(state)));
  }, [state]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) {
        return;
      }

      try {
        dispatch({
          type: 'HYDRATE_PERSISTED_STATE',
          persisted: JSON.parse(event.newValue) as PersistedState,
        });
      } catch {
        // Ignore malformed cross-window payloads.
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const saveFile = ({ agent, content, title, type, projectId, date, sourceLabel }: SaveFileArgs) => {
    const createdAt = new Date().toISOString();
    const fileId = `file_${Date.now()}`;
    const projectName =
      state.projects.find((project) => project.id === projectId)?.name ?? projectId;
    const agentLabel = getAgentLabel(agent);
    const displaySource = sourceLabel ?? agentLabel;
    const eventDate = date ?? createdAt.slice(0, 10);
    const sourceSegments = getSourceSegments(sourceLabel);
    const sourceTeamLabel = sourceSegments[0] ?? 'Main Workspace';
    const actorLabel = sourceLabel ?? agentLabel;
    const actionLabel = getDefaultActionLabel(type);

    const file: SavedFile = {
      id: fileId,
      projectId,
      agent,
      sourceLabel,
      phaseState: DEFAULT_WORK_PHASE_STATE,
      title,
      type,
      content,
      createdAt,
    };

    const event: CalendarEvent = {
      id: `event_${Date.now()}`,
      projectId,
      agent,
      sourceLabel,
      teamId: getTeamIdFromLabel(sourceTeamLabel),
      teamLabel: sourceTeamLabel,
      userLabel: state.userName,
      actorLabel,
      managerLabel:
        agent === 'manager'
          ? actorLabel
          : sourceTeamLabel === 'Main Workspace'
            ? 'AI General Manager'
            : sourceTeamLabel,
      workerLabel:
        agent === 'manager'
          ? undefined
          : sourceSegments[sourceSegments.length - 1] ?? agentLabel,
      actionLabel,
      outputLabel: title,
      phaseState: DEFAULT_WORK_PHASE_STATE,
      fileId,
      title: `${projectName} | ${displaySource} | ${title}`,
      date: eventDate,
      time: getBusinessTime(new Date()),
    };

    dispatch({ type: 'SAVE_FILE', file, event: normalizeCalendarEvent(event, state.userName) });
  };

  const saveWorkerConfig = ({
    workerName,
    provider,
    promptFileName,
    promptContent,
  }: SaveWorkerConfigArgs) => {
    dispatch({
      type: 'SAVE_WORKER_CONFIG',
      config: {
        id: `worker_cfg_${Date.now()}`,
        workerName,
        provider,
        promptFileName,
        promptContent,
        createdAt: new Date().toISOString(),
      },
    });
  };

  return (
    <AppContext.Provider value={{ state, dispatch, saveFile, saveWorkerConfig }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
