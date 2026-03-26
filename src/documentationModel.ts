import type {
  AgentRole,
  DocumentationAuditEntry,
  DocumentationKnowledgeEdge,
  DocumentationKnowledgeNode,
  CalendarEvent,
  DocumentationAgentManifest,
  DocumentationAgentUnit,
  DocumentationIndexEntry,
  DocumentationModeModel,
  DocumentationRepositoryRoot,
  DocumentationRepositoryItem,
  DocumentationTeamFolder,
  DocumentationTeamManifest,
  DocumentationViewDefinition,
  Message,
  SavedFile,
  TeamsGraphNode,
  TeamsNodeType,
  WorkspaceVersion,
} from './types';

export interface DocumentationMirrorNode {
  id: string;
  kind: 'root' | 'folder' | 'team' | 'agent';
  label: string;
  path: string;
  roleLabel?: string;
  children: DocumentationMirrorNode[];
}

const DOCUMENTATION_MODE_VIEWS: DocumentationViewDefinition[] = [
  {
    mode: 'repository',
    label: 'Repository View',
    description: 'Primary operating view for retrieval, document access, and metadata-first work.',
    productRole: 'primary',
  },
  {
    mode: 'structure',
    label: 'Structure View',
    description: 'Hierarchical provenance view based on the documentary mirror of Teams.',
    productRole: 'supporting',
  },
  {
    mode: 'audit',
    label: 'Audit View',
    description: 'Traceability view for documents, events, movements, and responsibilities.',
    productRole: 'supporting',
  },
  {
    mode: 'investigate',
    label: 'Investigate View',
    description: 'Thematic and chronological access for contextual investigation.',
    productRole: 'supporting',
  },
  {
    mode: 'knowledge-map',
    label: 'Knowledge Map',
    description: 'Secondary analytical layer for relations, clusters, and documentary gaps.',
    productRole: 'secondary',
  },
];

function getMainWorkspaceAgentLabel(
  agent: AgentRole,
  messages: Record<AgentRole, Message[]>,
) {
  const firstLabel = messages[agent][0]?.senderLabel?.trim();
  if (firstLabel) {
    return firstLabel;
  }

  if (agent === 'manager') return 'AI General Manager';
  if (agent === 'worker1') return 'Worker 1';
  return 'Worker 2';
}

function normalizeVersionBase(title: string) {
  return title
    .replace(/[-_ ]v\d+$/i, '')
    .replace(/^\d{4}-\d{2}-\d{2}[_-]/, '')
    .trim()
    .toLowerCase();
}

function getDocumentVersionLabel(
  file: SavedFile,
  orderedFiles: SavedFile[],
) {
  const explicitVersion = file.title.match(/(?:^|[-_ ])v(\d+)$/i);
  if (explicitVersion) {
    return `v${explicitVersion[1]}`;
  }

  const relatedVersions = orderedFiles.filter(
    (candidate) =>
      candidate.projectId === file.projectId &&
      candidate.type === file.type &&
      normalizeVersionBase(candidate.title) === normalizeVersionBase(file.title),
  );

  const versionIndex = relatedVersions.findIndex((candidate) => candidate.id === file.id);
  return `v${Math.max(1, versionIndex + 1)}`;
}

function getDocumentState(file: SavedFile) {
  if (file.phaseState === 'Closed' && file.type === 'Report') {
    return 'Locked' as const;
  }

  if (file.phaseState === 'Closed') {
    return 'Approved' as const;
  }

  if (file.phaseState === 'In Review') {
    return 'Under Review' as const;
  }

  if (file.type === 'Conversation') {
    return 'In Progress' as const;
  }

  return 'Draft' as const;
}

function getCalendarEventTimestamp(event: CalendarEvent) {
  return `${event.date}T${event.time || '00:00'}`;
}

function getAuditEventKind(
  event: CalendarEvent,
  file: SavedFile,
): DocumentationAuditEntry['eventKind'] {
  if (event.versionId || event.versionSource) {
    return 'version-advanced';
  }

  if (file.type === 'Report' && event.phaseState === 'Closed') {
    return 'locked';
  }

  if (event.phaseState === 'In Review' || event.phaseState === 'Closed') {
    return 'state-changed';
  }

  return 'updated';
}

function getAuditEventLabel(kind: DocumentationAuditEntry['eventKind']) {
  if (kind === 'created') return 'Created / first indexed';
  if (kind === 'updated') return 'Updated';
  if (kind === 'state-changed') return 'State changed';
  if (kind === 'locked') return 'Locked';
  if (kind === 'unlocked') return 'Unlocked';
  return 'Version advanced';
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unnamed';
}

