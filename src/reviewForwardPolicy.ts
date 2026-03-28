import { GENERAL_MANAGER_LABEL } from './context';
import { CROSS_VERIFICATION_TEAM_ID, getInitialTeamsMapState, getNodeById, getTopLevelUnits } from './data/teams';
import type {
  AgentRole,
  AuditAnswerPayload,
  AuditAnswerRoutingTarget,
  Page,
  ReviewForwardSourceKind,
  ReviewForwardTargetOption,
  TeamsGraphNode,
} from './types';

function dedupeReviewTargets(targets: ReviewForwardTargetOption[]) {
  const seen = new Set<string>();

  return targets.filter((target) => {
    if (seen.has(target.id)) {
      return false;
    }

    seen.add(target.id);
    return true;
  });
}

function buildGeneralManagerTarget(): ReviewForwardTargetOption {
  return {
    id: 'main_workspace:manager',
    label: GENERAL_MANAGER_LABEL,
    kind: 'general-manager',
    agentRole: 'manager',
    teamId: 'main_workspace',
  };
}

function getLiveTeamsGraph(teamsGraph?: TeamsGraphNode[]) {
  return teamsGraph ?? getInitialTeamsMapState().teamsGraph;
}

function buildGeneralManagerAuditRoutingTarget(page: Page = 'A'): AuditAnswerRoutingTarget {
  return {
    id: 'main_workspace:manager',
    kind: 'general-manager',
    label: GENERAL_MANAGER_LABEL,
    page,
    sourceArea: 'main-workspace',
    teamId: 'main_workspace',
    teamLabel: 'Main Workspace',
    agentRole: 'manager',
  };
}

function getSystemSubManagerTargets(teamsGraph?: TeamsGraphNode[]): ReviewForwardTargetOption[] {
  const liveTeamsGraph = getLiveTeamsGraph(teamsGraph);

  return getTopLevelUnits(liveTeamsGraph)
    .filter((node) => node.type === 'senior_manager' && node.teamId !== CROSS_VERIFICATION_TEAM_ID)
    .map((node) => ({
      id: `team:${node.teamId}:sub-manager`,
      label: `${node.label} Sub-Manager`,
      kind: 'team-sub-manager' as const,
      teamId: node.teamId,
      nodeId: node.id,
    }));
}

function getDirectWorkerTargets(parentNodeId: string, teamsGraph: TeamsGraphNode[]) {
  return teamsGraph
    .filter((node) => node.parentId === parentNodeId && node.type === 'worker')
    .map((worker) => ({
      id: worker.id,
      label: worker.label,
      kind: 'team-worker' as const,
      workerId: worker.id,
      teamId: worker.teamId,
      nodeId: worker.id,
    }));
}

function collectDescendantSubManagerTargets(parentNodeId: string, teamsGraph: TeamsGraphNode[]): ReviewForwardTargetOption[] {
  const directChildren = teamsGraph.filter(
    (node) =>
      node.parentId === parentNodeId &&
      node.type === 'senior_manager' &&
      node.teamId !== CROSS_VERIFICATION_TEAM_ID,
  );

  return directChildren.flatMap((node) => [
    {
      id: `team:${node.teamId}:${node.id}:sub-manager`,
      label: `${node.label} Sub-Manager`,
      kind: 'team-sub-manager' as const,
      teamId: node.teamId,
      nodeId: node.id,
    },
    ...collectDescendantSubManagerTargets(node.id, teamsGraph),
  ]);
}

function getNearestSubManagerAncestor(node: TeamsGraphNode, teamsGraph: TeamsGraphNode[]) {
  let currentParentId = node.parentId;
  while (currentParentId) {
    const parent = getNodeById(teamsGraph, currentParentId);
    if (!parent) {
      return null;
    }
    if (parent.type === 'senior_manager') {
      return parent;
    }
    currentParentId = parent.parentId;
  }

  return null;
}

export function getAgentPanelForwardTargets(
  agent: AgentRole,
  managerDisplayName?: string,
  teamsGraph?: TeamsGraphNode[],
): ReviewForwardTargetOption[] {
  if (agent === 'manager') {
    const isSecondaryPageSubManager =
      Boolean(managerDisplayName) && managerDisplayName !== GENERAL_MANAGER_LABEL;

    if (isSecondaryPageSubManager) {
      return [buildGeneralManagerTarget()];
    }

    return dedupeReviewTargets([
      {
        id: 'worker1',
        label: 'Worker 1',
        kind: 'main-worker',
        agentRole: 'worker1',
      },
      {
        id: 'worker2',
        label: 'Worker 2',
        kind: 'main-worker',
        agentRole: 'worker2',
      },
      ...getSystemSubManagerTargets(teamsGraph),
    ]);
  }

  return dedupeReviewTargets([
    buildGeneralManagerTarget(),
    ...(agent === 'worker1'
      ? [
          {
            id: 'worker2',
            label: 'Worker 2',
            kind: 'main-worker' as const,
            agentRole: 'worker2' as const,
          },
        ]
      : [
          {
            id: 'worker1',
            label: 'Worker 1',
            kind: 'main-worker' as const,
            agentRole: 'worker1' as const,
          },
        ]),
  ]);
}

export function isValidAgentPanelForwardTarget(
  agent: AgentRole,
  targetId: string,
  managerDisplayName?: string,
  teamsGraph?: TeamsGraphNode[],
) {
  return getAgentPanelForwardTargets(agent, managerDisplayName, teamsGraph).some(
    (target) => target.id === targetId,
  );
}

