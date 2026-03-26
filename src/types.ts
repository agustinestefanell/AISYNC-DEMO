export type Page = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
export type SecondaryManagerPage = 'B' | 'C' | 'D' | 'E' | 'G';
export type AgentRole = 'manager' | 'worker1' | 'worker2';
export type MessageRole = 'user' | 'agent' | 'system';
export type FileType = 'Conversation' | 'Document' | 'Report';
export type AIProvider = 'OpenAI' | 'Anthropic' | 'Google';
export type TeamsNodeType = 'general_manager' | 'senior_manager' | 'worker';
export type PromptVisibility = 'public' | 'private';
export type WorkPhaseState = 'Open' | 'In Review' | 'Closed';
export type AuditAnswerContentType = 'message-selection';
export type AuditAnswerSourceAgentType = 'general-manager' | 'sub-manager' | 'worker';
export type WorkspaceVersionSource = 'main' | 'team';
export type DocumentationOriginWorkspace =
  | 'main-workspace'
  | 'team-workspace'
  | 'documentation-mode'
  | 'audit-log'
  | 'cross-verification';
export type DocumentationViewMode =
  | 'repository'
  | 'structure'
  | 'audit'
  | 'investigate'
  | 'knowledge-map';
export type DocumentationManifestStatus = 'active' | 'archived' | 'promoted';
export type DocumentationRecordClass = 'team-record' | 'agent-record' | 'working-record';
export type DocumentationSensitivityLevel = 'internal' | 'confidential' | 'restricted';
export type DocumentationDocumentState =
  | 'Draft'
  | 'In Progress'
  | 'Under Review'
  | 'Approved'
  | 'Locked';
export type ReviewForwardSourceKind =
  | 'general-manager'
  | 'main-worker'
  | 'secondary-page-sub-manager'
  | 'team-sub-manager'
  | 'cross-verification-sub-manager';
export type ReviewForwardTargetKind =
  | 'general-manager'
  | 'main-worker'
  | 'team-worker'
  | 'team-sub-manager';
export type AuditAnswerRoutingTargetKind =
  | 'worker'
  | 'sub-manager'
  | 'general-manager';

export interface SecondaryWorkspaceTarget {
  teamId: string;
  label: string;
  color: string;
  nodeId: string;
  nodeType: TeamsNodeType;
  rootNodeId: string;
  focusNodeId: string;
}

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
  sourceLabel?: string;
  phaseState?: WorkPhaseState;
  title: string;
  type: FileType;
  content: string;
  createdAt: string;
}

export interface DocumentationRepositoryRoot {
  path: string;
  selectedByUser: boolean;
  updatedAt: string;
}

export interface DocumentationViewDefinition {
  mode: DocumentationViewMode;
  label: string;
  description: string;
  productRole: 'primary' | 'supporting' | 'secondary';
}

export interface DocumentationTeamFolder {
  teamId: string;
  teamLabel: string;
  parentTeamId: string | null;
  rootAgentId: string | null;
  path: string;
  agentUnitIds: string[];
  childTeamIds: string[];
}

export interface DocumentationAgentUnit {
  unitId: string;
  stableIdentityId: string;
  teamId: string;
  teamLabel: string;
  agentId: string;
  agentLabel: string;
  agentRole: TeamsNodeType;
  parentTeamId: string | null;
  parentAgentId: string | null;
  treeParentUnitId: string | null;
  path: string;
  createdAt: string;
  updatedAt: string;
  historical: boolean;
  lifecycleStage: 'current' | 'historical-worker-stage';
}

export interface DocumentationManifestBase {
  manifest_id: string;
  team_id: string;
  team_label: string;
  agent_id: string | null;
  agent_label: string | null;
  agent_role: string | null;
  parent_team_id: string | null;
  parent_agent_id: string | null;
  created_at: string;
  updated_at: string;
  origin_workspace: DocumentationOriginWorkspace;
  status: DocumentationManifestStatus;
  record_class: DocumentationRecordClass;
  sensitivity_level: DocumentationSensitivityLevel;
  retention_rule: string;
  official_copy: boolean;
  path: string;
  checksum: string;
  related_audit_events: string[];
}

