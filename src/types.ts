export type Page = 'A' | 'B' | 'C' | 'D' | 'E';
export type AgentRole = 'manager' | 'worker1' | 'worker2';
export type MessageRole = 'user' | 'agent' | 'system';
export type FileType = 'Conversation' | 'Document' | 'Report';
export type AIProvider = 'OpenAI' | 'Anthropic' | 'Google';
export type TeamsNodeType = 'general_manager' | 'senior_manager' | 'worker';
export type PromptVisibility = 'public' | 'private';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  agent: AgentRole;
  senderLabel: string;
  variant?: 'standard' | 'forwarded';
}

export interface Project {
  id: string;
  name: string;
}

export interface SavedFile {
  id: string;
  projectId: string;
  agent: AgentRole;
  title: string;
  type: FileType;
  content: string;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  projectId: string;
  agent: AgentRole;
  fileId: string;
  title: string;
  date: string;
  time: string;
}

export interface WorkerConfig {
  id: string;
  workerName: string;
  provider: AIProvider;
  promptFileName: string;
  promptContent: string;
  createdAt: string;
}

export interface TeamsGraphNode {
  id: string;
  type: TeamsNodeType;
  label: string;
  provider: AIProvider;
  parentId: string | null;
  teamId: string;
}

export interface TeamFolderItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
  children?: TeamFolderItem[];
  content?: string;
  createdAt?: string;
  fileType?: FileType;
  linkedFileId?: string;
}

export interface PromptItem {
  id: string;
  visibility: PromptVisibility;
  collection: string;
  code: string;
  title: string;
  description: string;
  tags: string[];
  promptText: string;
  usageCount: number;
  updatedAt: string;
}

export interface AppState {
  currentPage: Page;
  projectName: string;
  userName: string;
  messages: Record<AgentRole, Message[]>;
  selectedMessages: Record<AgentRole, string[]>;
  drafts: Record<AgentRole, string>;
  projects: Project[];
  savedFiles: SavedFile[];
  calendarEvents: CalendarEvent[];
  workerRoles: {
    worker1: string;
    worker2: string;
  };
  workerConfigs: WorkerConfig[];
  workspaceFocusAgent: AgentRole | null;
}