function joinPath(...segments: string[]) {
  return segments
    .filter(Boolean)
    .map((segment, index) => {
      if (index === 0) {
        return segment.replace(/[\\/]+$/g, '');
      }
      return segment.replace(/^[\\/]+|[\\/]+$/g, '');
    })
    .join('/');
}

function getDocumentationRole(nodeType: TeamsNodeType) {
  if (nodeType === 'general_manager') return 'general_manager';
  if (nodeType === 'senior_manager') return 'sub_manager';
  return 'worker';
}

function isPromotedSubManagerNode(node: TeamsGraphNode) {
  return node.type === 'senior_manager' && node.parentId !== 'gm_1';
}

function getNodeDepth(node: TeamsGraphNode, nodesById: Map<string, TeamsGraphNode>) {
  let depth = 0;
  let currentParentId = node.parentId;

  while (currentParentId && currentParentId !== 'gm_1') {
    const parentNode = nodesById.get(currentParentId);
    if (!parentNode) {
      break;
    }

    depth += 1;
    currentParentId = parentNode.parentId;
  }

  return depth;
}

function buildChecksum(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return `chk_${hash.toString(16).padStart(8, '0')}`;
}

function getTopLevelDocumentationTeams(teamsGraph: TeamsGraphNode[]) {
  return teamsGraph.filter((node) => node.parentId === 'gm_1' && node.type !== 'general_manager');
}

