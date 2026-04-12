import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react';
import type {
  ActivityLifecycleEvent,
  AIProvider,
  AgentRole,
  AuditAnswerPayload,
  AppState,
  CalendarEvent,
  CheckpointObject,
  DocumentationOriginWorkspace,
  DocumentationRepositoryRoot,
  FileType,
  Message,
  Page,
  Project,
  SavedObject,
  SavedObjectMessageRecord,
  SavedObjectStorageEntry,
  SavedFile,
  SecondaryWorkspaceTarget,
  WorkspaceVersionReference,
  WorkspaceVersion,
  WorkerConfig,
} from './types';
import { seedCalendarEvents, seedFiles, seedMessages, seedProjects } from './data/seed';
import { DEFAULT_WORK_PHASE_STATE } from './phaseState';
import {
  buildAutomaticTags,
  createHandoffActivityEvent,
  createHandoffPackageObject,
  createSavedObjectStorageEntry,
  restoreSavedObjectFromStorage,
} from './savedObjects';

const STORAGE_KEY = 'aisync_demo_state_v3';
export const GENERAL_MANAGER_LABEL = 'AI General Manager';

function getSelectionScopeKey(agent: AgentRole, selectionScope?: string) {
  return selectionScope?.trim() || agent;
}

function getPanelScopeKey(agent: AgentRole, panelScope?: string) {
  return panelScope?.trim() || agent;
}

function mergeDefinedRecord<T>(base: Record<string, T>, incoming?: Partial<Record<string, T>>) {
  const merged: Record<string, T> = { ...base };

  if (!incoming) {
    return merged;
  }

  Object.entries(incoming).forEach(([key, value]) => {
    if (value !== undefined) {
      merged[key] = value;
    }
  });

  return merged;
}

type Action =
  | { type: 'SET_PAGE'; page: Page }
  | { type: 'SET_DOCUMENTATION_ROOT'; root: DocumentationRepositoryRoot }
  | { type: 'SET_WORKSPACE_FOCUS'; agent: AgentRole | null }
  | { type: 'SET_SECONDARY_WORKSPACE'; workspace: SecondaryWorkspaceTarget | null }
  | { type: 'OPEN_CROSS_VERIFICATION_ROUTE'; payload?: AuditAnswerPayload | null }
  | { type: 'OPEN_WORKSPACE_VERSION_DETAIL'; target: WorkspaceVersionReference }
  | { type: 'OPEN_WORKSPACE_VERSION_HISTORY' }
  | { type: 'HYDRATE_PERSISTED_STATE'; persisted: PersistedState }
  | { type: 'SET_CROSS_VERIFICATION_DRAFT'; value: string }
  | { type: 'CLEAR_CROSS_VERIFICATION_CONTEXT' }
  | { type: 'ADD_MESSAGE'; agent: AgentRole; message: Message; panelScope?: string }
  | { type: 'TOGGLE_SELECT_MESSAGE'; agent: AgentRole; messageId: string; selectionScope?: string }
  | { type: 'CLEAR_SELECTION'; agent: AgentRole; selectionScope?: string }
  | { type: 'RESET_CHAT'; agent: AgentRole; panelScope?: string }
  | { type: 'CLEAR_CHAT'; agent: AgentRole; panelScope?: string }
  | { type: 'SET_DOCUMENT_LOCK'; agent: AgentRole; value: boolean; panelScope?: string }
  | { type: 'SAVE_WORKSPACE_VERSION'; agent: AgentRole; version: WorkspaceVersion; panelScope?: string }
  | { type: 'SAVE_SAVED_OBJECT'; object: SavedObject; storageEntry: SavedObjectStorageEntry; legacyFile?: SavedFile }
  | { type: 'ADD_ACTIVITY_EVENT'; event: ActivityLifecycleEvent }
  | { type: 'ADD_CALENDAR_EVENT'; event: CalendarEvent }
  | { type: 'SAVE_FILE'; file: SavedFile; event: CalendarEvent }
  | { type: 'ADD_PROJECT'; project: Project }
  | { type: 'SET_WORKER_ROLE'; worker: 'worker1' | 'worker2'; role: string }
  | { type: 'SET_DRAFT'; agent: AgentRole; value: string; panelScope?: string }
  | { type: 'SAVE_WORKER_CONFIG'; config: WorkerConfig };

