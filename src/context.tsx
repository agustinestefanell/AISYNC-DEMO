import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react';
import type {
  AIProvider,
  AgentRole,
  AppState,
  CalendarEvent,
  FileType,
  Message,
  Page,
  Project,
  SavedFile,
  SecondaryWorkspaceTarget,
  WorkerConfig,
} from './types';
import { seedCalendarEvents, seedFiles, seedMessages, seedProjects } from './data/seed';

const STORAGE_KEY = 'aisync_demo_state_v3';

type Action =
  | { type: 'SET_PAGE'; page: Page }
  | { type: 'SET_WORKSPACE_FOCUS'; agent: AgentRole | null }
  | { type: 'SET_SECONDARY_WORKSPACE'; workspace: SecondaryWorkspaceTarget | null }
  | { type: 'ADD_MESSAGE'; agent: AgentRole; message: Message }
  | { type: 'TOGGLE_SELECT_MESSAGE'; agent: AgentRole; messageId: string }
  | { type: 'CLEAR_SELECTION'; agent: AgentRole }
  | { type: 'RESET_CHAT'; agent: AgentRole }
  | { type: 'CLEAR_CHAT'; agent: AgentRole }
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
    currentPage: 'A',
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
    return {
      ...seed,
      projectName: parsed.projectName ?? seed.projectName,
      userName: parsed.userName ?? seed.userName,
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
      projects: parsed.projects ?? seed.projects,
      savedFiles: parsed.savedFiles ?? seed.savedFiles,
      calendarEvents: parsed.calendarEvents ?? seed.calendarEvents,
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
      selectedMessages: {
        manager: [],
        worker1: [],
        worker2: [],
      },
      workspaceFocusAgent: null,
      secondaryWorkspace: null,
    };
  } catch {
    return seed;
  }
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_PAGE':
      return { ...state, currentPage: action.page };
    case 'SET_WORKSPACE_FOCUS':
      return { ...state, workspaceFocusAgent: action.agent };
    case 'SET_SECONDARY_WORKSPACE':
      return { ...state, secondaryWorkspace: action.workspace };
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

  const saveFile = ({ agent, content, title, type, projectId, date, sourceLabel }: SaveFileArgs) => {
    const createdAt = new Date().toISOString();
    const fileId = `file_${Date.now()}`;
    const projectName =
      state.projects.find((project) => project.id === projectId)?.name ?? projectId;
    const agentLabel =
      agent === 'manager' ? 'Manager' : agent === 'worker1' ? 'Worker 1' : 'Worker 2';
    const displaySource = sourceLabel ?? agentLabel;
    const eventDate = date ?? createdAt.slice(0, 10);

    const file: SavedFile = {
      id: fileId,
      projectId,
      agent,
      sourceLabel,
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
      fileId,
      title: `${projectName} | ${displaySource} | ${title}`,
      date: eventDate,
      time: getBusinessTime(new Date()),
    };

    dispatch({ type: 'SAVE_FILE', file, event });
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