export function buildDocumentationModeModel({
  root,
  teamsGraph,
  savedFiles,
  calendarEvents,
  mainWorkspace,
}: {
  root: DocumentationRepositoryRoot;
  teamsGraph: TeamsGraphNode[];
  savedFiles: SavedFile[];
  calendarEvents: CalendarEvent[];
  mainWorkspace: {
    projectName: string;
    userName: string;
    messages: Record<AgentRole, Message[]>;
    workspaceVersions: Record<AgentRole, WorkspaceVersion[]>;
    documentLocks: Record<AgentRole, boolean>;
  };
}): DocumentationModeModel {
  const now = new Date().toISOString();
  const topLevelTeams = getTopLevelDocumentationTeams(teamsGraph);
  const nodesById = new Map(teamsGraph.map((node) => [node.id, node]));
  const teamRootsByTeamId = new Map(topLevelTeams.map((node) => [node.teamId, node]));

  const teamFolders: DocumentationTeamFolder[] = topLevelTeams.map((node) => ({
    teamId: node.teamId,
    teamLabel: node.label,
    parentTeamId: node.parentId && node.parentId !== 'gm_1' ? nodesById.get(node.parentId)?.teamId ?? null : null,
    rootAgentId: node.id,
    path: joinPath(root.path, 'teams', `${slugify(node.label)}__${node.teamId}`),
    agentUnitIds: [],
    childTeamIds: [],
  }));

  const teamFoldersByTeamId = new Map(teamFolders.map((folder) => [folder.teamId, folder]));
  const agentUnitsById = new Map<string, DocumentationAgentUnit>();
  const currentUnitIdByNodeId = new Map<string, string>();

  const buildAgentUnitPath = (
    node: TeamsGraphNode,
    role: TeamsNodeType,
    lifecycleStage: DocumentationAgentUnit['lifecycleStage'],
  ): string => {
    const teamFolder = teamFoldersByTeamId.get(node.teamId);
    const parentNode = node.parentId ? nodesById.get(node.parentId) ?? null : null;
    const roleSlug = role === 'senior_manager' ? 'sub-manager' : role;
    const stageSuffix = lifecycleStage === 'historical-worker-stage' ? '__historical' : '';
    const unitFolderName = `${slugify(node.label)}__${node.id}__${roleSlug}${stageSuffix}`;

    if (!teamFolder) {
      return joinPath(root.path, 'teams', `orphan__${node.teamId}`, unitFolderName);
    }

    if (!parentNode || parentNode.id === 'gm_1' || parentNode.teamId !== node.teamId) {
      return joinPath(teamFolder.path, unitFolderName);
    }

    const parentUnitId = currentUnitIdByNodeId.get(parentNode.id);
    const parentUnit = parentUnitId ? agentUnitsById.get(parentUnitId) ?? null : null;
    return joinPath(parentUnit?.path ?? teamFolder.path, unitFolderName);
  };

  const orderedNodes = teamsGraph
    .filter((node) => node.type !== 'general_manager')
    .sort((left, right) => {
      const leftDepth = getNodeDepth(left, nodesById);
      const rightDepth = getNodeDepth(right, nodesById);
      if (leftDepth !== rightDepth) {
        return leftDepth - rightDepth;
      }
      return left.label.localeCompare(right.label);
    });

  orderedNodes.forEach((node) => {
    const teamFolder = teamFoldersByTeamId.get(node.teamId);
    const parentTeamId =
      node.parentId && node.parentId !== 'gm_1' ? nodesById.get(node.parentId)?.teamId ?? null : null;
    const parentAgentId = node.parentId && node.parentId !== 'gm_1' ? node.parentId : null;
    const treeParentUnitId = parentAgentId ? currentUnitIdByNodeId.get(parentAgentId) ?? null : null;

    if (isPromotedSubManagerNode(node)) {
      const historicalUnitId = `${node.id}:worker-history`;
      const historicalWorkerLabel = node.documentationHistory?.historicalWorkerLabel?.trim() || node.label;
      const historicalWorkerUnit: DocumentationAgentUnit = {
        unitId: historicalUnitId,
        stableIdentityId: node.id,
        teamId: node.teamId,
        teamLabel: teamRootsByTeamId.get(node.teamId)?.label ?? node.label,
        agentId: node.id,
        agentLabel: historicalWorkerLabel,
        agentRole: 'worker',
        parentTeamId,
        parentAgentId,
        treeParentUnitId,
        path: buildAgentUnitPath(node, 'worker', 'historical-worker-stage'),
        createdAt: now,
        updatedAt: now,
        historical: true,
        lifecycleStage: 'historical-worker-stage',
      };

      const currentSubManagerUnitId = `${node.id}:senior_manager`;
      const currentSubManagerUnit: DocumentationAgentUnit = {
        unitId: currentSubManagerUnitId,
        stableIdentityId: node.id,
        teamId: node.teamId,
        teamLabel: teamRootsByTeamId.get(node.teamId)?.label ?? node.label,
        agentId: node.id,
        agentLabel: node.label,
        agentRole: 'senior_manager',
        parentTeamId,
        parentAgentId,
        treeParentUnitId,
        path: buildAgentUnitPath(node, 'senior_manager', 'current'),
        createdAt: now,
        updatedAt: now,
        historical: false,
        lifecycleStage: 'current',
      };

      agentUnitsById.set(historicalUnitId, historicalWorkerUnit);
      agentUnitsById.set(currentSubManagerUnitId, currentSubManagerUnit);
      currentUnitIdByNodeId.set(node.id, currentSubManagerUnitId);
      if (teamFolder) {
        teamFolder.agentUnitIds.push(historicalUnitId, currentSubManagerUnitId);
      }
      return;
    }

    const unitId = `${node.id}:${node.type}`;
    const agentUnit: DocumentationAgentUnit = {
      unitId,
      stableIdentityId: node.id,
      teamId: node.teamId,
      teamLabel: teamRootsByTeamId.get(node.teamId)?.label ?? node.label,
      agentId: node.id,
      agentLabel: node.label,
      agentRole: node.type,
      parentTeamId,
      parentAgentId,
      treeParentUnitId,
      path: buildAgentUnitPath(node, node.type, 'current'),
      createdAt: now,
      updatedAt: now,
      historical: false,
      lifecycleStage: 'current',
    };

    agentUnitsById.set(unitId, agentUnit);
    currentUnitIdByNodeId.set(node.id, unitId);
    if (teamFolder) {
      teamFolder.agentUnitIds.push(unitId);
    }
  });

  const teamManifests: DocumentationTeamManifest[] = teamFolders.map((folder) => ({
    kind: 'team',
    manifest_id: `manifest_team_${folder.teamId}`,
    team_folder_id: folder.teamId,
    team_id: folder.teamId,
    team_label: folder.teamLabel,
    agent_id: null,
    agent_label: null,
    agent_role: null,
    parent_team_id: folder.parentTeamId,
    parent_agent_id: folder.rootAgentId,
    created_at: now,
    updated_at: now,
    origin_workspace: 'documentation-mode',
    status: 'active',
    record_class: 'team-record',
    sensitivity_level: 'internal',
    retention_rule: 'retain-until-policy-defined',
    official_copy: false,
    path: joinPath(folder.path, '_manifest', 'team.manifest.json'),
    checksum: buildChecksum(`${folder.teamId}|${folder.path}`),
    related_audit_events: calendarEvents
      .filter((event) => event.teamId === folder.teamId)
      .map((event) => event.id),
  }));

  const agentManifests: DocumentationAgentManifest[] = Array.from(agentUnitsById.values()).map((unit) => ({
    kind: 'agent',
    manifest_id: `manifest_agent_${unit.unitId}`,
    agent_unit_id: unit.unitId,
    stable_identity_id: unit.stableIdentityId,
    visible_label: unit.agentLabel,
    team_id: unit.teamId,
    team_label: unit.teamLabel,
    agent_id: unit.agentId,
    agent_label: unit.agentLabel,
    agent_role: getDocumentationRole(unit.agentRole),
    parent_team_id: unit.parentTeamId,
    parent_agent_id: unit.parentAgentId,
    created_at: unit.createdAt,
    updated_at: unit.updatedAt,
    origin_workspace: unit.agentRole === 'worker' ? 'team-workspace' : 'documentation-mode',
    status: unit.historical ? 'archived' : 'active',
    record_class: 'agent-record',
    sensitivity_level: 'internal',
    retention_rule: 'retain-until-policy-defined',
    official_copy: false,
    path: joinPath(unit.path, '_manifest', 'agent.manifest.json'),
    checksum: buildChecksum(`${unit.unitId}|${unit.path}`),
    related_audit_events: calendarEvents
      .filter((event) => event.teamId === unit.teamId && (event.workerLabel === unit.agentLabel || event.actorLabel === unit.agentLabel))
      .map((event) => event.id),
  }));

  const teamIndexEntries: DocumentationIndexEntry[] = teamFolders.map((folder) => ({
    id: `idx_team_${folder.teamId}`,
    entryKind: 'team',
    teamId: folder.teamId,
    teamLabel: folder.teamLabel,
    agentId: null,
    agentLabel: null,
    agentRole: null,
    eventId: null,
    date: null,
    status: 'active',
    origin: 'documentation-mode',
    destination: null,
    auditEventIds: calendarEvents.filter((event) => event.teamId === folder.teamId).map((event) => event.id),
    path: folder.path,
  }));

  const agentIndexEntries: DocumentationIndexEntry[] = Array.from(agentUnitsById.values()).map((unit) => ({
    id: `idx_agent_${unit.unitId}`,
    entryKind: 'agent',
    teamId: unit.teamId,
    teamLabel: unit.teamLabel,
    agentId: unit.agentId,
    agentLabel: unit.agentLabel,
    agentRole: getDocumentationRole(unit.agentRole),
    eventId: null,
    date: unit.updatedAt.slice(0, 10),
    status: unit.historical ? 'historical' : 'active',
    origin: getDocumentationRole(unit.agentRole),
    destination: unit.parentAgentId,
    auditEventIds: calendarEvents
      .filter((event) => event.teamId === unit.teamId && (event.actorLabel === unit.agentLabel || event.workerLabel === unit.agentLabel))
      .map((event) => event.id),
    path: unit.path,
  }));

  const fileIndexEntries: DocumentationIndexEntry[] = savedFiles.map((file) => {
    const relatedEvent = calendarEvents.find((event) => event.fileId === file.id) ?? null;
    const teamId = relatedEvent?.teamId ?? 'main-workspace';
    const teamLabel = relatedEvent?.teamLabel ?? 'Main Workspace';
    return {
      id: `idx_file_${file.id}`,
      entryKind: 'file',
      teamId,
      teamLabel,
      agentId: null,
      agentLabel: file.sourceLabel ?? null,
      agentRole: file.agent,
      eventId: relatedEvent?.id ?? null,
      date: file.createdAt.slice(0, 10),
      status: file.phaseState ?? 'Open',
      origin: file.sourceLabel ?? file.agent,
      destination: relatedEvent?.managerLabel ?? null,
      auditEventIds: relatedEvent ? [relatedEvent.id] : [],
      path: joinPath(root.path, 'projects', `${slugify(file.projectId)}__${file.id}`),
      relatedFileId: file.id,
    };
  });

  const teamRepositoryItems: DocumentationRepositoryItem[] = teamFolders.map((folder) => ({
    id: `repo_team_${folder.teamId}`,
    itemType: 'team-folder',
    title: folder.teamLabel,
    teamId: folder.teamId,
    teamLabel: folder.teamLabel,
    projectLabel: null,
    documentKind: null,
    userLabel: null,
    ownerLabel: folder.teamLabel,
    ownerRole: 'team',
    status: 'active',
    updatedAt: now,
    recordClass: 'team-record',
    path: folder.path,
    sourceWorkspace: 'documentation-mode',
    sourceConversationLabel: null,
    auditEventIds: calendarEvents.filter((event) => event.teamId === folder.teamId).map((event) => event.id),
    versionCount: null,
    lockState: null,
    checkpointLabel: null,
    documentState: null,
    documentVersion: null,
    lastResponsible: null,
  }));

  const agentRepositoryItems: DocumentationRepositoryItem[] = Array.from(agentUnitsById.values()).map((unit) => ({
    id: `repo_agent_${unit.unitId}`,
    itemType: 'agent-unit',
    title: unit.agentLabel,
    teamId: unit.teamId,
    teamLabel: unit.teamLabel,
    projectLabel: null,
    documentKind: null,
    userLabel: null,
    ownerLabel: unit.agentLabel,
    ownerRole: getDocumentationRole(unit.agentRole),
    status: unit.historical ? 'historical' : 'active',
    updatedAt: unit.updatedAt,
    recordClass: 'agent-record',
    path: unit.path,
    sourceWorkspace: unit.agentRole === 'worker' ? 'team-workspace' : 'documentation-mode',
    sourceConversationLabel: null,
    auditEventIds: calendarEvents
      .filter((event) => event.teamId === unit.teamId && (event.actorLabel === unit.agentLabel || event.workerLabel === unit.agentLabel))
      .map((event) => event.id),
    versionCount: null,
    lockState: null,
    checkpointLabel: null,
    documentState: null,
    documentVersion: null,
    lastResponsible: null,
  }));

  const orderedFiles = [...savedFiles].sort(
    (left, right) =>
      (left.createdAt ?? '').localeCompare(right.createdAt ?? '') || left.id.localeCompare(right.id),
  );

  const fileRepositoryItems: DocumentationRepositoryItem[] = orderedFiles.map((file) => {
    const relatedEvent = calendarEvents.find((event) => event.fileId === file.id) ?? null;
    const documentState = getDocumentState(file);
    const documentVersion = getDocumentVersionLabel(file, orderedFiles);
    const sourceOwner = file.sourceLabel ?? getMainWorkspaceAgentLabel(file.agent, mainWorkspace.messages);
    const userLabel = relatedEvent?.userLabel ?? mainWorkspace.userName;

    return {
      id: `repo_file_${file.id}`,
      itemType: 'file',
      title: file.title,
      teamId: relatedEvent?.teamId ?? 'main-workspace',
      teamLabel: relatedEvent?.teamLabel ?? 'Main Workspace',
      projectLabel: file.projectId,
      documentKind: file.type,
      userLabel,
      ownerLabel: sourceOwner,
      ownerRole: file.agent,
      status: documentState,
      updatedAt: file.createdAt,
      recordClass: 'working-record',
      path: joinPath(root.path, 'projects', `${slugify(file.projectId)}__${file.id}`),
      sourceWorkspace: relatedEvent?.teamId ? 'team-workspace' : 'main-workspace',
      sourceConversationLabel: file.type === 'Conversation' ? file.title : null,
      auditEventIds: relatedEvent ? [relatedEvent.id] : [],
      versionCount: Number(documentVersion.replace(/^v/i, '')),
      lockState: documentState === 'Locked',
      checkpointLabel:
        documentState === 'Approved' || documentState === 'Locked'
          ? 'Controlled working copy'
          : null,
      documentState,
      documentVersion,
      lastResponsible: sourceOwner,
      relatedFileId: file.id,
    };
  });

  const mainWorkspaceRepositoryItems: DocumentationRepositoryItem[] = (['manager', 'worker1', 'worker2'] as const).map(
    (agent) => {
      const messages = mainWorkspace.messages[agent];
      const versions = mainWorkspace.workspaceVersions[agent];
      const latestVersion = versions[versions.length - 1] ?? null;
      const latestTimestamp = messages[messages.length - 1]?.timestamp ?? latestVersion?.savedAt ?? now;
      const label = getMainWorkspaceAgentLabel(agent, mainWorkspace.messages);
      const ownerRole =
        agent === 'manager' ? 'general_manager' : 'main_workspace_worker';

      return {
        id: `repo_main_${agent}`,
        itemType: 'workspace-agent',
        title: label,
        teamId: 'main-workspace',
        teamLabel: 'Main Workspace',
        projectLabel: mainWorkspace.projectName,
        documentKind: null,
        userLabel: mainWorkspace.userName,
        ownerLabel: label,
        ownerRole,
        status: mainWorkspace.documentLocks[agent] ? 'locked' : 'active',
        updatedAt: latestTimestamp,
        recordClass: 'working-record',
        path: joinPath(root.path, 'main-workspace', agent),
        sourceWorkspace: 'main-workspace',
        sourceConversationLabel: messages[0]?.content ? 'Main workspace conversation thread' : null,
        auditEventIds: calendarEvents
          .filter((event) => !event.teamId && event.agent === agent)
          .map((event) => event.id),
        versionCount: versions.length,
        lockState: mainWorkspace.documentLocks[agent],
        checkpointLabel: latestVersion ? `Version ${latestVersion.versionNumber}` : null,
        documentState: null,
        documentVersion: null,
        lastResponsible: label,
      };
    },
  );

  const auditEntries: DocumentationAuditEntry[] = fileRepositoryItems.flatMap((item) => {
    const file = orderedFiles.find((candidate) => candidate.id === item.relatedFileId);
    if (!file) {
      return [];
    }

    const relatedEvents = calendarEvents
      .filter((event) => event.fileId === file.id)
      .sort((left, right) => getCalendarEventTimestamp(left).localeCompare(getCalendarEventTimestamp(right)));

    const createdEntry: DocumentationAuditEntry = {
      id: `audit_created_${file.id}`,
      repositoryItemId: item.id,
      documentTitle: item.title,
      eventKind: 'created',
      eventLabel: getAuditEventLabel('created'),
      teamId: item.teamId,
      teamLabel: item.teamLabel,
      projectLabel: item.projectLabel,
      documentKind: item.documentKind,
      userLabel: item.userLabel,
      responsibleLabel: item.lastResponsible,
      occurredAt: item.updatedAt,
      documentState: item.documentState,
      documentVersion: item.documentVersion,
      sourceWorkspace: item.sourceWorkspace,
      recordClass: item.recordClass,
      path: item.path,
      auditEventIds: item.auditEventIds,
      relatedFileId: item.relatedFileId,
    };

    const eventEntries = relatedEvents.map<DocumentationAuditEntry>((event) => {
      const eventKind = getAuditEventKind(event, file);
      return {
        id: `audit_${eventKind}_${event.id}`,
        repositoryItemId: item.id,
        documentTitle: item.title,
        eventKind,
        eventLabel: getAuditEventLabel(eventKind),
        teamId: item.teamId,
        teamLabel: item.teamLabel,
        projectLabel: item.projectLabel,
        documentKind: item.documentKind,
        userLabel: event.userLabel ?? item.userLabel,
        responsibleLabel: event.actorLabel ?? event.sourceLabel ?? item.lastResponsible,
        occurredAt: `${event.date} ${event.time}`,
        documentState: item.documentState,
        documentVersion: item.documentVersion,
        sourceWorkspace: item.sourceWorkspace,
        recordClass: item.recordClass,
        path: item.path,
        auditEventIds: [event.id],
        relatedFileId: item.relatedFileId,
      };
    });

    const hasVersionAdvanced = eventEntries.some((entry) => entry.eventKind === 'version-advanced');
    const hasLocked = eventEntries.some((entry) => entry.eventKind === 'locked');

    const supplementalEntries: DocumentationAuditEntry[] = [];

    if (item.documentVersion && item.documentVersion !== 'v1' && !hasVersionAdvanced) {
      supplementalEntries.push({
        id: `audit_version_${file.id}`,
        repositoryItemId: item.id,
        documentTitle: item.title,
        eventKind: 'version-advanced',
        eventLabel: getAuditEventLabel('version-advanced'),
        teamId: item.teamId,
        teamLabel: item.teamLabel,
        projectLabel: item.projectLabel,
        documentKind: item.documentKind,
        userLabel: item.userLabel,
        responsibleLabel: item.lastResponsible,
        occurredAt: item.updatedAt,
        documentState: item.documentState,
        documentVersion: item.documentVersion,
        sourceWorkspace: item.sourceWorkspace,
        recordClass: item.recordClass,
        path: item.path,
        auditEventIds: item.auditEventIds,
        relatedFileId: item.relatedFileId,
      });
    }

    if (item.documentState === 'Locked' && !hasLocked) {
      supplementalEntries.push({
        id: `audit_locked_${file.id}`,
        repositoryItemId: item.id,
        documentTitle: item.title,
        eventKind: 'locked',
        eventLabel: getAuditEventLabel('locked'),
        teamId: item.teamId,
        teamLabel: item.teamLabel,
        projectLabel: item.projectLabel,
        documentKind: item.documentKind,
        userLabel: item.userLabel,
        responsibleLabel: item.lastResponsible,
        occurredAt: item.updatedAt,
        documentState: item.documentState,
        documentVersion: item.documentVersion,
        sourceWorkspace: item.sourceWorkspace,
        recordClass: item.recordClass,
        path: item.path,
        auditEventIds: item.auditEventIds,
        relatedFileId: item.relatedFileId,
      });
    }

    return [createdEntry, ...eventEntries, ...supplementalEntries].sort((left, right) =>
      (right.occurredAt ?? '').localeCompare(left.occurredAt ?? ''),
    );
  });

  const knowledgeNodesById = new Map<string, DocumentationKnowledgeNode>();
  const knowledgeEdgesById = new Map<string, DocumentationKnowledgeEdge>();

  const registerKnowledgeNode = (node: DocumentationKnowledgeNode) => {
    if (!knowledgeNodesById.has(node.id)) {
      knowledgeNodesById.set(node.id, node);
    }
  };

  const registerKnowledgeEdge = (edge: DocumentationKnowledgeEdge) => {
    if (!knowledgeEdgesById.has(edge.id)) {
      knowledgeEdgesById.set(edge.id, edge);
    }
  };

  fileRepositoryItems.forEach((item) => {
    const documentNodeId = `knowledge:document:${item.id}`;
    const workspaceLabel =
      item.sourceWorkspace === 'main-workspace'
        ? 'Main Workspace'
        : item.sourceWorkspace === 'team-workspace'
          ? 'Team Workspace'
          : item.sourceWorkspace;

    registerKnowledgeNode({
      id: documentNodeId,
      nodeType: 'document',
      label: item.title,
      description: item.path,
      repositoryItemId: item.id,
      projectLabel: item.projectLabel,
      teamId: item.teamId,
      teamLabel: item.teamLabel,
      workspaceLabel,
      documentKind: item.documentKind,
      documentState: item.documentState,
      documentVersion: item.documentVersion,
      userLabel: item.userLabel,
      lastResponsible: item.lastResponsible,
      updatedAt: item.updatedAt,
      auditLinked: item.auditEventIds.length > 0,
      relatedFileId: item.relatedFileId,
    });

    if (item.projectLabel) {
      const projectNodeId = `knowledge:project:${slugify(item.projectLabel)}`;
      registerKnowledgeNode({
        id: projectNodeId,
        nodeType: 'project',
        label: item.projectLabel,
        description: 'Project context',
        repositoryItemId: null,
        projectLabel: item.projectLabel,
        teamId: null,
        teamLabel: null,
        workspaceLabel: null,
        documentKind: null,
        documentState: null,
        documentVersion: null,
        userLabel: null,
        lastResponsible: null,
        updatedAt: null,
        auditLinked: false,
      });
      registerKnowledgeEdge({
        id: `${documentNodeId}->${projectNodeId}:belongs-to`,
        sourceId: documentNodeId,
        targetId: projectNodeId,
        edgeType: 'belongs-to',
        label: 'belongs to',
      });
    }

    if (item.teamId && item.teamLabel) {
      const teamNodeId = `knowledge:team:${item.teamId}`;
      registerKnowledgeNode({
        id: teamNodeId,
        nodeType: 'team',
        label: item.teamLabel,
        description: 'Team context',
        repositoryItemId: null,
        projectLabel: item.projectLabel,
        teamId: item.teamId,
        teamLabel: item.teamLabel,
        workspaceLabel: null,
        documentKind: null,
        documentState: null,
        documentVersion: null,
        userLabel: null,
        lastResponsible: null,
        updatedAt: null,
        auditLinked: false,
      });
      registerKnowledgeEdge({
        id: `${documentNodeId}->${teamNodeId}:linked-to-team`,
        sourceId: documentNodeId,
        targetId: teamNodeId,
        edgeType: 'linked-to-team',
        label: 'linked to team',
      });
    }

    const workspaceNodeId = `knowledge:workspace:${slugify(workspaceLabel)}`;
    registerKnowledgeNode({
      id: workspaceNodeId,
      nodeType: 'workspace',
      label: workspaceLabel,
      description: 'Workspace context',
      repositoryItemId: null,
      projectLabel: null,
      teamId: null,
      teamLabel: null,
      workspaceLabel,
      documentKind: null,
      documentState: null,
      documentVersion: null,
      userLabel: null,
      lastResponsible: null,
      updatedAt: null,
      auditLinked: false,
    });
    registerKnowledgeEdge({
      id: `${documentNodeId}->${workspaceNodeId}:created-in`,
      sourceId: documentNodeId,
      targetId: workspaceNodeId,
      edgeType: 'created-in',
      label: 'created in',
    });

    if (item.documentKind) {
      const typeNodeId = `knowledge:document-type:${slugify(item.documentKind)}`;
      registerKnowledgeNode({
        id: typeNodeId,
        nodeType: 'document-type',
        label: item.documentKind,
        description: 'Document type',
        repositoryItemId: null,
        projectLabel: null,
        teamId: null,
        teamLabel: null,
        workspaceLabel: null,
        documentKind: item.documentKind,
        documentState: null,
        documentVersion: null,
        userLabel: null,
        lastResponsible: null,
        updatedAt: null,
        auditLinked: false,
      });
      registerKnowledgeEdge({
        id: `${documentNodeId}->${typeNodeId}:typed-as`,
        sourceId: documentNodeId,
        targetId: typeNodeId,
        edgeType: 'typed-as',
        label: 'typed as',
      });
    }
  });

  return {
    root,
    views: DOCUMENTATION_MODE_VIEWS,
    primaryView: 'repository',
    teamFolders,
    agentUnits: Array.from(agentUnitsById.values()),
    teamManifests,
    agentManifests,
    indexEntries: [...teamIndexEntries, ...agentIndexEntries, ...fileIndexEntries],
    repositoryItems: [
      ...fileRepositoryItems,
      ...mainWorkspaceRepositoryItems,
      ...agentRepositoryItems,
      ...teamRepositoryItems,
    ],
    auditEntries,
    knowledgeMap: {
      nodes: Array.from(knowledgeNodesById.values()),
      edges: Array.from(knowledgeEdgesById.values()),
    },
    compatibility: {
      auditLog: true,
      calendarMode: true,
      complianceReady: true,
      dataSafetyReady: true,
    },
  };
}