export interface DocumentationTeamManifest extends DocumentationManifestBase {
  kind: 'team';
  team_folder_id: string;
}

export interface DocumentationAgentManifest extends DocumentationManifestBase {
  kind: 'agent';
  agent_unit_id: string;
  stable_identity_id: string;
  visible_label: string;
}

export interface DocumentationIndexEntry {
  id: string;
  entryKind: 'team' | 'agent' | 'file';
  teamId: string;
  teamLabel: string;
  agentId: string | null;
  agentLabel: string | null;
  agentRole: string | null;
  eventId: string | null;
  date: string | null;
  status: string;
  origin: string | null;
  destination: string | null;
  auditEventIds: string[];
  path: string;
  relatedFileId?: string;
}

export type DocumentationAuditEventKind =
  | 'created'
  | 'updated'
  | 'state-changed'
  | 'locked'
  | 'unlocked'
  | 'version-advanced';
export type DocumentationKnowledgeNodeType =
  | 'document'
  | 'project'
  | 'team'
  | 'workspace'
  | 'document-type';
export type DocumentationKnowledgeEdgeType =
  | 'belongs-to'
  | 'created-in'
  | 'linked-to-team'
  | 'linked-to-workspace'
  | 'typed-as'
  | 'linked-to-audit';

export interface DocumentationAuditEntry {
  id: string;
  repositoryItemId: string;
  documentTitle: string;
  eventKind: DocumentationAuditEventKind;
  eventLabel: string;
  teamId: string;
  teamLabel: string;
  projectLabel: string | null;
  documentKind: string | null;
  userLabel: string | null;
  responsibleLabel: string | null;
  occurredAt: string | null;
  documentState: DocumentationDocumentState | null;
  documentVersion: string | null;
  sourceWorkspace: DocumentationOriginWorkspace;
  recordClass: string;
  path: string;
  auditEventIds: string[];
  relatedFileId?: string;
}

export interface DocumentationKnowledgeNode {
  id: string;
  nodeType: DocumentationKnowledgeNodeType;
  label: string;
  description: string | null;
  repositoryItemId: string | null;
  projectLabel: string | null;
  teamId: string | null;
  teamLabel: string | null;
  workspaceLabel: string | null;
  documentKind: string | null;
  documentState: DocumentationDocumentState | null;
  documentVersion: string | null;
  userLabel: string | null;
  lastResponsible: string | null;
  updatedAt: string | null;
  auditLinked: boolean;
  relatedFileId?: string;
}

export interface DocumentationKnowledgeEdge {
  id: string;
  sourceId: string;
  targetId: string;
  edgeType: DocumentationKnowledgeEdgeType;
  label: string;
}

export interface DocumentationRepositoryItem {
  id: string;
  itemType: 'team-folder' | 'agent-unit' | 'file' | 'workspace-agent';
  title: string;
  teamId: string;
  teamLabel: string;
  projectLabel: string | null;
  documentKind: string | null;
  userLabel: string | null;
  ownerLabel: string | null;
  ownerRole: string | null;
  status: string;
  updatedAt: string | null;
  recordClass: string;
  path: string;
  sourceWorkspace: DocumentationOriginWorkspace;
  sourceConversationLabel: string | null;
  auditEventIds: string[];
  versionCount: number | null;
  lockState: boolean | null;
  checkpointLabel: string | null;
  documentState: DocumentationDocumentState | null;
  documentVersion: string | null;
  lastResponsible: string | null;
  relatedFileId?: string;
}