export function getTeamSubManagerForwardTargets(
  sourceNodeId: string,
  teamsGraph?: TeamsGraphNode[],
): ReviewForwardTargetOption[] {
  const liveTeamsGraph = getLiveTeamsGraph(teamsGraph);
  const sourceNode = getNodeById(liveTeamsGraph, sourceNodeId);
  if (!sourceNode || sourceNode.type !== 'senior_manager') {
    return [];
  }

  const workerTargets = getDirectWorkerTargets(sourceNode.id, liveTeamsGraph);
  const subordinateTargets = collectDescendantSubManagerTargets(sourceNode.id, liveTeamsGraph);
  const upwardTarget =
    sourceNode.parentId === 'gm_1'
      ? buildGeneralManagerTarget()
      : (() => {
          const parentSubManager = getNearestSubManagerAncestor(sourceNode, liveTeamsGraph);
          return parentSubManager
            ? ({
                id: `team:${parentSubManager.teamId}:${parentSubManager.id}:sub-manager`,
                label: `${parentSubManager.label} Sub-Manager`,
                kind: 'team-sub-manager' as const,
                teamId: parentSubManager.teamId,
                nodeId: parentSubManager.id,
              } satisfies ReviewForwardTargetOption)
            : null;
        })();

  return dedupeReviewTargets([
    ...workerTargets,
    ...subordinateTargets,
    ...(upwardTarget ? [upwardTarget] : []),
  ]);
}

export function getTeamWorkerForwardTargets(
  workerNodeId: string,
  teamsGraph?: TeamsGraphNode[],
): ReviewForwardTargetOption[] {
  const liveTeamsGraph = getLiveTeamsGraph(teamsGraph);
  const workerNode = getNodeById(liveTeamsGraph, workerNodeId);
  if (!workerNode || workerNode.type !== 'worker') {
    return [];
  }

  const parentSubManager = getNearestSubManagerAncestor(workerNode, liveTeamsGraph);
  if (!parentSubManager) {
    return [];
  }

  const siblingWorkerTargets = liveTeamsGraph
    .filter(
      (node) =>
        node.type === 'worker' &&
        node.teamId === workerNode.teamId &&
        node.parentId === workerNode.parentId &&
        node.id !== workerNode.id,
    )
    .map((node) => ({
      id: node.id,
      label: node.label,
      kind: 'team-worker' as const,
      workerId: node.id,
      teamId: node.teamId,
      nodeId: node.id,
    }));

  return dedupeReviewTargets([
    {
      id: `team:${parentSubManager.teamId}:${parentSubManager.id}:sub-manager`,
      label: `${parentSubManager.label} Sub-Manager`,
      kind: 'team-sub-manager',
      teamId: parentSubManager.teamId,
      nodeId: parentSubManager.id,
    },
    ...siblingWorkerTargets,
  ]);
}

export function isValidTeamSubManagerForwardTarget(
  target: Pick<ReviewForwardTargetOption, 'id'> | null | undefined,
  availableTargets: ReviewForwardTargetOption[],
) {
  if (!target) {
    return false;
  }

  return availableTargets.some((option) => option.id === target.id);
}

export function getCrossVerificationForwardTargets(
  payload: AuditAnswerPayload | null,
  preservedTargets?: AuditAnswerRoutingTarget[] | null,
): AuditAnswerRoutingTarget[] {
  const dedupedPreservedTargets = (preservedTargets ?? []).filter(
    (target, index, collection) =>
      collection.findIndex((candidate) => candidate.id === target.id) === index,
  );
  if (dedupedPreservedTargets.length > 0) {
    return dedupedPreservedTargets;
  }

  const contextualTargets = [
    payload?.sourceReturnTarget ?? null,
    payload?.sourcePrimarySubManagerTarget ?? null,
  ].filter((target): target is AuditAnswerRoutingTarget => Boolean(target));

  const dedupedContextualTargets = contextualTargets.filter(
    (target, index, collection) =>
      collection.findIndex((candidate) => candidate.id === target.id) === index,
  );
  if (dedupedContextualTargets.length > 0) {
    return dedupedContextualTargets;
  }

  const fallback = buildGeneralManagerAuditRoutingTarget();
  const supervisorTarget = payload?.sourceGeneralManagerTarget;
  return [
    supervisorTarget && isValidCrossVerificationForwardTarget(supervisorTarget)
      ? supervisorTarget
      : fallback,
  ];
}

export function isValidCrossVerificationForwardTarget(
  target: AuditAnswerRoutingTarget | null | undefined,
) {
  return Boolean(
    target &&
      target.id === 'main_workspace:manager' &&
      target.kind === 'general-manager' &&
      target.sourceArea === 'main-workspace' &&
      target.agentRole === 'manager',
  );
}

export function isValidAuditRoutingTargetForReviewForward(
  sourceKind: ReviewForwardSourceKind,
  target: AuditAnswerRoutingTarget | null | undefined,
) {
  if (sourceKind === 'cross-verification-sub-manager') {
    return Boolean(
      target &&
        ((target.kind === 'worker' && target.sourceArea === 'team-workspace' && target.teamId && target.workerId) ||
          (target.kind === 'sub-manager' &&
            (target.sourceArea === 'team-workspace' || target.sourceArea === 'main-workspace') &&
            target.teamId) ||
          isValidCrossVerificationForwardTarget(target)),
    );
  }

  return false;
}