function getMirrorRoleLabel(role?: TeamsNodeType) {
  if (role === 'general_manager') return 'General Manager';
  if (role === 'senior_manager') return 'Sub-Manager';
  if (role === 'worker') return 'Worker';
  return undefined;
}

export function buildDocumentationMirrorTree(
  model: DocumentationModeModel,
): DocumentationMirrorNode {
  const unitsByParentAgentId = model.agentUnits.reduce<Record<string, DocumentationAgentUnit[]>>(
    (accumulator, unit) => {
      const key = unit.treeParentUnitId ?? `team:${unit.teamId}`;
      accumulator[key] = [...(accumulator[key] ?? []), unit];
      return accumulator;
    },
    {},
  );

  const buildAgentBranch = (unit: DocumentationAgentUnit): DocumentationMirrorNode => ({
    id: `agent:${unit.unitId}`,
    kind: 'agent',
    label: unit.agentLabel,
    path: unit.path,
    roleLabel: `${getMirrorRoleLabel(unit.agentRole)}${unit.historical ? ' • Historical' : ''}`,
    children: (unitsByParentAgentId[unit.unitId] ?? [])
      .sort((left, right) => {
        if (left.stableIdentityId === right.stableIdentityId && left.historical !== right.historical) {
          return left.historical ? -1 : 1;
        }
        if (left.agentRole !== right.agentRole) {
          return left.agentRole === 'senior_manager' ? -1 : 1;
        }
        return left.agentLabel.localeCompare(right.agentLabel);
      })
      .map(buildAgentBranch),
  });

  const teamNodes = model.teamFolders
    .slice()
    .sort((left, right) => left.teamLabel.localeCompare(right.teamLabel))
    .map((teamFolder) => ({
      id: `team:${teamFolder.teamId}`,
      kind: 'team' as const,
      label: teamFolder.teamLabel,
      path: teamFolder.path,
      children: (unitsByParentAgentId[`team:${teamFolder.teamId}`] ?? [])
        .sort((left, right) => {
          if (left.stableIdentityId === right.stableIdentityId && left.historical !== right.historical) {
            return left.historical ? -1 : 1;
          }
          if (left.agentRole !== right.agentRole) {
            return left.agentRole === 'senior_manager' ? -1 : 1;
          }
          return left.agentLabel.localeCompare(right.agentLabel);
        })
        .map(buildAgentBranch),
    }));

  return {
    id: 'docs-root',
    kind: 'root',
    label: model.root.path,
    path: model.root.path,
    children: [
      {
        id: 'docs-folder-teams',
        kind: 'folder',
        label: 'teams',
        path: `${model.root.path}/teams`,
        children: teamNodes,
      },
    ],
  };
}