export interface DocumentationModeModel {
  root: DocumentationRepositoryRoot;
  views: DocumentationViewDefinition[];
  primaryView: DocumentationViewMode;
  teamFolders: DocumentationTeamFolder[];
  agentUnits: DocumentationAgentUnit[];
  teamManifests: DocumentationTeamManifest[];
  agentManifests: DocumentationAgentManifest[];
  indexEntries: DocumentationIndexEntry[];
  repositoryItems: DocumentationRepositoryItem[];
  auditEntries: DocumentationAuditEntry[];
  knowledgeMap: {
    nodes: DocumentationKnowledgeNode[];
    edges: DocumentationKnowledgeEdge[];
  };
  compatibility: {
    auditLog: true;
    calendarMode: true;
    complianceReady: true;
    dataSafetyReady: true;
  };
}

export interface CalendarEvent {
  id: string;
  projectId: string;
  agent: AgentRole;
  sourceLabel?: string;
  teamId?: string;
  teamLabel?: string;
  userLabel?: string;
  actorLabel?: string;
  managerLabel?: string;
  workerLabel?: string;
  actionLabel?: string;
  outputLabel?: string;
  phaseState?: WorkPhaseState;
  fileId: string;
  title: string;
  date: string;
  time: string;
  versionId?: string;
  versionSource?: WorkspaceVersionSource;
  versionThreadId?: string;
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
  phaseState?: WorkPhaseState;
  documentationHistory?: {
    historicalWorkerLabel?: string | null;
  };
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
  phaseState?: WorkPhaseState;
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

export interface WorkspaceVersion {
  id: string;
  versionNumber: number;
  savedAt: string;
  label?: string;
  messageCount: number;
  locked: boolean;
  draft: string;
  snapshotContent: string;
}

export interface WorkspaceVersionReference {
  source: WorkspaceVersionSource;
  versionId: string;
  threadId: string;
  agent?: AgentRole;
  teamId?: string;
}

export interface AuditAnswerRoutingTarget {
  id: string;
  kind: AuditAnswerRoutingTargetKind;
  label: string;
  page: Page;
  sourceArea: 'main-workspace' | 'team-workspace' | 'cross-verification';
  teamId?: string;
  teamLabel?: string;
  workspace?: SecondaryWorkspaceTarget | null;
  agentRole?: AgentRole;
  workerId?: string;
}

export interface ReviewForwardTargetOption {
  id: string;
  label: string;
  kind: ReviewForwardTargetKind;
  agentRole?: AgentRole;
  teamId?: string;
  workerId?: string;
}

export interface AuditAnswerPayload {
  sourcePage: Page;
  sourceWorkspace: SecondaryWorkspaceTarget | null;
  sourceArea: 'main-workspace' | 'team-workspace';
  sourceAgentId: string;
  sourceAgentLabel: string;
  sourceAgentType: AuditAnswerSourceAgentType;
  sourceTeamId: string;
  sourceTeamLabel: string;
  sourceReturnTarget: AuditAnswerRoutingTarget;
  sourcePrimarySubManagerTarget?: AuditAnswerRoutingTarget | null;
  sourceGeneralManagerTarget?: AuditAnswerRoutingTarget | null;
  contentType: AuditAnswerContentType;
  selectedCount: number;
  messageIds: string[];
  content: string;
}

export interface AppState {
  currentPage: Page;
  projectName: string;
  userName: string;
  messages: Record<AgentRole, Message[]>;
  selectedMessages: Record<AgentRole, string[]>;
  drafts: Record<AgentRole, string>;
  documentLocks: Record<AgentRole, boolean>;
  workspaceVersions: Record<AgentRole, WorkspaceVersion[]>;
  documentationRoot: DocumentationRepositoryRoot;
  projects: Project[];
  savedFiles: SavedFile[];
  calendarEvents: CalendarEvent[];
  workerRoles: {
    worker1: string;
    worker2: string;
  };
  workerConfigs: WorkerConfig[];
  workspaceFocusAgent: AgentRole | null;
  secondaryWorkspace: SecondaryWorkspaceTarget | null;
  auditAnswerPayload: AuditAnswerPayload | null;
  crossVerificationDraft: string;
  selectedWorkspaceVersion: WorkspaceVersionReference | null;
}
