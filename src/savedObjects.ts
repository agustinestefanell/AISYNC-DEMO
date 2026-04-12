import type {
  ActivityLifecycleEvent,
  HandoffPackageObject,
  SavedObject,
  SavedObjectMessageRecord,
  SavedObjectStatus,
  SavedObjectStorageEntry,
  SavedObjectType,
} from './types';

function slugifyTag(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface AutomaticTagArgs {
  objectType: SavedObjectType;
  sourceWorkspace: string;
  sourceTeamId?: string | null;
  sourcePanelId?: string | null;
  status: SavedObjectStatus;
  savePurpose?: string | null;
  extraTags?: string[];
}

export function buildAutomaticTags({
  objectType,
  sourceWorkspace,
  sourceTeamId,
  sourcePanelId,
  status,
  savePurpose,
  extraTags = [],
}: AutomaticTagArgs) {
  const tags = [
    `type:${slugifyTag(objectType)}`,
    `workspace:${slugifyTag(sourceWorkspace)}`,
    `status:${slugifyTag(status)}`,
    sourceTeamId ? `team:${slugifyTag(sourceTeamId)}` : null,
    sourcePanelId ? `panel:${slugifyTag(sourcePanelId)}` : null,
    savePurpose ? `purpose:${slugifyTag(savePurpose)}` : null,
    ...extraTags,
  ].filter((value): value is string => Boolean(value));

  return Array.from(new Set(tags));
}

function slugifyStoragePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getStorageDirectory(savedObject: SavedObject) {
  const workspace = slugifyStoragePart(savedObject.sourceWorkspace);
  const project = slugifyStoragePart(savedObject.projectId);
  const type = slugifyStoragePart(savedObject.objectType);
  return `saved_objects/${workspace}/${project}/${type}`;
}

export function buildSavedObjectBody(savedObject: SavedObject) {
  const header = [
    `# ${savedObject.title}`,
    '',
    `Object Type: ${savedObject.objectType}`,
    `Project: ${savedObject.projectLabel ?? savedObject.projectId}`,
    `Workspace: ${savedObject.sourceWorkspace}`,
    `Origin: ${savedObject.sourcePanelLabel}`,
    `Created By: ${savedObject.createdBy}`,
    `Created At: ${savedObject.createdAt}`,
    '',
  ];

  if (savedObject.objectType === 'saved-selection') {
    return [
      ...header,
      '## Selected Content',
      '',
      savedObject.payload.selectedMessages
        .map((message) => `### ${message.senderLabel} | ${message.timestamp}\n${message.content}`)
        .join('\n\n'),
      '',
    ].join('\n');
  }

  if (savedObject.objectType === 'checkpoint') {
    return [
      ...header,
      '## Checkpoint Snapshot',
      '',
      savedObject.payload.snapshotContent,
      '',
    ].join('\n');
  }

  if (savedObject.objectType === 'session-backup') {
    return [
      ...header,
      '## Session Backup',
      '',
      savedObject.payload.snapshotContent,
      '',
    ].join('\n');
  }

  if (savedObject.objectType === 'derived-document') {
    return [...header, '## Derived Document', '', savedObject.payload.content, ''].join('\n');
  }

  if (savedObject.objectType === 'handoff-package') {
    return [
      ...header,
      '## Handoff Objective',
      '',
      savedObject.payload.objective,
      '',
      '## Minimum Context',
      '',
      savedObject.payload.minimumContext,
      '',
      '## Origin',
      '',
      `${savedObject.payload.origin.panelLabel} | ${savedObject.payload.origin.teamLabel ?? savedObject.payload.origin.workspace}`,
      '',
      '## Destination',
      '',
      `${savedObject.payload.destination.panelLabel} | ${savedObject.payload.destination.teamLabel ?? savedObject.payload.destination.workspace}`,
      '',
      '## Transferred Content',
      '',
      savedObject.payload.transferredMessages.length > 0
        ? savedObject.payload.transferredMessages
            .map((message) => `### ${message.senderLabel} | ${message.timestamp}\n${message.content}`)
            .join('\n\n')
        : savedObject.payload.transferredContent || 'No transferred content recorded.',
      '',
      savedObject.payload.riskNotes.length > 0
        ? `## Risk Notes\n\n- ${savedObject.payload.riskNotes.join('\n- ')}\n`
        : '## Risk Notes\n\nNo explicit risk notes recorded.\n',
      '',
      '## Continuity Expected',
      '',
      savedObject.payload.continuityExpected,
      '',
    ].join('\n');
  }

  if (savedObject.objectType === 'source-document-reference') {
    return [
      ...header,
      '## Source Reference',
      '',
      `Reference Title: ${savedObject.payload.referenceTitle}`,
      `Reference Path: ${savedObject.payload.referencePath}`,
      '',
    ].join('\n');
  }

  return header.join('\n');
}

export function createSavedObjectStorageEntry(savedObject: SavedObject): SavedObjectStorageEntry {
  const directory = getStorageDirectory(savedObject);
  const baseName = `${slugifyStoragePart(savedObject.title || savedObject.id)}__${savedObject.id}`;

  return {
    objectId: savedObject.id,
    objectType: savedObject.objectType,
    storageKey: `${directory}/${baseName}`,
    directory,
    bodyFileName: `${baseName}.md`,
    metaFileName: `${baseName}.meta.json`,
    bodyContent: buildSavedObjectBody(savedObject),
    metadata: savedObject,
    updatedAt: savedObject.updatedAt,
  };
}

export function restoreSavedObjectFromStorage(entry: SavedObjectStorageEntry) {
  return entry.metadata;
}

interface CreateHandoffPackageArgs {
  title: string;
  projectId: string;
  projectLabel: string;
  createdBy: string;
  sourceWorkspace: HandoffPackageObject['sourceWorkspace'];
  sourceTeamId: string | null;
  sourceTeamLabel: string | null;
  sourcePanelId: string;
  sourcePanelLabel: string;
  destinationWorkspace: HandoffPackageObject['sourceWorkspace'];
  destinationTeamId: string | null;
  destinationTeamLabel: string | null;
  destinationPanelId: string | null;
  destinationPanelLabel: string;
  transferredMessages: SavedObjectMessageRecord[];
  transferredContent: string;
  objective: string;
  minimumContext: string;
  linkedCheckpointId?: string | null;
  linkedSourceDocumentIds?: string[];
  linkedDerivedDocumentIds?: string[];
  linkedSourceObjectIds?: string[];
  riskNotes?: string[];
  continuityExpected?: string;
}

export function createHandoffPackageObject({
  title,
  projectId,
  projectLabel,
  createdBy,
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
  linkedCheckpointId = null,
  linkedSourceDocumentIds = [],
  linkedDerivedDocumentIds = [],
  linkedSourceObjectIds = [],
  riskNotes = [],
  continuityExpected = 'Destination should continue the work from this transferred context.',
}: CreateHandoffPackageArgs): HandoffPackageObject {
  const createdAt = new Date().toISOString();
  const objectId = `handoff_${Date.now()}`;
  const automaticTags = buildAutomaticTags({
    objectType: 'handoff-package',
    sourceWorkspace,
    sourceTeamId,
    sourcePanelId,
    status: 'active',
    savePurpose: 'formalize-operational-handoff',
    extraTags: [
      'action:handoff',
      `destination:${slugifyTag(destinationPanelId ?? destinationPanelLabel)}`,
      transferredMessages.length > 1 ? 'selection:multi-message' : 'selection:single-message',
      destinationWorkspace === 'cross-verification' ? 'flow:cross-verification' : '',
      linkedCheckpointId ? 'handoff:checkpoint-linked' : 'handoff:no-checkpoint',
    ],
  });

  return {
    id: objectId,
    objectType: 'handoff-package',
    title,
    createdAt,
    updatedAt: createdAt,
    sourceWorkspace,
    sourceTeamId,
    sourceTeamLabel,
    sourcePanelId,
    sourcePanelLabel,
    createdBy,
    projectId,
    projectLabel,
    provenance: {
      sourceObjectIds: linkedSourceObjectIds,
      messageIds: transferredMessages.map((message) => message.id),
      sourceVersionId: linkedCheckpointId,
      note: 'Formal handoff package created from selected workspace content.',
    },
    status: 'active',
    savePurpose: 'formalize-operational-handoff',
    automaticTags,
    userTags: [],
    payload: {
      handoffTitle: title,
      origin: {
        workspace: sourceWorkspace,
        teamId: sourceTeamId,
        teamLabel: sourceTeamLabel,
        panelId: sourcePanelId,
        panelLabel: sourcePanelLabel,
      },
      destination: {
        workspace: destinationWorkspace,
        teamId: destinationTeamId,
        teamLabel: destinationTeamLabel,
        panelId: destinationPanelId,
        panelLabel: destinationPanelLabel,
      },
      actor: createdBy,
      issuedAt: createdAt,
      objective,
      minimumContext,
      transferredMessageIds: transferredMessages.map((message) => message.id),
      transferredMessages,
      transferredContent,
      linkedCheckpointId,
      linkedSourceDocumentIds,
      linkedDerivedDocumentIds,
      linkedSourceObjectIds,
      riskNotes,
      continuityExpected,
    },
  };
}

interface CreateHandoffActivityEventArgs {
  handoff: HandoffPackageObject;
  actor: string;
}

export function createHandoffActivityEvent({
  handoff,
  actor,
}: CreateHandoffActivityEventArgs): ActivityLifecycleEvent {
  return {
    id: `activity_${Date.now()}`,
    eventType: 'handoff',
    createdAt: handoff.createdAt,
    actor,
    sourceWorkspace: handoff.sourceWorkspace,
    sourceTeamId: handoff.sourceTeamId,
    sourceTeamLabel: handoff.sourceTeamLabel,
    sourcePanelId: handoff.sourcePanelId,
    sourcePanelLabel: handoff.sourcePanelLabel,
    projectId: handoff.projectId,
    relatedObjectId: handoff.id,
    detail: `Handoff package created for ${handoff.payload.destination.panelLabel}`,
    metadata: {
      destinationWorkspace: handoff.payload.destination.workspace,
      destinationPanelLabel: handoff.payload.destination.panelLabel,
      transferredCount: handoff.payload.transferredMessages.length,
      linkedCheckpoint: Boolean(handoff.payload.linkedCheckpointId),
    },
  };
}
