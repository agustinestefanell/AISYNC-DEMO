import type {
  ActivityLifecycleEvent,
  AgentRole,
  CalendarEvent,
  Project,
  SavedFile,
  SavedObject,
  WorkPhaseState,
  WorkspaceVersionReference,
} from './types';

export interface AuditLogEntry {
  id: string;
  sourceKind: 'activity' | 'legacy-calendar';
  eventType: string;
  createdAt: string;
  date: string;
  time: string;
  actionLabel: string;
  outputLabel: string;
  detail: string;
  actorLabel: string;
  userLabel: string;
  teamId: string | null;
  teamLabel: string;
  managerLabel: string;
  workerLabel: string | null;
  accentRole: AgentRole;
  phaseState: WorkPhaseState;
  sourceWorkspace: string;
  sourcePanelId: string;
  sourcePanelLabel: string;
  relatedObjectId: string | null;
  relatedObject: SavedObject | null;
  linkedFileId: string | null;
  linkedFile: SavedFile | null;
  projectId: string | null;
  projectLabel: string | null;
  versionReference: WorkspaceVersionReference | null;
}

function formatDateKey(value: string) {
  return value.slice(0, 10);
}

function formatTimeLabel(value: string) {
  return new Date(value).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function inferAccentRole({
  sourcePanelId,
  sourcePanelLabel,
  sourceWorkspace,
}: {
  sourcePanelId: string;
  sourcePanelLabel: string;
  sourceWorkspace: string;
}): AgentRole {
  const normalizedId = sourcePanelId.toLowerCase();
  const normalizedLabel = sourcePanelLabel.toLowerCase();

  if (normalizedId.includes('worker2') || normalizedLabel.includes('worker 2')) {
    return 'worker2';
  }

  if (normalizedId.includes('worker1') || normalizedLabel.includes('worker 1')) {
    return 'worker1';
  }

  if (sourceWorkspace === 'team-workspace' && !normalizedLabel.includes('sub-manager')) {
    return 'worker1';
  }

  return 'manager';
}

function getActivityActionLabel(event: ActivityLifecycleEvent, relatedObject: SavedObject | null) {
  if (event.eventType === 'save-version') return 'Saved Chat Version';
  if (event.eventType === 'save-selection') return 'Saved Selection';
  if (event.eventType === 'handoff') return 'Handoff Package Created';
  if (event.eventType === 'review-forward') return 'Review & Forward';
  if (event.eventType === 'resume') return 'Resume Work';
  if (event.eventType === 'lock') return 'Panel Locked';
  if (event.eventType === 'unlock') return 'Panel Unlocked';
  if (event.eventType === 'refresh') return 'Refresh Session';
  if (event.eventType === 'audit-ai-answer') return 'Audit AI Answer';
  return relatedObject?.title ?? event.detail;
}

function getActivityPhaseState(
  event: ActivityLifecycleEvent,
  relatedObject: SavedObject | null,
): WorkPhaseState {
  if (event.eventType === 'save-version' && relatedObject?.objectType === 'checkpoint') {
    return relatedObject.payload.locked ? 'Closed' : 'In Review';
  }

  if (event.eventType === 'handoff') return 'In Review';
  if (event.eventType === 'review-forward') return 'In Review';
  if (event.eventType === 'lock') return 'Closed';
  if (event.eventType === 'unlock') return 'Open';
  if (event.eventType === 'resume') return 'Open';
  return 'Open';
}

function getActivityOutputLabel(event: ActivityLifecycleEvent, relatedObject: SavedObject | null) {
  if (relatedObject?.title) {
    return relatedObject.title;
  }

  return event.detail;
}

function getVersionReference(relatedObject: SavedObject | null): WorkspaceVersionReference | null {
  if (!relatedObject || relatedObject.objectType !== 'checkpoint') {
    return null;
  }

  const threadId = relatedObject.payload.threadId;
  const isBaseMainThread =
    threadId === 'manager' || threadId === 'worker1' || threadId === 'worker2';
  const isTeamWorkspace = relatedObject.sourceWorkspace === 'team-workspace';

  return {
    source: isTeamWorkspace ? 'team' : 'main',
    versionId: relatedObject.payload.legacyVersionId,
    threadId,
    agent: !isTeamWorkspace && isBaseMainThread ? (threadId as WorkspaceVersionReference['agent']) : 'manager',
    teamId: isTeamWorkspace ? relatedObject.sourceTeamId ?? undefined : undefined,
    panelScope: !isTeamWorkspace && !isBaseMainThread ? threadId : undefined,
  };
}

function isCalendarEventCovered(
  event: CalendarEvent,
  activityEvents: ActivityLifecycleEvent[],
  savedObjectsById: Map<string, SavedObject>,
) {
  return activityEvents.some((activityEvent) => {
    if (activityEvent.relatedLegacyFileId && activityEvent.relatedLegacyFileId === event.fileId) {
      return true;
    }

    if (event.versionId && activityEvent.relatedObjectId) {
      const relatedObject = savedObjectsById.get(activityEvent.relatedObjectId);
      return (
        relatedObject?.objectType === 'checkpoint' &&
        relatedObject.payload.legacyVersionId === event.versionId
      );
    }

    return false;
  });
}

export function buildAuditLogEntries({
  activityEvents,
  savedObjects,
  savedFiles,
  calendarEvents,
  projects,
  userName,
}: {
  activityEvents: ActivityLifecycleEvent[];
  savedObjects: SavedObject[];
  savedFiles: SavedFile[];
  calendarEvents: CalendarEvent[];
  projects: Project[];
  userName: string;
}) {
  const savedObjectsById = new Map(savedObjects.map((savedObject) => [savedObject.id, savedObject]));
  const savedFilesById = new Map(savedFiles.map((file) => [file.id, file]));
  const projectsById = new Map(projects.map((project) => [project.id, project]));

  const activityEntries: AuditLogEntry[] = activityEvents.map((event) => {
    const relatedObject = event.relatedObjectId ? savedObjectsById.get(event.relatedObjectId) ?? null : null;
    const linkedFileId =
      event.relatedLegacyFileId ??
      (relatedObject?.objectType === 'saved-selection'
        ? relatedObject.payload.legacyFileId
        : null);
    const linkedFile = linkedFileId ? savedFilesById.get(linkedFileId) ?? null : null;
    const projectLabel = event.projectId ? projectsById.get(event.projectId)?.name ?? event.projectId : null;

    return {
      id: event.id,
      sourceKind: 'activity',
      eventType: event.eventType,
      createdAt: event.createdAt,
      date: formatDateKey(event.createdAt),
      time: formatTimeLabel(event.createdAt),
      actionLabel: getActivityActionLabel(event, relatedObject),
      outputLabel: getActivityOutputLabel(event, relatedObject),
      detail: event.detail,
      actorLabel: event.actor,
      userLabel: event.actor || userName,
      teamId: event.sourceTeamId,
      teamLabel: event.sourceTeamLabel ?? 'Main Workspace',
      managerLabel: event.sourceTeamLabel ?? 'AI General Manager',
      workerLabel:
        event.sourcePanelLabel.includes('Worker') || event.sourceWorkspace === 'team-workspace'
          ? event.sourcePanelLabel
          : null,
      accentRole: inferAccentRole({
        sourcePanelId: event.sourcePanelId,
        sourcePanelLabel: event.sourcePanelLabel,
        sourceWorkspace: event.sourceWorkspace,
      }),
      phaseState: getActivityPhaseState(event, relatedObject),
      sourceWorkspace: event.sourceWorkspace,
      sourcePanelId: event.sourcePanelId,
      sourcePanelLabel: event.sourcePanelLabel,
      relatedObjectId: event.relatedObjectId,
      relatedObject,
      linkedFileId,
      linkedFile,
      projectId: event.projectId,
      projectLabel,
      versionReference: getVersionReference(relatedObject),
    };
  });

  const legacyEntries: AuditLogEntry[] = calendarEvents
    .filter((event) => !isCalendarEventCovered(event, activityEvents, savedObjectsById))
    .map((event) => {
      const linkedFile = savedFilesById.get(event.fileId) ?? null;

      return {
        id: event.id,
        sourceKind: 'legacy-calendar',
        eventType: event.versionId ? 'save-version-legacy' : 'legacy-calendar',
        createdAt: `${event.date}T${event.time.length === 5 ? `${event.time}:00` : event.time}`,
        date: event.date,
        time: event.time,
        actionLabel: event.actionLabel ?? 'Audit event logged',
        outputLabel: event.outputLabel ?? event.title,
        detail: event.title,
        actorLabel: event.actorLabel ?? event.sourceLabel ?? 'System',
        userLabel: event.userLabel ?? userName,
        teamId: event.teamId ?? null,
        teamLabel: event.teamLabel ?? 'Main Workspace',
        managerLabel: event.managerLabel ?? 'AI General Manager',
        workerLabel: event.workerLabel ?? null,
        accentRole: event.agent,
        phaseState: event.phaseState ?? 'Open',
        sourceWorkspace: event.teamId && event.teamId !== 'global' ? 'team-workspace' : 'main-workspace',
        sourcePanelId: event.versionThreadId ?? event.agent,
        sourcePanelLabel: event.sourceLabel ?? event.actorLabel ?? 'Legacy event',
        relatedObjectId: null,
        relatedObject: null,
        linkedFileId: event.fileId,
        linkedFile,
        projectId: event.projectId,
        projectLabel: projectsById.get(event.projectId)?.name ?? event.projectId,
        versionReference:
          event.versionId && event.versionSource && event.versionThreadId
            ? {
                source: event.versionSource,
                versionId: event.versionId,
                threadId: event.versionThreadId,
                agent: event.versionSource === 'main' ? event.agent : undefined,
                teamId: event.versionSource === 'team' ? event.teamId ?? undefined : undefined,
              }
            : null,
      };
    });

  return [...activityEntries, ...legacyEntries].sort(
    (left, right) => new Date(`${right.date}T${right.time}`).getTime() - new Date(`${left.date}T${left.time}`).getTime(),
  );
}