interface PersistedState {
  projectName?: string;
  userName?: string;
  documentationRoot?: DocumentationRepositoryRoot;
  messages?: Partial<Record<string, Message[]>>;
  drafts?: Partial<Record<string, string>>;
  documentLocks?: Partial<Record<string, boolean>>;
  workspaceVersions?: Partial<Record<string, WorkspaceVersion[]>>;
  projects?: Project[];
  savedObjects?: SavedObject[];
  savedObjectStorage?: SavedObjectStorageEntry[];
  activityEvents?: ActivityLifecycleEvent[];
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
  const now = new Date().toISOString();
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
    documentationRoot: {
      path: '/AISync_Repository',
      selectedByUser: false,
      updatedAt: now,
    },
    projects: seedProjects,
    savedObjects: [],
    savedObjectStorage: [],
    activityEvents: [],
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
  if (agent === 'manager') return GENERAL_MANAGER_LABEL;
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
  if (!teamLabel || teamLabel === 'Main Workspace' || teamLabel === GENERAL_MANAGER_LABEL) {
    return 'global';
  }
  if (teamLabel === 'SM-Legal') return 'team_legal';
  if (teamLabel === 'SM-Marketing') return 'team_marketing';
  if (teamLabel === 'W-Clients / Projects' || teamLabel === 'SM-Clients / Projects') return 'team_clients';
  if (teamLabel === 'Cross Verification') return 'team_cross_verification';
  return undefined;
}

function getSourceWorkspaceFromLabel(sourceLabel?: string): DocumentationOriginWorkspace {
  if (!sourceLabel) return 'main-workspace';
  if (sourceLabel.includes('Cross Verification')) return 'cross-verification';
  if (sourceLabel.includes('Documentation Mode')) return 'documentation-mode';
  if (sourceLabel.includes('SM-') || sourceLabel.includes('Sub-Manager') || sourceLabel.includes('W-')) {
    return 'team-workspace';
  }
  return 'main-workspace';
}

function createSavedObjectMessageRecords(messages: SavedObjectMessageRecord[]) {
  return messages.map((message) => ({ ...message }));
}

