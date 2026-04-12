import type {
  ActivityLifecycleEvent,
  AgentRole,
  CalendarEvent,
  CheckpointObject,
  DocumentationOriginWorkspace,
  WorkPhaseState,
  WorkspaceVersion,
  WorkspaceVersionSource,
} from './types';
import { buildAutomaticTags } from './savedObjects';

interface VersionMessageLike {
  senderLabel: string;
  content: string;
}

export function buildVersionSnapshotContent(messages: VersionMessageLike[]) {
  return messages.map((message) => `${message.senderLabel}: ${message.content}`).join('\n\n');
}

export function createWorkspaceVersion(
  messages: VersionMessageLike[],
  draft: string,
  locked: boolean,
  existingVersions: WorkspaceVersion[],
  label?: string,
): WorkspaceVersion {
  const savedAt = new Date().toISOString();
  const versionNumber = existingVersions.length + 1;

  return {
    id: `version_${savedAt}_${versionNumber}`,
    versionNumber,
    savedAt,
    label,
    messageCount: messages.length,
    locked,
    draft,
    snapshotContent: buildVersionSnapshotContent(messages),
  };
}

interface CheckpointSavedObjectArgs {
  version: WorkspaceVersion;
  projectId: string;
  projectLabel: string | null;
  createdBy: string;
  sourceWorkspace: DocumentationOriginWorkspace;
  sourceTeamId: string | null;
  sourceTeamLabel: string | null;
  sourcePanelId: string;
  sourcePanelLabel: string;
  threadId: string;
  threadLabel: string;
}

export function createCheckpointSavedObject({
  version,
  projectId,
  projectLabel,
  createdBy,
  sourceWorkspace,
  sourceTeamId,
  sourceTeamLabel,
  sourcePanelId,
  sourcePanelLabel,
  threadId,
  threadLabel,
}: CheckpointSavedObjectArgs): CheckpointObject {
  return {
    id: `checkpoint_${version.id}`,
    objectType: 'checkpoint',
    title: `${threadLabel} checkpoint`,
    createdAt: version.savedAt,
    updatedAt: version.savedAt,
    sourceWorkspace,
    sourceTeamId,
    sourceTeamLabel,
    sourcePanelId,
    sourcePanelLabel,
    createdBy,
    projectId,
    projectLabel,
    provenance: {
      sourceObjectIds: [],
      messageIds: [],
      sourceThreadId: threadId,
      sourceVersionId: version.id,
      note: 'Created from Save Version',
    },
    status: version.locked ? 'finalized' : 'active',
    savePurpose: 'create-operational-checkpoint',
    automaticTags: buildAutomaticTags({
      objectType: 'checkpoint',
      sourceWorkspace,
      sourceTeamId,
      sourcePanelId,
      status: version.locked ? 'finalized' : 'active',
      savePurpose: 'create-operational-checkpoint',
      extraTags: [
        'action:save-version',
        'checkpoint:operational',
        version.locked ? 'state:locked' : '',
        sourceWorkspace === 'cross-verification' ? 'flow:cross-verification' : '',
      ],
    }),
    userTags: [],
    payload: {
      threadId,
      threadLabel,
      versionNumber: version.versionNumber,
      messageCount: version.messageCount,
      locked: version.locked,
      draft: version.draft,
      snapshotContent: version.snapshotContent,
      legacyVersionId: version.id,
    },
  };
}

interface CheckpointActivityEventArgs {
  checkpoint: CheckpointObject;
  actor: string;
}

export function createCheckpointActivityEvent({
  checkpoint,
  actor,
}: CheckpointActivityEventArgs): ActivityLifecycleEvent {
  return {
    id: `activity_${checkpoint.id}`,
    eventType: 'save-version',
    createdAt: checkpoint.createdAt,
    actor,
    sourceWorkspace: checkpoint.sourceWorkspace,
    sourceTeamId: checkpoint.sourceTeamId,
    sourceTeamLabel: checkpoint.sourceTeamLabel,
    sourcePanelId: checkpoint.sourcePanelId,
    sourcePanelLabel: checkpoint.sourcePanelLabel,
    projectId: checkpoint.projectId,
    relatedObjectId: checkpoint.id,
    detail: `${checkpoint.title} created`,
    metadata: {
      versionNumber: checkpoint.payload.versionNumber,
      locked: checkpoint.payload.locked,
      messageCount: checkpoint.payload.messageCount,
    },
  };
}

export function formatWorkspaceVersionTimestamp(savedAt: string) {
  return new Date(savedAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

interface WorkspaceVersionEventArgs {
  version: WorkspaceVersion;
  projectId: string;
  agent: AgentRole;
  userLabel: string;
  sourceLabel: string;
  teamId: string;
  teamLabel: string;
  threadLabel: string;
  actorLabel: string;
  managerLabel: string;
  workerLabel?: string;
  versionSource: WorkspaceVersionSource;
  versionThreadId: string;
}

export function createWorkspaceVersionEvent({
  version,
  projectId,
  agent,
  userLabel,
  sourceLabel,
  teamId,
  teamLabel,
  threadLabel,
  actorLabel,
  managerLabel,
  workerLabel,
  versionSource,
  versionThreadId,
}: WorkspaceVersionEventArgs): CalendarEvent {
  const savedAt = new Date(version.savedAt);
  const phaseState: WorkPhaseState = version.locked ? 'Closed' : 'In Review';

  return {
    id: `version_event_${version.id}`,
    projectId,
    agent,
    sourceLabel,
    teamId,
    teamLabel,
    userLabel,
    actorLabel,
    managerLabel,
    workerLabel,
    actionLabel: 'Saved Chat Version',
    outputLabel: `${threadLabel} checkpoint`,
    phaseState,
    fileId: `workspace_version_${version.id}`,
    title: `Saved Chat Version | ${threadLabel} | Version ${version.versionNumber}`,
    date: version.savedAt.slice(0, 10),
    time: savedAt.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    versionId: version.id,
    versionSource,
    versionThreadId,
  };
}