function normalizeCalendarEvent(event: CalendarEvent, userName: string): CalendarEvent {
  const sourceSegments = getSourceSegments(event.sourceLabel);
  const sourceTeamLabel = sourceSegments[0];
  const teamLabel = event.teamLabel ?? sourceTeamLabel ?? 'Main Workspace';
  const actorLabel =
    event.actorLabel ??
    event.sourceLabel ??
    (event.agent === 'manager' ? GENERAL_MANAGER_LABEL : getAgentLabel(event.agent));
  const workerLabel =
    event.workerLabel ??
    (event.agent === 'manager' ? undefined : sourceSegments[sourceSegments.length - 1] ?? getAgentLabel(event.agent));
  const managerLabel =
    event.managerLabel ??
    (teamLabel === 'Main Workspace' ? GENERAL_MANAGER_LABEL : sourceTeamLabel ?? GENERAL_MANAGER_LABEL);
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
  const calendarEventMap = new Map(
    seed.calendarEvents.map((event) => [event.id, event] as const),
  );
  parsedCalendarEvents.forEach((event) => {
    calendarEventMap.set(event.id, event);
  });
  const calendarEvents = Array.from(calendarEventMap.values())
    .map((event) => normalizeCalendarEvent(event, resolvedUserName))
    .sort((left, right) => `${left.date} ${left.time}`.localeCompare(`${right.date} ${right.time}`));
  const savedObjectStorage =
    parsed.savedObjectStorage ??
    (parsed.savedObjects ?? seed.savedObjects).map((savedObject) =>
      createSavedObjectStorageEntry(savedObject),
    );
  const savedObjects = (parsed.savedObjects ?? seed.savedObjects).length
    ? (parsed.savedObjects ?? seed.savedObjects)
    : savedObjectStorage.map((entry) => restoreSavedObjectFromStorage(entry));

  return {
    projectName: parsed.projectName ?? seed.projectName,
    userName: resolvedUserName,
    documentationRoot: parsed.documentationRoot ?? seed.documentationRoot,
    messages: mergeDefinedRecord(seed.messages, parsed.messages),
    drafts: mergeDefinedRecord(seed.drafts, parsed.drafts),
    documentLocks: mergeDefinedRecord(seed.documentLocks, parsed.documentLocks),
    workspaceVersions: mergeDefinedRecord(seed.workspaceVersions, parsed.workspaceVersions),
    projects: parsed.projects ?? seed.projects,
    savedObjects,
    savedObjectStorage,
    activityEvents: parsed.activityEvents ?? seed.activityEvents,
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
    case 'SET_DOCUMENTATION_ROOT':
      return {
        ...state,
        documentationRoot: action.root,
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
      {
        const panelKey = getPanelScopeKey(action.agent, action.panelScope);
        const currentMessages =
          state.messages[panelKey] ?? state.messages[action.agent] ?? [];
      return {
        ...state,
        messages: {
          ...state.messages,
          [panelKey]: [...currentMessages, action.message],
        },
      };
      }
    case 'TOGGLE_SELECT_MESSAGE': {
      const selectionKey = getSelectionScopeKey(action.agent, action.selectionScope);
      const current = state.selectedMessages[selectionKey] ?? [];
      const exists = current.includes(action.messageId);
      return {
        ...state,
        selectedMessages: {
          ...state.selectedMessages,
          [selectionKey]: exists
            ? current.filter((id) => id !== action.messageId)
            : [...current, action.messageId],
        },
      };
    }
    case 'CLEAR_SELECTION': {
      const selectionKey = getSelectionScopeKey(action.agent, action.selectionScope);
      return {
        ...state,
        selectedMessages: {
          ...state.selectedMessages,
          [selectionKey]: [],
        },
      };
    }
    case 'RESET_CHAT': {
      const panelKey = getPanelScopeKey(action.agent, action.panelScope);
      return {
        ...state,
        messages: {
          ...state.messages,
          [panelKey]: seedMessages[action.agent],
        },
        selectedMessages: {
          ...state.selectedMessages,
          [panelKey]: [],
        },
        drafts: {
          ...state.drafts,
          [panelKey]: '',
        },
      };
    }
    case 'CLEAR_CHAT': {
      const panelKey = getPanelScopeKey(action.agent, action.panelScope);
      return {
        ...state,
        messages: {
          ...state.messages,
          [panelKey]: [],
        },
        selectedMessages: {
          ...state.selectedMessages,
          [panelKey]: [],
        },
        drafts: {
          ...state.drafts,
          [panelKey]: '',
        },
      };
    }
    case 'SET_DOCUMENT_LOCK': {
      const panelKey = getPanelScopeKey(action.agent, action.panelScope);
      return {
        ...state,
        documentLocks: {
          ...state.documentLocks,
          [panelKey]: action.value,
        },
      };
    }
    case 'SAVE_WORKSPACE_VERSION': {
      const panelKey = getPanelScopeKey(action.agent, action.panelScope);
      const currentVersions =
        state.workspaceVersions[panelKey] ?? state.workspaceVersions[action.agent] ?? [];
      return {
        ...state,
        workspaceVersions: {
          ...state.workspaceVersions,
          [panelKey]: [...currentVersions, action.version],
        },
      };
    }
    case 'SAVE_SAVED_OBJECT':
      return {
        ...state,
        savedObjects: [...state.savedObjects, action.object],
        savedObjectStorage: [...state.savedObjectStorage, action.storageEntry],
        savedFiles: action.legacyFile ? [...state.savedFiles, action.legacyFile] : state.savedFiles,
      };
    case 'ADD_ACTIVITY_EVENT':
      return {
        ...state,
        activityEvents: [...state.activityEvents, action.event],
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
    case 'SET_DRAFT': {
      const panelKey = getPanelScopeKey(action.agent, action.panelScope);
      return {
        ...state,
        drafts: {
          ...state.drafts,
          [panelKey]: action.value,
        },
      };
    }
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
    documentationRoot: state.documentationRoot,
    messages: state.messages,
    drafts: state.drafts,
    documentLocks: state.documentLocks,
    workspaceVersions: state.workspaceVersions,
    projects: state.projects,
    savedObjects: state.savedObjects,
    savedObjectStorage: state.savedObjectStorage,
    activityEvents: state.activityEvents,
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

interface SaveSelectionArgs {
  agent: AgentRole;
  content: string;
  title: string;
  type: FileType;
  projectId: string;
  selectedMessages: SavedObjectMessageRecord[];
  date?: string;
  sourceLabel?: string;
  sourcePanelId: string;
  sourcePanelLabel: string;
}

interface SaveWorkerConfigArgs {
  workerName: string;
  provider: AIProvider;
  promptFileName: string;
  promptContent: string;
}

interface CreateHandoffArgs {
  title: string;
  projectId: string;
  sourceWorkspace: DocumentationOriginWorkspace;
  sourceTeamId: string | null;
  sourceTeamLabel: string | null;
  sourcePanelId: string;
  sourcePanelLabel: string;
  destinationWorkspace: DocumentationOriginWorkspace;
  destinationTeamId: string | null;
  destinationTeamLabel: string | null;
  destinationPanelId: string | null;
  destinationPanelLabel: string;
  transferredMessages: SavedObjectMessageRecord[];
  transferredContent: string;
  objective: string;
  minimumContext: string;
  riskNotes?: string[];
  linkedSourceDocumentIds?: string[];
  linkedDerivedDocumentIds?: string[];
  linkedSourceObjectIds?: string[];
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  saveSelection: (args: SaveSelectionArgs) => void;
  createHandoff: (args: CreateHandoffArgs) => void;
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

  const saveSelection = ({
    agent,
    content,
    title,
    type,
    projectId,
    selectedMessages,
    date,
    sourceLabel,
    sourcePanelId,
    sourcePanelLabel,
  }: SaveSelectionArgs) => {
    const createdAt = new Date().toISOString();
    const fileId = `file_${Date.now()}`;
    const objectId = `saved_selection_${Date.now()}`;
    const projectName =
      state.projects.find((project) => project.id === projectId)?.name ?? projectId;
    const agentLabel = getAgentLabel(agent);
    const displaySource = sourceLabel ?? agentLabel;
    const eventDate = date ?? createdAt.slice(0, 10);
    const sourceSegments = getSourceSegments(sourceLabel);
    const sourceTeamLabel = sourceSegments[0] ?? 'Main Workspace';
    const sourceTeamId = getTeamIdFromLabel(sourceTeamLabel) ?? null;
    const actorLabel = sourceLabel ?? agentLabel;
    const actionLabel = getDefaultActionLabel(type);
    const sourceWorkspace = getSourceWorkspaceFromLabel(sourceLabel);

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

    const savedObject: SavedObject = {
      id: objectId,
      objectType: 'saved-selection',
      title,
      createdAt,
      updatedAt: createdAt,
      sourceWorkspace,
      sourceTeamId,
      sourceTeamLabel,
      sourcePanelId,
      sourcePanelLabel,
      createdBy: state.userName,
      projectId,
      projectLabel: projectName,
      provenance: {
        sourceObjectIds: [],
        messageIds: selectedMessages.map((message) => message.id),
        sourceFileId: fileId,
        note: 'Saved from manual message selection',
      },
      status: 'active',
      savePurpose: 'preserve-useful-selection',
      automaticTags: buildAutomaticTags({
        objectType: 'saved-selection',
        sourceWorkspace,
        sourceTeamId,
        sourcePanelId,
        status: 'active',
        savePurpose: 'preserve-useful-selection',
        extraTags: [
          'action:save-selection',
          selectedMessages.length > 1 ? 'selection:multi-message' : 'selection:single-message',
          sourceWorkspace === 'cross-verification' ? 'flow:cross-verification' : '',
        ],
      }),
      userTags: [],
      payload: {
        messageIds: selectedMessages.map((message) => message.id),
        selectedMessages: createSavedObjectMessageRecords(selectedMessages),
        content,
        selectionCount: selectedMessages.length,
        fileType: type,
        legacyFileId: fileId,
      },
    };
    const storageEntry = createSavedObjectStorageEntry(savedObject);

    const activityEvent: ActivityLifecycleEvent = {
      id: `activity_${Date.now()}`,
      eventType: 'save-selection',
      createdAt,
      actor: state.userName,
      sourceWorkspace,
      sourceTeamId,
      sourceTeamLabel,
      sourcePanelId,
      sourcePanelLabel,
      projectId,
      relatedObjectId: objectId,
      relatedLegacyFileId: fileId,
      detail: `Saved selection from ${sourcePanelLabel}`,
      metadata: {
        selectionCount: selectedMessages.length,
        fileType: type,
      },
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
            ? GENERAL_MANAGER_LABEL
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

    dispatch({ type: 'SAVE_SAVED_OBJECT', object: savedObject, storageEntry, legacyFile: file });
    dispatch({ type: 'ADD_ACTIVITY_EVENT', event: activityEvent });
    dispatch({ type: 'ADD_CALENDAR_EVENT', event: normalizeCalendarEvent(event, state.userName) });
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

  const createHandoff = ({
    title,
    projectId,
    sourceWorkspace,
    sourceTeamId,
    sourceTeamLabel,
    sourcePanelId,
    sourcePanelLabel,
    destinationWorkspace,
    destinationTeamId,
    destinationTeamLabel,
    destinationPanelId,
    destinationPanelLabel,
    transferredMessages,
    transferredContent,
    objective,
    minimumContext,
    riskNotes = [],
    linkedSourceDocumentIds = [],
    linkedDerivedDocumentIds = [],
    linkedSourceObjectIds = [],
  }: CreateHandoffArgs) => {
    const projectLabel =
      state.projects.find((project) => project.id === projectId)?.name ?? projectId;
    const linkedCheckpoint =
      [...state.savedObjects]
        .reverse()
        .find(
          (savedObject): savedObject is CheckpointObject =>
            savedObject.objectType === 'checkpoint' &&
            savedObject.sourcePanelId === sourcePanelId &&
            savedObject.projectId === projectId,
        ) ?? null;

    const handoff = createHandoffPackageObject({
      title,
      projectId,
      projectLabel,
      createdBy: state.userName,
      sourceWorkspace,
      sourceTeamId,
      sourceTeamLabel,
      sourcePanelId,
      sourcePanelLabel,
      destinationWorkspace,
      destinationTeamId,
      destinationTeamLabel,
      destinationPanelId,
      destinationPanelLabel,
      transferredMessages: createSavedObjectMessageRecords(transferredMessages),
      transferredContent,
      objective,
      minimumContext,
      linkedCheckpointId: linkedCheckpoint?.id ?? null,
      linkedSourceDocumentIds,
      linkedDerivedDocumentIds,
      linkedSourceObjectIds,
      riskNotes,
      continuityExpected: `Continue the assigned work from ${sourcePanelLabel} into ${destinationPanelLabel}.`,
    });

    dispatch({
      type: 'SAVE_SAVED_OBJECT',
      object: handoff,
      storageEntry: createSavedObjectStorageEntry(handoff),
    });
    dispatch({
      type: 'ADD_ACTIVITY_EVENT',
      event: createHandoffActivityEvent({
        handoff,
        actor: state.userName,
      }),
    });
  };

  return (
    <AppContext.Provider value={{ state, dispatch, saveSelection, createHandoff, saveWorkerConfig }}>
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
