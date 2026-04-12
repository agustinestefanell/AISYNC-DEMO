import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AgentPanel } from '../components/AgentPanel';
import { CollapsibleManagerSidebar } from '../components/CollapsibleManagerSidebar';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { useApp } from '../context';
import {
  CROSS_VERIFICATION_TEAM_ID,
  DOCUMENTATION_SAVING_DEFAULTS,
  PROVIDERS,
  buildFolderSeed,
  countArtifacts,
  createWorkerLabel,
  getTeamCode,
  getInitialTeamsMapState,
  getProviderDisplayName,
  getRoleLabel,
  getSecondaryWorkspaceTarget,
  getTeamTheme,
  getTopLevelUnits,
  getWorkspaceAgentForTeam,
  saveTeamsMapState,
  type DocumentationSavingDefault,
  type TeamsMapState,
} from '../data/teams';
import { openTeamWorkspaceWindow } from '../teamWorkspaceLaunch';
import type { AIProvider, TeamsGraphNode } from '../types';
import { getSecondarySubManagerLabel } from '../pageLabels';

type TeamsViewMode = 'map' | 'tree';

function MapAddUserTeamAnchor({ onClick }: { onClick: () => void }) {
  return (
    <div
      data-pan-block="true"
      className="absolute"
      style={{
        left: 'calc(100% + 84px)',
        top: '28px',
        width: `${MAP_NODE_WIDTH}px`,
      }}
    >
      <div
        aria-hidden="true"
        className="absolute"
        style={{
          left: '-84px',
          top: '96px',
          width: '84px',
          borderTop: '2px dashed rgba(100, 116, 139, 0.52)',
        }}
      />
      <button
        type="button"
        data-pan-block="true"
        className="flex min-h-[188px] w-full flex-col items-center justify-center rounded-[22px] border-2 border-dashed px-6 py-6 text-center transition-colors hover:border-neutral-500 hover:bg-white/90"
        style={{
          borderColor: 'rgba(100, 116, 139, 0.45)',
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(241,245,249,0.92) 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.78), 0 12px 24px rgba(15,23,42,0.05)',
        }}
        onClick={onClick}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-neutral-400 bg-white/85 text-[28px] font-semibold leading-none text-neutral-700">
          +
        </div>
        <div className="mt-4 text-[14px] font-semibold text-neutral-900">Connect Team</div>
        <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-neutral-500">
          Link external User
        </div>
      </button>
    </div>
  );
}

function TreeAddUserTeamAnchor({ onClick }: { onClick: () => void }) {
  return (
    <div
      data-pan-block="true"
      className="absolute"
      style={{
        left: 'calc(100% + 64px)',
        top: '-2px',
        width: `${TREE_NODE_WIDTH}px`,
        height: `${TREE_SUB_MANAGER_HEIGHT}px`,
      }}
    >
      <div
        aria-hidden="true"
        className="absolute"
        style={{
          left: '-64px',
          top: '50%',
          width: '64px',
          borderTop: '2px dashed rgba(100, 116, 139, 0.52)',
          transform: 'translateY(-50%)',
        }}
      />
      <button
        type="button"
        data-pan-block="true"
        className="flex h-full w-full flex-col items-center justify-center rounded-[18px] border-2 border-dashed px-2 py-2 text-center transition-colors hover:border-neutral-500 hover:bg-white/90"
        style={{
          borderColor: 'rgba(100, 116, 139, 0.45)',
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.86) 0%, rgba(241,245,249,0.96) 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.75), 0 8px 16px rgba(15,23,42,0.05)',
        }}
        onClick={onClick}
      >
        <div className="text-[20px] font-semibold leading-none text-neutral-700">+</div>
        <div className="mt-2 line-clamp-2 text-[11px] font-semibold leading-[1.2] text-neutral-900">
          Connect Team
        </div>
        <div className="mt-1 text-[8px] uppercase tracking-[0.16em] text-neutral-500">
          Link external User
        </div>
      </button>
    </div>
  );
}

function getSavingDefaultShortLabel(value: DocumentationSavingDefault) {
  if (value === 'Documentation Mode') return 'Docs Mode';
  if (value === 'Team Workspace') return 'Team Save';
  return 'Audit Log';
}

function padDocumentIndex(value: number) {
  return String(value).padStart(2, '0');
}

function buildPromotedSubManagerName(smIndex: string, suffix: string) {
  return `${smIndex}-SM-${suffix.trim()}`;
}

function buildPromotedWorkerName(smIndex: string, workerIndex: number, suffix: string) {
  return `${smIndex}-${padDocumentIndex(workerIndex)}-W-${suffix.trim()}`;
}

function sortNodesForDisplay(nodes: TeamsGraphNode[]) {
  return [...nodes].sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === 'senior_manager' ? -1 : 1;
    }

    return left.label.localeCompare(right.label);
  });
}

function getChildNodes(teamNodes: TeamsGraphNode[], parentId: string) {
  return sortNodesForDisplay(teamNodes.filter((node) => node.parentId === parentId));
}

function collectDescendantIds(teamNodes: TeamsGraphNode[], nodeId: string): string[] {
  const directChildren = teamNodes.filter((node) => node.parentId === nodeId);
  return directChildren.flatMap((child) => [child.id, ...collectDescendantIds(teamNodes, child.id)]);
}

function getBranchLeafCount(teamNodes: TeamsGraphNode[], nodeId: string): number {
  const children = getChildNodes(teamNodes, nodeId);
  if (children.length === 0) {
    return 1;
  }

  return children.reduce((total, child) => total + getBranchLeafCount(teamNodes, child.id), 0);
}

function getFamilyColor(color: string, alpha: number) {
  const normalized = color.replace('#', '').trim();
  if (![3, 6].includes(normalized.length)) {
    return color;
  }

  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((character) => `${character}${character}`)
          .join('')
      : normalized;
  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function getMapTeamNarrative(teamId: string) {
  switch (teamId) {
    case 'team_legal':
      return {
        functionLabel: 'Contract review and operational risk screening',
        teamTags: ['Legal Ops', 'Contracts', 'Risk'],
        teamBrief:
          'Screens clauses, exceptions, and approval thresholds so the delivery team can move with a clear legal position.',
        workerFunction: 'Legal execution lane',
        workerBrief:
          'Resolves clause-by-clause checks, extracts blockers, and converts findings into handoff-ready notes.',
      };
    case 'team_marketing':
      return {
        functionLabel: 'Campaign operations and market signal synthesis',
        teamTags: ['Marketing', 'Pipeline', 'Insights'],
        teamBrief:
          'Keeps outbound campaigns aligned by coordinating launch assets, channel timing, and signal review.',
        workerFunction: 'Campaign execution lane',
        workerBrief:
          'Builds execution-ready marketing fragments, validates channel details, and returns concise launch updates.',
      };
    case 'team_clients':
      return {
        functionLabel: 'Direct client delivery coordination',
        teamTags: ['Clients', 'Projects', 'Delivery'],
        teamBrief:
          'Handles the direct client-facing stream where requests, project shaping, and active follow-through stay unified.',
        workerFunction: 'Client delivery lane',
        workerBrief:
          'Moves active client requests, prepares deliverable-ready updates, and keeps the project lane responsive.',
      };
    default:
      return {
        functionLabel: 'Elastic team coordination',
        teamTags: ['Elastic', 'Operations', 'AISync'],
        teamBrief:
          'Coordinates a focused operating lane with its own delivery cadence, artifacts, and internal handoffs.',
        workerFunction: 'Execution lane',
        workerBrief:
          'Executes the active queue for the lane, surfaces blockers quickly, and returns compact operational updates.',
      };
  }
}

type MapCardMetric = {
  label: string;
  value: string;
};

function getFamilyLeadNode(node: TeamsGraphNode, teamsGraph: TeamsGraphNode[]) {
  if (node.type === 'senior_manager') {
    return node;
  }

  let currentNode: TeamsGraphNode | null = node;
  while (currentNode?.parentId) {
    const parentNode = teamsGraph.find((candidate) => candidate.id === currentNode?.parentId) ?? null;
    if (!parentNode) {
      break;
    }

    if (parentNode.type === 'senior_manager') {
      return parentNode;
    }

    if (parentNode.type === 'general_manager') {
      return node;
    }

    currentNode = parentNode;
  }

  return node;
}

function getMapCardDetails({
  node,
  parentNode,
  teamSettings,
  counts,
  branchLeafCount,
  isTopLevelUnit,
  isDirectUnit,
}: {
  node: TeamsGraphNode;
  parentNode: TeamsGraphNode | null;
  teamSettings: TeamsMapState['teamSettingsByTeam'][string] | undefined;
  counts: ReturnType<typeof countArtifacts>;
  branchLeafCount: number;
  isTopLevelUnit: boolean;
  isDirectUnit: boolean;
}) {
  const narrative = getMapTeamNarrative(node.teamId);
  const providerLabel = getProviderDisplayName(node.provider);
  const savingLabel = getSavingDefaultShortLabel(
    teamSettings?.documentationSavingDefault ?? 'Documentation Mode',
  );
  const teamTag = teamSettings?.savingTag ?? 'TEAM';

  if (node.type === 'senior_manager') {
    const isPromotedFamily = !isTopLevelUnit;

    return {
      subtitle: isTopLevelUnit ? 'Sub-Team Workspace' : 'Elastic Sub-Manager',
      functionLabel: isPromotedFamily ? 'Elastic branch coordination' : narrative.functionLabel,
      brief: isPromotedFamily
        ? `Promoted from ${parentNode?.label ?? 'its parent lane'}, now coordinating an autonomous sub-family with its own two-worker operating queue.`
        : narrative.teamBrief,
      tags: isPromotedFamily
        ? [providerLabel, `Parent ${parentNode?.label ?? 'Lead'}`, 'Promoted lane']
        : [providerLabel, ...narrative.teamTags, `Tag ${teamTag}`],
      metrics: isPromotedFamily
        ? []
        : [
            { label: 'Threads', value: String(counts.conversations) },
            { label: 'Docs', value: String(counts.documents) },
            { label: 'Reports', value: String(counts.reports) },
          ],
      actionLabel: 'Open',
      secondaryActionLabel: 'Edit' as const,
      compact: false,
      outlineOnly: false,
    };
  }

  if (isDirectUnit) {
    return {
      subtitle: 'Direct Team Workspace',
      functionLabel: narrative.functionLabel,
      brief: narrative.teamBrief,
      tags: [providerLabel, ...narrative.teamTags, `Tag ${teamTag}`],
      metrics: [
        { label: 'Threads', value: String(counts.conversations) },
        { label: 'Docs', value: String(counts.documents) },
        { label: 'Reports', value: String(counts.reports) },
      ],
      actionLabel: 'Open',
      secondaryActionLabel: 'Edit' as const,
      compact: false,
      outlineOnly: true,
    };
  }

  const isWorkerInPromotedFamily = parentNode?.type === 'senior_manager' && parentNode.parentId !== 'gm_1';
  return {
    subtitle: isWorkerInPromotedFamily ? 'Branch Worker' : 'Team Worker',
    functionLabel: narrative.workerFunction,
    brief: isWorkerInPromotedFamily
      ? `Executes the autonomous branch under ${parentNode?.label}, keeping that promoted family separate from the parent worker block.`
      : narrative.workerBrief,
    tags: [
      providerLabel,
      isWorkerInPromotedFamily ? `Family ${parentNode?.label}` : `Team ${teamTag}`,
      'Execution',
    ],
    metrics: [],
    actionLabel: 'Open',
    secondaryActionLabel: 'Edit' as const,
    compact: true,
    outlineOnly: false,
  };
}

const MAP_NODE_WIDTH = 356;
const MAP_WORKER_WIDTH = 316;
const TREE_NODE_WIDTH = 152;
const TREE_WORKER_WIDTH = 112;

function CanvasViewport({
  initialZoom,
  minZoom,
  maxZoom,
  fitFloor,
  fitTopOffset,
  alignTopOnFit,
  zoomInSignal,
  zoomOutSignal,
  resetSignal,
  contentWidthClass,
  children,
}: {
  initialZoom: number;
  minZoom: number;
  maxZoom: number;
  fitFloor?: number;
  fitTopOffset?: number;
  alignTopOnFit?: boolean;
  zoomInSignal?: number;
  zoomOutSignal?: number;
  resetSignal?: number;
  contentWidthClass: string;
  children: ReactNode;
}) {
  const [zoom, setZoom] = useState(initialZoom);
  const [isDragging, setIsDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const pendingOffsetRef = useRef({ x: 0, y: 0 });
  const hasManualViewportInteractionRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const applyTransform = () => {
    if (!contentRef.current) {
      return;
    }

    const { x, y } = offsetRef.current;
    contentRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${zoom})`;
  };

  const scheduleTransform = () => {
    if (rafRef.current !== null) {
      return;
    }

    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      offsetRef.current = { ...pendingOffsetRef.current };
      applyTransform();
    });
  };

  const clampZoom = (nextZoom: number) =>
    Math.min(maxZoom, Math.max(minZoom, Number(nextZoom.toFixed(2))));

  const updateZoomAtClientPoint = (
    nextZoom: number,
    clientX: number,
    clientY: number,
    options?: { markManual?: boolean },
  ) => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) {
      setZoom(clampZoom(nextZoom));
      return;
    }

    const clampedZoom = clampZoom(nextZoom);
    if (clampedZoom === zoom) {
      return;
    }

    const contentRect = content.getBoundingClientRect();
    const contentWidth = Math.max(content.scrollWidth, content.offsetWidth, 1);
    const originX = contentWidth / 2;
    const baseLeft = contentRect.left - offsetRef.current.x - originX * (1 - zoom);
    const baseTop = contentRect.top - offsetRef.current.y;
    const localX = (clientX - contentRect.left) / zoom;
    const localY = (clientY - contentRect.top) / zoom;
    const nextLeft = clientX - localX * clampedZoom;
    const nextTop = clientY - localY * clampedZoom;
    const nextOffset = {
      x: nextLeft - baseLeft - originX * (1 - clampedZoom),
      y: nextTop - baseTop,
    };

    offsetRef.current = nextOffset;
    pendingOffsetRef.current = nextOffset;
    if (options?.markManual ?? true) {
      hasManualViewportInteractionRef.current = true;
    }
    setZoom(clampedZoom);
  };

  const updateZoom = (nextZoom: number, options?: { markManual?: boolean }) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      setZoom(clampZoom(nextZoom));
      return;
    }

    const rect = viewport.getBoundingClientRect();
    updateZoomAtClientPoint(
      nextZoom,
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      options,
    );
  };

  const fitViewport = () => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) {
      return;
    }

    const padding = window.innerWidth < 640 ? 4 : 8;
    const availableWidth = Math.max(viewport.clientWidth - padding * 2, 1);
    const availableHeight = Math.max(viewport.clientHeight - padding * 2, 1);
    const contentWidth = Math.max(content.scrollWidth, content.offsetWidth, 1);
    const contentHeight = Math.max(content.scrollHeight, content.offsetHeight, 1);
    const fittedZoom = clampZoom(
      Math.max(
        fitFloor ?? minZoom,
        Math.min(initialZoom, availableWidth / contentWidth, availableHeight / contentHeight) * 0.92,
      ),
    );
    const verticalOffset = alignTopOnFit
      ? fitTopOffset ?? 0
      : Math.max((availableHeight - contentHeight * fittedZoom) / 2, fitTopOffset ?? 0);

    hasManualViewportInteractionRef.current = false;
    offsetRef.current = { x: 0, y: verticalOffset };
    pendingOffsetRef.current = { x: 0, y: verticalOffset };
    setZoom(fittedZoom);
  };

  const resetViewport = () => {
    fitViewport();
  };

  const stopDragging = (currentTarget?: HTMLDivElement, pointerId?: number) => {
    if (!dragStateRef.current) {
      return;
    }

    try {
      if (currentTarget && pointerId !== undefined) {
        currentTarget.releasePointerCapture(pointerId);
      }
    } catch {
      // Ignore release failures in browsers that already released capture.
    }

    dragStateRef.current = null;
    setIsDragging(false);
  };

  useEffect(() => {
    applyTransform();
  }, [zoom]);

  useEffect(() => {
    if (!zoomInSignal) {
      return;
    }

    updateZoom(zoom + 0.14, { markManual: true });
  }, [zoomInSignal]);

  useEffect(() => {
    if (!zoomOutSignal) {
      return;
    }

    updateZoom(zoom - 0.14, { markManual: true });
  }, [zoomOutSignal]);

  useEffect(() => {
    if (!resetSignal) {
      return;
    }

    fitViewport();
  }, [resetSignal]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport) {
      return;
    }

    fitViewport();

    const resizeObserver = new ResizeObserver(() => {
      if (hasManualViewportInteractionRef.current) {
        return;
      }
      fitViewport();
    });
    resizeObserver.observe(viewport);
    if (content) {
      resizeObserver.observe(content);
    }

    return () => resizeObserver.disconnect();
  }, [alignTopOnFit, fitFloor, fitTopOffset, initialZoom, maxZoom, minZoom]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    },
    [],
  );

  return (
    <div
      className="relative overflow-visible rounded-[20px] border shadow-[var(--shadow-soft)]"
      style={{
        borderColor: 'rgba(15, 23, 42, 0.12)',
        background:
          'linear-gradient(180deg, rgba(232, 238, 244, 0.98) 0%, rgba(223, 231, 239, 0.96) 100%)',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(15,23,42,0.08), 0 10px 26px rgba(15,23,42,0.06)',
      }}
    >
      <div
        ref={viewportRef}
        className="relative h-[min(72vh,760px)] min-h-[520px] overflow-hidden select-none"
        style={{ touchAction: 'none', cursor: isDragging ? 'grabbing' : 'grab' }}
        onPointerDown={(event) => {
          if (
            (event.target as HTMLElement).closest(
              '[data-pan-block="true"], [data-viewport-block="true"]',
            )
          ) {
            return;
          }

          dragStateRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originX: offsetRef.current.x,
            originY: offsetRef.current.y,
          };
          hasManualViewportInteractionRef.current = true;
          setIsDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!dragStateRef.current || dragStateRef.current.pointerId !== event.pointerId) {
            return;
          }

          pendingOffsetRef.current = {
            x: dragStateRef.current.originX + (event.clientX - dragStateRef.current.startX),
            y: dragStateRef.current.originY + (event.clientY - dragStateRef.current.startY),
          };
          scheduleTransform();
        }}
        onDoubleClick={(event) => {
          if (
            (event.target as HTMLElement).closest(
              '[data-pan-block="true"], [data-viewport-block="true"]',
            )
          ) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        onDoubleClickCapture={(event) => {
          if (
            (event.target as HTMLElement).closest(
              '[data-pan-block="true"], [data-viewport-block="true"]',
            )
          ) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        onPointerUp={(event) => stopDragging(event.currentTarget, event.pointerId)}
        onPointerCancel={(event) => stopDragging(event.currentTarget, event.pointerId)}
        onWheel={(event) => {
          if (
            (event.target as HTMLElement).closest(
              '[data-pan-block="true"], [data-viewport-block="true"]',
            )
          ) {
            return;
          }

          event.preventDefault();
          const nextZoom = zoom + (event.deltaY < 0 ? 0.08 : -0.08);
          updateZoomAtClientPoint(nextZoom, event.clientX, event.clientY, { markManual: true });
        }}
      >
        <div
          className="absolute inset-0 flex items-start justify-center p-3 sm:p-4"
          style={{
            background:
              'radial-gradient(circle at top, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 42%), linear-gradient(180deg, rgba(247,250,252,0.74) 0%, rgba(228,235,241,0.42) 100%)',
          }}
        >
          <div
            ref={contentRef}
            className={`${contentWidthClass} origin-top`}
            style={{ transform: `translate3d(0px, 0px, 0) scale(${zoom})`, transformOrigin: 'top center', willChange: 'transform' }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function TreeWorkspaceCard({
  title,
  titleContent,
  subtitle,
  functionLabel,
  brief,
  ribbonColor,
  softColor,
  borderColor,
  accentColor,
  tags,
  metrics,
  compact,
  outlineOnly,
  actionLabel,
  secondaryActionLabel,
  onPrimaryAction,
  onSecondaryAction,
}: {
  title: string;
  titleContent?: ReactNode;
  subtitle: string;
  functionLabel: string;
  brief: string;
  ribbonColor: string;
  softColor: string;
  borderColor: string;
  accentColor: string;
  tags: string[];
  metrics: MapCardMetric[];
  compact?: boolean;
  outlineOnly?: boolean;
  actionLabel: string;
  secondaryActionLabel?: string;
  onPrimaryAction: () => void;
  onSecondaryAction?: () => void;
}) {
  const shellBackground = outlineOnly ? '#ffffff' : ribbonColor;
  const shellColor = outlineOnly ? accentColor : '#ffffff';
  const cardWidth = compact ? MAP_WORKER_WIDTH : MAP_NODE_WIDTH;
  const hasMetrics = metrics.length > 0;
  const cardBackground = outlineOnly
    ? 'linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(245,248,251,0.98) 100%)'
    : compact
      ? 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(247,249,252,0.98) 100%)'
      : 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(250,252,254,0.98) 100%)';

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-[18px] border text-left shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-[1px]"
      style={{
        width: `${cardWidth}px`,
        minWidth: `${cardWidth}px`,
        borderColor: outlineOnly ? accentColor : borderColor,
        background: cardBackground,
        boxShadow:
          compact
            ? '0 10px 20px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255,255,255,0.72)'
            : '0 14px 30px rgba(15, 23, 42, 0.09), inset 0 1px 0 rgba(255,255,255,0.8)',
      }}
    >
      <div
        className="shrink-0 px-4 py-3"
        style={{
          background: outlineOnly
            ? 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(246,248,251,0.96) 100%)'
            : `linear-gradient(180deg, ${shellBackground} 0%, ${accentColor} 100%)`,
          color: shellColor,
          borderBottom: `1px solid ${outlineOnly ? borderColor : 'rgba(255,255,255,0.16)'}`,
        }}
      >
        <div className="text-[10px] uppercase tracking-[0.18em] opacity-70">{subtitle}</div>
        <div className={`mt-1 min-h-[2.8rem] font-semibold ${compact ? 'text-[12px]' : 'text-[14px]'}`}>
          {titleContent ?? title}
        </div>
      </div>

      <div
        className={`flex min-h-0 flex-1 flex-col gap-3 px-4 ${compact ? 'py-4 text-[10px]' : hasMetrics ? 'pb-3 pt-4 text-[11px]' : 'py-4 text-[11px]'}`}
      >
        <div className="grid shrink-0 gap-1.5">
          <div className="text-[12px] font-semibold leading-[1.35] text-neutral-950">{functionLabel}</div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-x-2 gap-y-1 text-[10px] leading-[1.3] text-neutral-500">
          {tags.slice(0, compact ? 3 : 4).map((tag) => (
            <span
              key={`${title}_${tag}`}
              className="rounded-full border px-2 py-1 font-medium"
              style={{
                color: accentColor,
                borderColor: borderColor,
                backgroundColor: softColor,
              }}
            >
              {tag}
            </span>
          ))}
        </div>

        <div
          className="min-h-[4.35rem] flex-1 rounded-[12px] px-3.5 py-3 text-[11px] leading-[1.45] text-neutral-700"
          style={{
            border: `1px solid ${borderColor}`,
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(248,250,252,0.9) 100%)',
          }}
        >
          {brief}
        </div>

        {hasMetrics && (
          <div className={`grid shrink-0 gap-1.5 ${metrics.length > 1 ? 'grid-cols-3' : 'grid-cols-1'}`}>
            {metrics.map((metric) => (
              <div
                key={`${title}_${metric.label}`}
                className="overflow-hidden rounded-[12px] border text-center"
                style={{
                  borderColor: borderColor,
                  backgroundColor: softColor,
                  minHeight: '54px',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.58)',
                }}
              >
                <div
                  className="px-2 py-1.5 text-[11px] font-semibold leading-none text-neutral-900"
                  style={{
                    background: 'rgba(255,255,255,0.74)',
                    borderBottom: `1px solid ${getFamilyColor(accentColor, 0.18)}`,
                  }}
                >
                  {metric.label}
                </div>
                <div className="px-2 py-1.5 text-[12px] font-semibold leading-none text-neutral-700">
                  {metric.value}
                </div>
              </div>
            ))}
          </div>
        )}

        <div
          className={`mt-auto grid shrink-0 gap-2 pt-3 ${
            secondaryActionLabel ? 'grid-cols-2' : 'grid-cols-1'
          }`}
          style={{ borderTop: `1px solid ${borderColor}` }}
        >
          <button
            data-pan-block="true"
            className="ui-button ui-button-primary min-h-9 px-3 text-[11px] text-white"
            onClick={(event) => {
              event.stopPropagation();
              onPrimaryAction();
            }}
          >
            {actionLabel}
          </button>
          {secondaryActionLabel && (
            <button
              data-pan-block="true"
              className="ui-button min-h-9 px-3 text-[11px] font-medium text-neutral-700"
              onClick={(event) => {
                event.stopPropagation();
                onSecondaryAction?.();
              }}
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

type TreeLayoutVariant = 'map' | 'tree';

type TreeLayoutSize = {
  width: number;
  height: number;
};

type TreeLayoutPlacement = {
  node: TeamsGraphNode;
  depth: number;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  topY: number;
  bottomY: number;
  subtreeWidth: number;
};

type TreeLayoutConnector = {
  parentId: string;
  childId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};

type TreeLayoutResult = {
  width: number;
  height: number;
  placements: TreeLayoutPlacement[];
  placementById: Record<string, TreeLayoutPlacement>;
  connectors: TreeLayoutConnector[];
};

const MAP_ROOT_WIDTH = 760;
const MAP_ROOT_HEIGHT = 212;
const MAP_SUB_MANAGER_HEIGHT = 364;
const MAP_WORKER_HEIGHT = 312;
const MAP_LEVEL_GAP = 140;
const MAP_SIBLING_GAP = 92;
const MAP_FAMILY_BREAK_GAP = 176;
const MAP_CANVAS_PADDING_X = 128;
const MAP_CANVAS_PADDING_Y = 40;

const TREE_ROOT_WIDTH = 112;
const TREE_ROOT_HEIGHT = 84;
const TREE_SUB_MANAGER_HEIGHT = 120;
const TREE_WORKER_HEIGHT = 86;
const TREE_LEVEL_GAP = 74;
const TREE_SIBLING_GAP = 44;
const TREE_CANVAS_PADDING_X = 76;
const TREE_CANVAS_PADDING_Y = 18;

function getNodeLayoutSize(node: TeamsGraphNode, variant: TreeLayoutVariant): TreeLayoutSize {
  if (variant === 'map') {
    if (node.type === 'general_manager') {
      return { width: MAP_ROOT_WIDTH, height: MAP_ROOT_HEIGHT };
    }

    if (node.type === 'worker') {
      return { width: MAP_WORKER_WIDTH, height: MAP_WORKER_HEIGHT };
    }

    return { width: MAP_NODE_WIDTH, height: MAP_SUB_MANAGER_HEIGHT };
  }

  if (node.type === 'general_manager') {
    return { width: TREE_ROOT_WIDTH, height: TREE_ROOT_HEIGHT };
  }

  if (node.type === 'worker') {
    return { width: TREE_WORKER_WIDTH, height: TREE_WORKER_HEIGHT };
  }

  return { width: TREE_NODE_WIDTH, height: TREE_SUB_MANAGER_HEIGHT };
}

function buildTreeLayout(
  rootNode: TeamsGraphNode,
  allNodes: TeamsGraphNode[],
  variant: TreeLayoutVariant,
): TreeLayoutResult {
  const levelGap = variant === 'map' ? MAP_LEVEL_GAP : TREE_LEVEL_GAP;
  const siblingGap = variant === 'map' ? MAP_SIBLING_GAP : TREE_SIBLING_GAP;
  const nodeById = new Map(allNodes.map((node) => [node.id, node]));
  const depthById = new Map<string, number>();
  const subtreeWidthById = new Map<string, number>();
  const levelHeights: number[] = [];

  const getSiblingGapBetween = (leftChild: TeamsGraphNode, rightChild: TeamsGraphNode) => {
    if (variant !== 'map') {
      return siblingGap;
    }

    if (leftChild.type !== rightChild.type) {
      return MAP_FAMILY_BREAK_GAP;
    }

    return siblingGap;
  };

  const getChildrenSpan = (children: TeamsGraphNode[]) => {
    if (children.length === 0) {
      return 0;
    }

    return children.reduce((total, child, index) => {
      const childWidth = subtreeWidthById.get(child.id) ?? 0;
      if (index === 0) {
        return childWidth;
      }

      return total + getSiblingGapBetween(children[index - 1], child) + childWidth;
    }, 0);
  };

  const assignDepths = (nodeId: string, depth: number) => {
    const node = nodeById.get(nodeId);
    if (!node) {
      return;
    }

    depthById.set(nodeId, depth);
    const size = getNodeLayoutSize(node, variant);
    levelHeights[depth] = Math.max(levelHeights[depth] ?? 0, size.height);

    for (const child of getChildNodes(allNodes, nodeId)) {
      assignDepths(child.id, depth + 1);
    }
  };

  assignDepths(rootNode.id, 0);

  const depthOffsets = levelHeights.reduce<number[]>((accumulator, _height, index) => {
    accumulator[index] = index === 0 ? 0 : accumulator[index - 1] + levelHeights[index - 1] + levelGap;
    return accumulator;
  }, []);

  const measureSubtree = (nodeId: string): number => {
    const node = nodeById.get(nodeId);
    if (!node) {
      return 0;
    }

    const size = getNodeLayoutSize(node, variant);
    const children = getChildNodes(allNodes, nodeId);

    if (children.length === 0) {
      subtreeWidthById.set(nodeId, size.width);
      return size.width;
    }

    children.forEach((child) => {
      measureSubtree(child.id);
    });
    const totalChildrenWidth = getChildrenSpan(children);
    const subtreeWidth = Math.max(size.width, totalChildrenWidth);
    subtreeWidthById.set(nodeId, subtreeWidth);
    return subtreeWidth;
  };

  measureSubtree(rootNode.id);

  const placements: TreeLayoutPlacement[] = [];
  const connectors: TreeLayoutConnector[] = [];
  const placementById: Record<string, TreeLayoutPlacement> = {};

  const placeSubtree = (nodeId: string, left: number) => {
    const node = nodeById.get(nodeId);
    const depth = depthById.get(nodeId);
    const subtreeWidth = subtreeWidthById.get(nodeId);

    if (!node || depth === undefined || subtreeWidth === undefined) {
      return;
    }

    const size = getNodeLayoutSize(node, variant);
    const x = left + (subtreeWidth - size.width) / 2;
    const y = depthOffsets[depth];
    const placement: TreeLayoutPlacement = {
      node,
      depth,
      x,
      y,
      width: size.width,
      height: size.height,
      centerX: x + size.width / 2,
      topY: y,
      bottomY: y + size.height,
      subtreeWidth,
    };

    placements.push(placement);
    placementById[nodeId] = placement;

    const children = getChildNodes(allNodes, nodeId);
    if (children.length === 0) {
      return;
    }

    const totalChildrenWidth = getChildrenSpan(children);
    let cursor = left + (subtreeWidth - totalChildrenWidth) / 2;

    children.forEach((child, index) => {
      const childWidth = subtreeWidthById.get(child.id) ?? 0;
      placeSubtree(child.id, cursor);

      const childPlacement = placementById[child.id];
      if (childPlacement) {
        connectors.push({
          parentId: nodeId,
          childId: child.id,
          fromX: placement.centerX,
          fromY: placement.bottomY,
          toX: childPlacement.centerX,
          toY: childPlacement.topY,
        });
      }

      cursor += childWidth;
      if (index < children.length - 1) {
        cursor += getSiblingGapBetween(child, children[index + 1]);
      }
    });
  };

  placeSubtree(rootNode.id, 0);

  const totalWidth = subtreeWidthById.get(rootNode.id) ?? getNodeLayoutSize(rootNode, variant).width;
  const deepestBottom = placements.reduce((max, placement) => Math.max(max, placement.bottomY), 0);

  return {
    width: totalWidth,
    height: deepestBottom,
    placements,
    placementById,
    connectors,
  };
}

function LayoutConnectors({
  connectors,
  width,
  height,
  color,
  strokeWidth,
}: {
  connectors: TreeLayoutConnector[];
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
}) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 overflow-visible"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      {connectors.map((connector) => {
        const midpointY = connector.fromY + (connector.toY - connector.fromY) / 2;
        const path = [
          `M ${connector.fromX} ${connector.fromY}`,
          `V ${midpointY}`,
          `H ${connector.toX}`,
          `V ${connector.toY}`,
        ].join(' ');

        return (
          <path
            key={`${connector.parentId}_${connector.childId}`}
            d={path}
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
        );
      })}
    </svg>
  );
}

function TreeLayoutCanvas({
  layout,
  paddingX,
  paddingY,
  connectorColor,
  connectorStrokeWidth,
  children,
}: {
  layout: TreeLayoutResult;
  paddingX: number;
  paddingY: number;
  connectorColor: string;
  connectorStrokeWidth: number;
  children: (placement: TreeLayoutPlacement) => ReactNode;
}) {
  const width = layout.width + paddingX * 2;
  const height = layout.height + paddingY * 2;

  return (
    <div className="relative" style={{ width: `${width}px`, height: `${height}px` }}>
      <LayoutConnectors
        connectors={layout.connectors.map((connector) => ({
          ...connector,
          fromX: connector.fromX + paddingX,
          fromY: connector.fromY + paddingY,
          toX: connector.toX + paddingX,
          toY: connector.toY + paddingY,
        }))}
        width={width}
        height={height}
        color={connectorColor}
        strokeWidth={connectorStrokeWidth}
      />

      {layout.placements.map((placement) => (
        <div
          key={placement.node.id}
          className="absolute"
          style={{
            left: `${placement.x + paddingX}px`,
            top: `${placement.y + paddingY}px`,
            width: `${placement.width}px`,
            height: `${placement.height}px`,
          }}
        >
          {children(placement)}
        </div>
      ))}
    </div>
  );
}

function buildLayoutNodes(
  generalManager: TeamsGraphNode,
  topLevelUnits: TeamsGraphNode[],
  teamNodesByTeam: Record<string, TeamsGraphNode[]>,
) {
  return [
    generalManager,
    ...topLevelUnits.flatMap((unit) => {
      const nodes = teamNodesByTeam[unit.teamId] ?? [];
      return nodes.filter((node) => node.id !== generalManager.id);
    }),
  ];
}

function openStandaloneAppPage(page: 'G') {
  if (typeof window === 'undefined') {
    return false;
  }

  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('page', page);

  const launchedWindow = window.open('', '_blank');
  if (!launchedWindow) {
    return false;
  }

  try {
    launchedWindow.opener = null;
  } catch {
    // Ignore browsers that expose opener as read-only.
  }

  launchedWindow.location.replace(url.toString());
  return true;
}

function TreeStructureView({
  projectName,
  generalManager,
  topLevelUnits,
  teamNodesByTeam,
  countsByTeam,
  teamSettingsByTeam,
  onOpenMainWorkspace,
  onOpenWorkspace,
  onEditTeam,
  onAddUserTeam,
  inlineRename,
  onInlineRenameChange,
  onStartInlineRename,
  onCommitInlineRename,
  onCancelInlineRename,
  zoomInSignal,
  zoomOutSignal,
  resetSignal,
}: {
  projectName: string;
  generalManager: TeamsGraphNode;
  topLevelUnits: TeamsGraphNode[];
  teamNodesByTeam: Record<string, TeamsGraphNode[]>;
  countsByTeam: Record<string, ReturnType<typeof countArtifacts>>;
  teamSettingsByTeam: TeamsMapState['teamSettingsByTeam'];
  onOpenMainWorkspace: () => void;
  onOpenWorkspace: (node: TeamsGraphNode) => void;
  onEditTeam: (nodeId: string) => void;
  onAddUserTeam: () => void;
  inlineRename: { nodeId: string; value: string } | null;
  onInlineRenameChange: (value: string) => void;
  onStartInlineRename: (node: TeamsGraphNode) => void;
  onCommitInlineRename: (nodeId: string, rawValue: string) => void;
  onCancelInlineRename: () => void;
  zoomInSignal: number;
  zoomOutSignal: number;
  resetSignal: number;
}) {
  const inlineRenameBlurModeRef = useRef<'commit' | 'ignore'>('commit');
  const workspaceRoles = [
    {
      label: 'Worker 1',
      accent: 'var(--color-role-worker1-accent)',
      border: 'var(--color-role-worker1-border)',
      soft: 'var(--color-role-worker1-soft)',
    },
    {
      label: 'Worker 2',
      accent: 'var(--color-role-worker2-accent)',
      border: 'var(--color-role-worker2-border)',
      soft: 'var(--color-role-worker2-soft)',
    },
  ];
  const layoutNodes = useMemo(
    () => buildLayoutNodes(generalManager, topLevelUnits, teamNodesByTeam),
    [generalManager, teamNodesByTeam, topLevelUnits],
  );
  const layout = useMemo(
    () => buildTreeLayout(generalManager, layoutNodes, 'map'),
    [generalManager, layoutNodes],
  );

  return (
    <CanvasViewport
      initialZoom={1}
      minZoom={0.05}
      maxZoom={1.12}
      fitFloor={0.5}
      fitTopOffset={0}
      alignTopOnFit
      zoomInSignal={zoomInSignal}
      zoomOutSignal={zoomOutSignal}
      resetSignal={resetSignal}
      contentWidthClass="inline-flex w-max flex-col items-center"
    >
      <div className="flex flex-col items-center gap-6 pb-4">
        <div
          className="rounded-[20px] border px-8 py-5 text-center"
          style={{
            borderColor: 'rgba(15, 23, 42, 0.12)',
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(243,247,251,0.98) 100%)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.7), 0 12px 28px rgba(15,23,42,0.08)',
          }}
        >
          <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-600">Main Project</div>
          <div className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-neutral-900">{projectName}</div>
        </div>

        <TreeLayoutCanvas
          layout={layout}
          paddingX={MAP_CANVAS_PADDING_X}
          paddingY={MAP_CANVAS_PADDING_Y}
          connectorColor="rgba(51,65,85,0.62)"
          connectorStrokeWidth={1.8}
        >
          {(placement) => {
            const node = placement.node;

            if (node.type === 'general_manager') {
              return (
                <div className="h-full w-full">
                  <div
                    className="rounded-[24px] border"
                    style={{
                      borderColor: 'rgba(15, 23, 42, 0.18)',
                      background:
                        'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,247,250,0.98) 100%)',
                      boxShadow:
                        '0 18px 38px rgba(15,23,42,0.12), inset 0 1px 0 rgba(255,255,255,0.76)',
                    }}
                  >
                    <div
                      className="rounded-t-[24px] px-6 py-4 text-white"
                      style={{
                        background: 'linear-gradient(180deg, #0f172a 0%, #172235 100%)',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <div className="text-[10px] uppercase tracking-[0.18em] text-white/62">Main Workspace</div>
                      <div className="mt-1 text-[19px] font-semibold">{generalManager.label}</div>
                    </div>

                    <div className="grid gap-4 px-5 py-5 md:grid-cols-[minmax(210px,1.15fr)_minmax(0,1fr)_minmax(0,1fr)]">
                      <div
                        className="rounded-[18px] border px-4 py-4"
                        style={{
                          borderColor: 'var(--color-role-manager-border)',
                          backgroundColor: 'var(--color-role-manager-soft)',
                          boxShadow:
                            'inset 0 3px 0 var(--color-role-manager-accent), inset 0 1px 0 rgba(255,255,255,0.42)',
                        }}
                      >
                        <div
                          className="text-[10px] uppercase tracking-[0.16em]"
                          style={{ color: 'var(--color-role-manager-accent)' }}
                        >
                          Manager Node
                        </div>
                        <div className="mt-2 text-[15px] font-semibold text-neutral-900">{generalManager.label}</div>
                        <div className="mt-2 text-[12px] text-neutral-500">{getProviderDisplayName(generalManager.provider)}</div>
                      </div>
                      {workspaceRoles.map((role) => (
                        <div
                          key={role.label}
                          className="rounded-[18px] border px-4 py-4"
                          style={{
                            borderColor: role.border,
                            backgroundColor: role.soft,
                            boxShadow: `inset 0 3px 0 ${role.accent}, inset 0 1px 0 rgba(255,255,255,0.42)`,
                          }}
                        >
                          <div
                            className="text-[10px] uppercase tracking-[0.16em]"
                            style={{ color: role.accent }}
                          >
                            Core Team
                          </div>
                          <div className="mt-2 text-[15px] font-semibold text-neutral-900">{role.label}</div>
                          <div className="mt-2 text-[12px] text-neutral-500">Main Workspace chatbox</div>
                        </div>
                      ))}
                    </div>

                    <div
                      className="flex justify-center gap-2 px-4 py-5"
                      style={{
                        borderTop: '1px solid rgba(15, 23, 42, 0.1)',
                        background:
                          'linear-gradient(180deg, rgba(247,249,252,0.8) 0%, rgba(239,244,248,0.88) 100%)',
                      }}
                    >
                      <button
                        className="ui-button ui-button-primary text-white"
                        onClick={onOpenMainWorkspace}
                        data-pan-block="true"
                      >
                        Go to Main Workspace
                      </button>
                    </div>
                  </div>
                  <MapAddUserTeamAnchor onClick={onAddUserTeam} />
                </div>
              );
            }

            const theme = getTeamTheme(node.teamId);
            const teamSettings = teamSettingsByTeam[node.teamId];
            const familyFill = getFamilyColor(theme.ribbon, 0.4);
            const counts = countsByTeam[node.teamId] ?? {
              conversations: 0,
              documents: 0,
              reports: 0,
            };
            const parentNode = node.parentId
              ? layoutNodes.find((candidate) => candidate.id === node.parentId) ?? null
              : null;
            const branchLeafCount = getBranchLeafCount(layoutNodes, node.id);
            const childCount = getChildNodes(layoutNodes, node.id).length;
            const isTopLevelUnit = node.parentId === generalManager.id;
            const isDirectUnit = isTopLevelUnit && node.type === 'worker';
            const cardDetails = getMapCardDetails({
              node,
              parentNode,
              teamSettings,
              counts,
              branchLeafCount,
              isTopLevelUnit,
              isDirectUnit,
            });

            return (
              <div className="flex h-full flex-col items-center">
                <TreeWorkspaceCard
                  title={node.label}
                  titleContent={
                    inlineRename?.nodeId === node.id ? (
                      <div
                        data-viewport-block="true"
                        className="rounded-[10px] border border-white/80 bg-white/95 p-1.5 shadow-[0_8px_18px_rgba(15,23,42,0.16)]"
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onPointerUp={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onMouseUp={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onClick={(event) => event.stopPropagation()}
                        onDoubleClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                      >
                        <input
                          autoFocus
                          data-pan-block="true"
                          data-viewport-block="true"
                          className="ui-input h-9 w-full border-0 bg-transparent px-2 text-[13px] font-semibold shadow-none ring-0"
                          value={inlineRename.value}
                          onChange={(event) => onInlineRenameChange(event.target.value)}
                          onFocus={(event) => event.currentTarget.select()}
                          onPointerDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onPointerUp={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onMouseUp={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onClick={(event) => event.stopPropagation()}
                          onDoubleClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onBlur={() => {
                            if (inlineRenameBlurModeRef.current === 'ignore') {
                              inlineRenameBlurModeRef.current = 'commit';
                              return;
                            }

                            onCommitInlineRename(node.id, inlineRename.value);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              inlineRenameBlurModeRef.current = 'ignore';
                              onCommitInlineRename(node.id, inlineRename.value);
                              return;
                            }

                            if (event.key === 'Escape') {
                              event.preventDefault();
                              inlineRenameBlurModeRef.current = 'ignore';
                              onCancelInlineRename();
                            }
                          }}
                        />
                        <div className="px-2 pt-1 text-[9px] uppercase tracking-[0.16em] text-neutral-500">
                          Editing name
                        </div>
                      </div>
                    ) : (
                      <div
                        data-pan-block="true"
                        data-viewport-block="true"
                        className="w-full rounded-[10px] px-1.5 py-1 text-left font-semibold text-neutral-900"
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onPointerUp={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onMouseUp={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onClick={(event) => event.stopPropagation()}
                        onDoubleClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                      >
                        {node.label}
                      </div>
                    )
                  }
                  subtitle={cardDetails.subtitle}
                  functionLabel={cardDetails.functionLabel}
                  brief={cardDetails.brief}
                  ribbonColor={theme.ribbon}
                  softColor={node.type === 'worker' ? familyFill : theme.soft}
                  borderColor={theme.border}
                  accentColor={theme.accent}
                  tags={cardDetails.tags}
                  metrics={cardDetails.metrics}
                  compact={cardDetails.compact && childCount === 0}
                  outlineOnly={cardDetails.outlineOnly}
                  actionLabel={cardDetails.actionLabel}
                  secondaryActionLabel={cardDetails.secondaryActionLabel}
                  onPrimaryAction={() => onOpenWorkspace(node)}
                  onSecondaryAction={() => onEditTeam(node.id)}
                />
              </div>
            );
          }}
        </TreeLayoutCanvas>
      </div>
    </CanvasViewport>
  );
}

function TreeOverviewView({
  projectName,
  generalManager,
  topLevelUnits,
  teamNodesByTeam,
  onOpenWorkspace,
  onEditTeam,
  onAddUserTeam,
  zoomInSignal,
  zoomOutSignal,
  resetSignal,
}: {
  projectName: string;
  generalManager: TeamsGraphNode;
  topLevelUnits: TeamsGraphNode[];
  teamNodesByTeam: Record<string, TeamsGraphNode[]>;
  onOpenWorkspace: (node: TeamsGraphNode) => void;
  onEditTeam: (nodeId: string) => void;
  onAddUserTeam: () => void;
  zoomInSignal: number;
  zoomOutSignal: number;
  resetSignal: number;
}) {
  const layoutNodes = useMemo(
    () => buildLayoutNodes(generalManager, topLevelUnits, teamNodesByTeam),
    [generalManager, teamNodesByTeam, topLevelUnits],
  );
  const layout = useMemo(
    () => buildTreeLayout(generalManager, layoutNodes, 'tree'),
    [generalManager, layoutNodes],
  );

  return (
    <CanvasViewport
      initialZoom={1}
      minZoom={0.05}
      maxZoom={1.18}
      fitTopOffset={0}
      alignTopOnFit
      zoomInSignal={zoomInSignal}
      zoomOutSignal={zoomOutSignal}
      resetSignal={resetSignal}
      contentWidthClass="inline-flex w-max flex-col items-center"
    >
      <div className="flex flex-col items-center gap-4 pb-3">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-600">Tree</div>
          <div className="mt-1 text-xs text-neutral-700">
            Structural view only. Read hierarchy fast, then open the workspace from the node button.
          </div>
        </div>

        <div
          className="rounded-[12px] border px-4 py-2 text-center"
          style={{
            borderColor: 'rgba(15, 23, 42, 0.12)',
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,247,250,0.98) 100%)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.72), 0 10px 22px rgba(15,23,42,0.08)',
          }}
        >
          <div className="text-[9px] uppercase tracking-[0.18em] text-neutral-600">Project</div>
          <div className="mt-1 text-xs font-semibold text-neutral-900">{projectName}</div>
        </div>

        <TreeLayoutCanvas
          layout={layout}
          paddingX={TREE_CANVAS_PADDING_X}
          paddingY={TREE_CANVAS_PADDING_Y}
          connectorColor="rgba(71,85,105,0.56)"
          connectorStrokeWidth={1.45}
        >
          {(placement) => {
            const node = placement.node;

            if (node.type === 'general_manager') {
              return (
                <div
                  className="flex h-full w-full flex-col items-center justify-center rounded-[16px] border px-2 py-2 text-center text-white"
                  style={{
                    borderColor: 'rgba(15, 23, 42, 0.18)',
                    background: 'linear-gradient(180deg, #0f172a 0%, #172235 100%)',
                    boxShadow:
                      '0 10px 22px rgba(15,23,42,0.14), inset 0 1px 0 rgba(255,255,255,0.08)',
                  }}
                >
                  <div className="text-[8px] uppercase tracking-[0.18em] text-white/55">Main</div>
                  <div className="mt-1 line-clamp-2 text-[11px] font-semibold leading-[1.2]">{generalManager.label}</div>
                  <TreeAddUserTeamAnchor onClick={onAddUserTeam} />
                </div>
              );
            }

            const theme = getTeamTheme(node.teamId);
            const isTopLevelUnit = node.parentId === generalManager.id;
            const isManagerFamilyNode = node.type === 'senior_manager';
            const familyFill = getFamilyColor(theme.ribbon, isManagerFamilyNode ? 0.14 : 0.12);
            const roleLabel = isManagerFamilyNode
              ? isTopLevelUnit
                ? 'Team'
                : 'Sub-Manager'
              : 'Worker';
            const boxBackground = isManagerFamilyNode
              ? `linear-gradient(180deg, ${getFamilyColor(theme.ribbon, 0.2)} 0%, ${getFamilyColor(
                  theme.ribbon,
                  0.2,
                )} 34%, rgba(255,255,255,0.96) 34%, rgba(255,255,255,0.96) 100%)`
              : `linear-gradient(180deg, ${getFamilyColor(theme.ribbon, 0.18)} 0%, ${getFamilyColor(
                  theme.ribbon,
                  0.18,
                )} 32%, rgba(255,255,255,0.97) 32%, rgba(255,255,255,0.97) 100%)`;
            const boxColor = isManagerFamilyNode ? theme.ribbon : theme.accent;
            const boxBorder = isManagerFamilyNode ? theme.border : getFamilyColor(theme.accent, 0.28);

            return (
              <div
                className={`flex h-full w-full flex-col items-center justify-center overflow-hidden text-center shadow-[var(--shadow-soft)] ${
                  isManagerFamilyNode ? 'rounded-[18px]' : 'rounded-[16px]'
                }`}
                style={{
                  width: `${placement.width}px`,
                  minWidth: `${placement.width}px`,
                  border: `1px solid ${boxBorder}`,
                  background: boxBackground,
                  color: '#111111',
                  boxShadow: isManagerFamilyNode
                    ? `0 10px 22px rgba(15,23,42,0.08), inset 0 3px 0 ${theme.accent}, inset 0 1px 0 rgba(255,255,255,0.75)`
                    : `0 8px 18px rgba(15,23,42,0.07), inset 0 3px 0 ${theme.accent}, inset 0 1px 0 rgba(255,255,255,0.75)`,
                }}
              >
                <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-2 py-2">
                  <div
                    className="rounded-full px-2 py-1 text-[8px] uppercase tracking-[0.14em]"
                    style={{
                      color: boxColor,
                      background: getFamilyColor(theme.soft, 0.92),
                      border: `1px solid ${getFamilyColor(theme.accent, 0.2)}`,
                    }}
                  >
                    {roleLabel}
                  </div>
                  <div className="line-clamp-3 text-[11px] font-semibold leading-[1.2] text-neutral-900">
                    {node.label}
                  </div>
                  <div className="flex items-center gap-1 pt-0.5">
                    <button
                      data-pan-block="true"
                      className="rounded-full border px-2 py-[3px] text-[9px] font-medium leading-none text-neutral-700 transition-colors hover:text-neutral-900"
                      style={{
                        borderColor: getFamilyColor(theme.accent, 0.24),
                        background: 'rgba(255,255,255,0.82)',
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenWorkspace(node);
                      }}
                    >
                      Open
                    </button>
                    <button
                      data-pan-block="true"
                      className="rounded-full border px-2 py-[3px] text-[9px] font-medium leading-none text-neutral-600 transition-colors hover:text-neutral-800"
                      style={{
                        borderColor: getFamilyColor(theme.accent, 0.18),
                        background: getFamilyColor(theme.soft, 0.44),
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        onEditTeam(node.id);
                      }}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            );
          }}
        </TreeLayoutCanvas>
      </div>
    </CanvasViewport>
  );
}

export function PageD() {
  const { state, dispatch } = useApp();
  const subManagerLabel = getSecondarySubManagerLabel('D');
  const [showManagerMobile, setShowManagerMobile] = useState(false);
  const [teamsState, setTeamsState] = useState<TeamsMapState>(getInitialTeamsMapState);
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [draftLabel, setDraftLabel] = useState('');
  const [draftProvider, setDraftProvider] = useState<AIProvider>('OpenAI');
  const [draftAgentLabel, setDraftAgentLabel] = useState('');
  const [draftAgentProvider, setDraftAgentProvider] = useState<AIProvider>('OpenAI');
  const [draftSavingDefault, setDraftSavingDefault] = useState<DocumentationSavingDefault>('Documentation Mode');
  const [draftSavingTag, setDraftSavingTag] = useState('');
  const [addTeamName, setAddTeamName] = useState('');
  const [addTeamProvider, setAddTeamProvider] = useState<AIProvider>('OpenAI');
  const [addTeamSavingDefault, setAddTeamSavingDefault] = useState<DocumentationSavingDefault>('Documentation Mode');
  const [addTeamSavingTag, setAddTeamSavingTag] = useState('');
  const [toast, setToast] = useState('');
  const [viewMode, setViewMode] = useState<TeamsViewMode>('map');
  const [zoomInSignal, setZoomInSignal] = useState(0);
  const [zoomOutSignal, setZoomOutSignal] = useState(0);
  const [resetSignal, setResetSignal] = useState(0);
  const [inlineRename, setInlineRename] = useState<{ nodeId: string; value: string } | null>(null);
  const [promotionNamingDraft, setPromotionNamingDraft] = useState<null | {
    promotedAgentId: string;
    teamId: string;
    smIndex: string;
    subManagerSuffix: string;
    worker1Suffix: string;
    worker2Suffix: string;
  }>(null);

  useEffect(() => {
    saveTeamsMapState(teamsState);
  }, [teamsState]);

  const updateNodeLabel = (nodeId: string, nextLabel: string) => {
    setTeamsState((current) => ({
      ...current,
      teamsGraph: current.teamsGraph.map((node) =>
        node.id === nodeId ? { ...node, label: nextLabel } : node,
      ),
    }));
  };

  const startInlineRename = (node: TeamsGraphNode) => {
    setInlineRename({
      nodeId: node.id,
      value: node.label,
    });
  };

  const cancelInlineRename = () => {
    setInlineRename(null);
  };

  const commitInlineRename = (nodeId: string, rawValue: string) => {
    const currentNode = teamsState.teamsGraph.find((node) => node.id === nodeId) ?? null;
    if (!currentNode) {
      setInlineRename(null);
      return;
    }

    const nextLabel = rawValue.trim() || currentNode.label;
    setInlineRename(null);

    if (nextLabel === currentNode.label) {
      return;
    }

    updateNodeLabel(nodeId, nextLabel);
    setToast('Node renamed.');
  };

  const selectedNode =
    teamsState.teamsGraph.find((node) => node.id === selectedNodeId) ?? null;

  useEffect(() => {
    if (!selectedNode) {
      return;
    }
    setDraftLabel(selectedNode.label);
    setDraftProvider(selectedNode.provider);
    const teamSettings = teamsState.teamSettingsByTeam[selectedNode.teamId];
    setDraftSavingDefault(teamSettings?.documentationSavingDefault ?? 'Documentation Mode');
    setDraftSavingTag(teamSettings?.savingTag ?? '');
  }, [selectedNode, teamsState.teamSettingsByTeam]);

  const generalManager = useMemo(
    () => teamsState.teamsGraph.find((node) => node.type === 'general_manager') ?? null,
    [teamsState.teamsGraph],
  );
  const topLevelUnits = useMemo(
    () =>
      getTopLevelUnits(teamsState.teamsGraph).filter(
        (node) => node.teamId !== CROSS_VERIFICATION_TEAM_ID,
      ),
    [teamsState.teamsGraph],
  );
  const teamNodesByTeam = useMemo(
    () =>
      teamsState.teamsGraph.reduce<Record<string, TeamsGraphNode[]>>((accumulator, node) => {
        if (!node.teamId || node.teamId === 'global') {
          return accumulator;
        }

        accumulator[node.teamId] = sortNodesForDisplay([
          ...(accumulator[node.teamId] ?? []),
          node,
        ]);
        return accumulator;
      }, {}),
    [teamsState.teamsGraph],
  );
  const artifactCountsByTeam = useMemo(
    () =>
      Object.fromEntries(
        topLevelUnits.map((unit) => [unit.teamId, countArtifacts(teamsState.foldersByTeam[unit.teamId] ?? [])]),
      ),
    [teamsState.foldersByTeam, topLevelUnits],
  );
  const totalWorkers = teamsState.teamsGraph.filter(
    (node) => node.type === 'worker' && node.teamId !== CROSS_VERIFICATION_TEAM_ID,
  ).length;
  const selectedFamilyLead = useMemo(
    () => (selectedNode ? getFamilyLeadNode(selectedNode, teamsState.teamsGraph) : null),
    [selectedNode, teamsState.teamsGraph],
  );
  const selectedTeamMembers = useMemo(
    () =>
      selectedFamilyLead
        ? [
            selectedFamilyLead,
            ...teamsState.teamsGraph.filter((node) => node.parentId === selectedFamilyLead.id),
          ]
        : [],
    [selectedFamilyLead, teamsState.teamsGraph],
  );
  const selectedTeamLead = selectedFamilyLead ?? selectedNode;
  const teamAgents = selectedTeamMembers.filter((node) => node.id !== selectedTeamLead?.id);
  const manageableAgents = selectedTeamMembers;
  const selectedAgent =
    manageableAgents.find((agent) => agent.id === selectedAgentId) ??
    selectedTeamMembers.find((node) => node.id === selectedAgentId) ??
    null;

  useEffect(() => {
    if (manageableAgents.length === 0) {
      setSelectedAgentId('');
      return;
    }

    setSelectedAgentId((current) =>
      manageableAgents.some((agent) => agent.id === current) ? current : manageableAgents[0].id,
    );
  }, [manageableAgents]);

  useEffect(() => {
    if (!selectedAgent) {
      setDraftAgentLabel('');
      setDraftAgentProvider('OpenAI');
      return;
    }

    setDraftAgentLabel(selectedAgent.label);
    setDraftAgentProvider(selectedAgent.provider);
  }, [selectedAgent]);

  useEffect(() => {
    if (!showAddTeamModal) {
      return;
    }

    if (addTeamSavingTag.trim()) {
      return;
    }

    const nextNumber =
      Object.keys(teamsState.teamSettingsByTeam).filter((teamId) => teamId.startsWith('team_dynamic_')).length + 1;
    setAddTeamSavingTag(`TEAM-${String(nextNumber).padStart(2, '0')}`);
  }, [addTeamSavingTag, showAddTeamModal, teamsState.teamSettingsByTeam]);

  const openAddUserTeamModal = () => {
    setAddTeamName('');
    setAddTeamProvider('OpenAI');
    setAddTeamSavingDefault('Documentation Mode');
    setAddTeamSavingTag('');
    setShowAddTeamModal(true);
  };

  const handleSaveNode = () => {
    if (!selectedNode) {
      return;
    }

    const nextLeadLabel = draftLabel.trim() || selectedNode.label;
    const nextAgentLabel = draftAgentLabel.trim() || selectedAgent?.label || '';

    setTeamsState((current) => ({
      ...current,
      teamsGraph: current.teamsGraph.map((node) => {
        if (node.id === selectedNode.id) {
          return { ...node, label: nextLeadLabel, provider: draftProvider };
        }

        if (node.id === selectedAgentId && selectedAgent) {
          return {
            ...node,
            label: nextAgentLabel || node.label,
            provider: draftAgentProvider,
          };
        }

        return node;
      }),
      teamSettingsByTeam: {
        ...current.teamSettingsByTeam,
        [selectedNode.teamId]: {
          documentationSavingDefault: draftSavingDefault,
          savingTag: draftSavingTag.trim().toUpperCase() || current.teamSettingsByTeam[selectedNode.teamId]?.savingTag || 'TEAM',
        },
      },
    }));
    setToast(
      selectedAgent && selectedAgent.id !== selectedNode.id
        ? 'Team and worker updated.'
        : 'Node updated.',
    );
  };

  const handleAddTeam = () => {
    const numericSuffixes = Object.keys(teamsState.teamSettingsByTeam)
      .filter((teamId) => teamId.startsWith('team_dynamic_'))
      .map((teamId) => Number(teamId.split('_').pop() ?? '0'))
      .filter((value) => Number.isFinite(value));
    const nextNumber = (numericSuffixes.length ? Math.max(...numericSuffixes) : 0) + 1;
    const suffix = String(nextNumber).padStart(2, '0');
    const teamId = `team_dynamic_${suffix}`;
    const managerId = `${teamId}_sm`;
    const label = addTeamName.trim();
    const savingTag = addTeamSavingTag.trim().toUpperCase();

    if (!label) {
      setToast('Enter a team name first.');
      return;
    }

    if (!savingTag) {
      setToast('Enter a saving tag first.');
      return;
    }

    const newNodes: TeamsGraphNode[] = [
      {
        id: managerId,
        type: 'senior_manager',
        label,
        provider: addTeamProvider,
        parentId: 'gm_1',
        teamId,
      },
      ...Array.from({ length: 3 }, (_, index) => ({
        id: `${teamId}_worker_${index + 1}`,
        type: 'worker' as const,
        label: createWorkerLabel(teamId, index + 1),
        provider: PROVIDERS[(PROVIDERS.indexOf(addTeamProvider) + index) % PROVIDERS.length],
        parentId: managerId,
        teamId,
      })),
    ];

    setTeamsState((current) => ({
      teamsGraph: [...current.teamsGraph, ...newNodes],
      foldersByTeam: {
        ...current.foldersByTeam,
        [teamId]: buildFolderSeed(teamId, label),
      },
      teamSettingsByTeam: {
        ...current.teamSettingsByTeam,
        [teamId]: {
          documentationSavingDefault: addTeamSavingDefault,
          savingTag,
        },
      },
    }));
    setShowAddTeamModal(false);
    setAddTeamName('');
    setAddTeamProvider('OpenAI');
    setAddTeamSavingDefault('Documentation Mode');
    setAddTeamSavingTag('');
    setToast('New team added.');
  };

  const handleAddAgent = () => {
    if (!selectedNode || !selectedTeamLead) {
      return;
    }

    const teamWorkers = selectedTeamMembers.filter((node) => node.type === 'worker');
    const nextIndex = teamWorkers.length + 1;
    const nextWorker: TeamsGraphNode = {
      id: `${selectedNode.teamId}_worker_${Date.now()}`,
      type: 'worker',
      label: createWorkerLabel(selectedNode.teamId, nextIndex),
      provider: PROVIDERS[nextIndex % PROVIDERS.length],
      parentId: selectedTeamLead.id,
      teamId: selectedNode.teamId,
    };

    setTeamsState((current) => ({
      ...current,
      teamsGraph: [...current.teamsGraph, nextWorker],
    }));
    setSelectedAgentId(nextWorker.id);
    setToast('Agent added to team.');
  };

  const handlePromoteAgent = () => {
    if (!selectedNode || !selectedTeamLead || !selectedAgentId || selectedAgentId === selectedTeamLead.id) {
      setToast('Select an agent below the team lead to promote.');
      return;
    }

    const promotedAgent = selectedTeamMembers.find((node) => node.id === selectedAgentId);
    if (!promotedAgent) {
      setToast('Selected agent is no longer available.');
      return;
    }

    if (promotedAgent.type !== 'worker') {
      setToast('Select a worker to promote into a new sub-manager branch.');
      return;
    }

    const subManagerCount =
      teamsState.teamsGraph.filter((node) => node.teamId === selectedNode.teamId && node.type === 'senior_manager')
        .length + 1;
    const smIndex = padDocumentIndex(subManagerCount);
    const teamCode = getTeamCode(selectedNode.teamId);

    setPromotionNamingDraft({
      promotedAgentId: promotedAgent.id,
      teamId: selectedNode.teamId,
      smIndex,
      subManagerSuffix: `${teamCode}-Lead`,
      worker1Suffix: `${teamCode}-Specialist`,
      worker2Suffix: `${teamCode}-Support`,
    });
  };

  const handleConfirmPromotionNames = () => {
    if (!selectedNode || !promotionNamingDraft) {
      return;
    }

    const promotedAgent = teamsState.teamsGraph.find((node) => node.id === promotionNamingDraft.promotedAgentId) ?? null;
    if (!promotedAgent || promotedAgent.type !== 'worker') {
      setPromotionNamingDraft(null);
      setToast('Selected worker is no longer available for promotion.');
      return;
    }

    const subManagerSuffix = promotionNamingDraft.subManagerSuffix.trim();
    const worker1Suffix = promotionNamingDraft.worker1Suffix.trim();
    const worker2Suffix = promotionNamingDraft.worker2Suffix.trim();
    if (!subManagerSuffix || !worker1Suffix || !worker2Suffix) {
      setToast('Define names for the new sub-manager and both workers before confirming.');
      return;
    }

    const newSubManagerLabel = buildPromotedSubManagerName(promotionNamingDraft.smIndex, subManagerSuffix);
    const newWorker1Label = buildPromotedWorkerName(promotionNamingDraft.smIndex, 1, worker1Suffix);
    const newWorker2Label = buildPromotedWorkerName(promotionNamingDraft.smIndex, 2, worker2Suffix);
    const childBaseId = `${selectedNode.teamId}_${Date.now()}`;
    const defaultChildren: TeamsGraphNode[] = [
      {
        id: `${childBaseId}_worker_1`,
        type: 'worker',
        label: newWorker1Label,
        provider: PROVIDERS[(PROVIDERS.indexOf(promotedAgent.provider) + 1) % PROVIDERS.length],
        parentId: promotedAgent.id,
        teamId: selectedNode.teamId,
      },
      {
        id: `${childBaseId}_worker_2`,
        type: 'worker',
        label: newWorker2Label,
        provider: PROVIDERS[(PROVIDERS.indexOf(promotedAgent.provider) + 2) % PROVIDERS.length],
        parentId: promotedAgent.id,
        teamId: selectedNode.teamId,
      },
    ];

    setTeamsState((current) => ({
      ...current,
      teamsGraph: [
        ...current.teamsGraph.map((node) =>
          node.id === promotedAgent.id
            ? {
                ...node,
                type: 'senior_manager' as const,
                label: newSubManagerLabel,
                phaseState: 'In Review' as const,
                documentationHistory: {
                  ...node.documentationHistory,
                  historicalWorkerLabel:
                    node.documentationHistory?.historicalWorkerLabel ?? node.label,
                },
              }
            : node,
        ),
        ...defaultChildren,
      ],
    }));
    setPromotionNamingDraft(null);
    setSelectedNodeId(null);
    setSelectedAgentId('');
    setToast('Worker promoted to sub-manager. New branch created with configured names.');
  };

  const handleEraseAgent = () => {
    if (!selectedNode || !selectedAgentId) {
      return;
    }

    const removableAgents = teamAgents;
    if (!removableAgents.some((node) => node.id === selectedAgentId)) {
      setToast('Select an additional team agent to erase.');
      return;
    }

    const descendantIds = collectDescendantIds(selectedTeamMembers, selectedAgentId);
    const removedIds = new Set([selectedAgentId, ...descendantIds]);

    setTeamsState((current) => ({
      ...current,
      teamsGraph: current.teamsGraph.filter((node) => !removedIds.has(node.id)),
    }));
    setToast(descendantIds.length > 0 ? 'Agent branch erased from team.' : 'Agent erased from team.');
  };

  const handleEraseTeam = () => {
    if (!selectedNode || !selectedFamilyLead) {
      return;
    }

    if (selectedFamilyLead.type === 'general_manager') {
      setToast('Main workspace cannot be erased from here.');
      return;
    }

    const removedIds = new Set([
      selectedFamilyLead.id,
      ...collectDescendantIds(teamsState.teamsGraph, selectedFamilyLead.id),
    ]);

    setTeamsState((current) => {
      const nextTeamsGraph = current.teamsGraph.filter((node) => !removedIds.has(node.id));
      const hasRemainingFamilyNodes = nextTeamsGraph.some((node) => node.teamId === selectedFamilyLead.teamId);

      if (hasRemainingFamilyNodes) {
        return {
          ...current,
          teamsGraph: nextTeamsGraph,
        };
      }

      const nextFoldersByTeam = { ...current.foldersByTeam };
      const nextTeamSettingsByTeam = { ...current.teamSettingsByTeam };
      delete nextFoldersByTeam[selectedFamilyLead.teamId];
      delete nextTeamSettingsByTeam[selectedFamilyLead.teamId];

      return {
        teamsGraph: nextTeamsGraph,
        foldersByTeam: nextFoldersByTeam,
        teamSettingsByTeam: nextTeamSettingsByTeam,
      };
    });

    setSelectedNodeId(null);
    setSelectedAgentId('');
    setToast(
      selectedFamilyLead.parentId === 'gm_1'
        ? 'Family team erased from the map.'
        : 'Nested family branch erased from the team.',
    );
  };

  const handleRefreshAgent = () => {
    if (!selectedNode || !selectedAgentId) {
      return;
    }

    setTeamsState((current) => ({
      ...current,
      teamsGraph: current.teamsGraph.map((node) => {
        if (node.id !== selectedAgentId) {
          return node;
        }

        const currentIndex = PROVIDERS.indexOf(node.provider);
        return {
          ...node,
          provider: PROVIDERS[(currentIndex + 1) % PROVIDERS.length],
          phaseState: 'In Review',
        };
      }),
    }));
    setToast('Agent refreshed.');
  };

  const openEditNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setSelectedAgentId(nodeId);
  };

  const openMainWorkspace = (focusAgent: TeamsGraphNode | null = null) => {
    dispatch({
      type: 'SET_WORKSPACE_FOCUS',
      agent:
        focusAgent?.type === 'general_manager'
          ? 'manager'
          : focusAgent
            ? getWorkspaceAgentForTeam(focusAgent.teamId, teamsState.teamsGraph)
            : 'manager',
    });
    dispatch({ type: 'SET_PAGE', page: 'A' });
  };

  const openTeamWorkspace = (node: TeamsGraphNode) => {
    if (node.teamId === CROSS_VERIFICATION_TEAM_ID) {
      if (openStandaloneAppPage('G')) {
        setToast('Cross Verification opened in a new window.');
        return;
      }

      dispatch({ type: 'OPEN_CROSS_VERIFICATION_ROUTE' });
      setToast('Popup blocked. Cross Verification opened in this window.');
      return;
    }

    saveTeamsMapState(teamsState);
    const workspace = getSecondaryWorkspaceTarget(node, teamsState.teamsGraph);

    if (openTeamWorkspaceWindow(workspace, teamsState)) {
      setToast(`${workspace.label} workspace opened in a new window.`);
      return;
    }

    dispatch({
      type: 'SET_SECONDARY_WORKSPACE',
      workspace,
    });
    dispatch({ type: 'SET_PAGE', page: 'F' });
    setToast('Popup blocked. Workspace opened in this window.');
  };

  const teamsContent = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--color-surface-soft)]">
      <div className="scrollbar-thin flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
        <section className="flex min-h-full flex-col gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
          <div
            className="ui-surface flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            style={{
              borderColor: 'rgba(15, 23, 42, 0.12)',
              background:
                'linear-gradient(180deg, rgba(250,252,254,0.98) 0%, rgba(240,245,249,0.98) 100%)',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 26px rgba(15,23,42,0.06)',
            }}
          >
            <div>
              <h1 className="ui-title text-[20px] uppercase tracking-[0.12em]">Teams Map</h1>
              <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-neutral-600">
                Operational Elasticity View
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="rounded-full border p-1"
                style={{
                  borderColor: 'rgba(15, 23, 42, 0.12)',
                  background: 'rgba(255,255,255,0.86)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.72)',
                }}
              >
                {(['map', 'tree'] as TeamsViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                      viewMode === mode
                        ? 'bg-neutral-900 text-white'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                    onClick={() => setViewMode(mode)}
                  >
                    {mode === 'map' ? 'Map' : 'Tree'}
                  </button>
                ))}
              </div>

              <div
                className="ui-surface px-3 py-2 text-xs text-neutral-700"
                style={{
                  borderColor: 'rgba(15, 23, 42, 0.1)',
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(244,247,250,0.95) 100%)',
                }}
              >
                Teams {topLevelUnits.length} / Workers {totalWorkers}
              </div>

              <div
                className="flex items-center gap-2 rounded-full border p-1"
                style={{
                  borderColor: 'rgba(15, 23, 42, 0.12)',
                  background: 'rgba(255,255,255,0.86)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.72)',
                }}
              >
                <button
                  className="ui-button min-h-8 w-8 px-0 text-sm text-neutral-700"
                  onClick={() => setZoomInSignal((value) => value + 1)}
                  title={`Zoom In ${viewMode}`}
                >
                  +
                </button>
                <button
                  className="ui-button min-h-8 w-8 px-0 text-sm text-neutral-700"
                  onClick={() => setZoomOutSignal((value) => value + 1)}
                  title={`Zoom Out ${viewMode}`}
                >
                  -
                </button>
                <button
                  className="ui-button min-h-8 px-3 text-xs text-neutral-700"
                  onClick={() => setResetSignal((value) => value + 1)}
                >
                  Reset
                </button>
              </div>

              <button
                className="ui-button ui-button-primary text-white"
                onClick={openAddUserTeamModal}
              >
                + Add Team
              </button>
            </div>
          </div>

          {generalManager &&
            (viewMode === 'map' ? (
              <TreeStructureView
                projectName={state.projectName}
                generalManager={generalManager}
                topLevelUnits={topLevelUnits}
                teamNodesByTeam={teamNodesByTeam}
                countsByTeam={artifactCountsByTeam}
                teamSettingsByTeam={teamsState.teamSettingsByTeam}
                onOpenMainWorkspace={() => openMainWorkspace(generalManager)}
                onOpenWorkspace={openTeamWorkspace}
                onEditTeam={openEditNode}
                onAddUserTeam={openAddUserTeamModal}
                inlineRename={inlineRename}
                onInlineRenameChange={(value) =>
                  setInlineRename((current) => (current ? { ...current, value } : current))
                }
                onStartInlineRename={startInlineRename}
                onCommitInlineRename={commitInlineRename}
                onCancelInlineRename={cancelInlineRename}
                zoomInSignal={zoomInSignal}
                zoomOutSignal={zoomOutSignal}
                resetSignal={resetSignal}
              />
            ) : (
              <TreeOverviewView
                projectName={state.projectName}
                generalManager={generalManager}
                topLevelUnits={topLevelUnits}
                teamNodesByTeam={teamNodesByTeam}
                onOpenWorkspace={openTeamWorkspace}
                onEditTeam={openEditNode}
                onAddUserTeam={openAddUserTeamModal}
                zoomInSignal={zoomInSignal}
                zoomOutSignal={zoomOutSignal}
                resetSignal={resetSignal}
              />
            ))}
        </section>
      </div>
    </div>
  );

  return (
    <div className="app-page-shell h-full min-h-0 min-w-0 overflow-hidden px-2 py-2 sm:px-3 sm:py-3">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col gap-2">
        <div className="ui-surface app-short-landscape-flex flex items-center justify-between gap-3 px-3 py-2 sm:hidden">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
            Sub-Manager Panel
          </div>
          <button
            className="ui-button min-h-9 px-3 text-xs text-neutral-700"
            onClick={() => setShowManagerMobile((value) => !value)}
          >
            {showManagerMobile ? 'Hide Sub-Manager' : 'Show Sub-Manager'}
          </button>
        </div>

        {showManagerMobile && (
          <div className="app-frame app-short-landscape-flex flex h-[46dvh] min-h-0 overflow-hidden sm:hidden">
            <AgentPanel agent="manager" managerDisplayName={subManagerLabel} />
          </div>
        )}

        <div className="app-frame app-short-landscape-flex flex min-h-0 flex-1 overflow-hidden sm:hidden">
          {teamsContent}
        </div>

        <div className="app-frame app-short-landscape-hide hidden min-h-0 flex-1 overflow-hidden sm:flex">
          <CollapsibleManagerSidebar
            managerDisplayName={subManagerLabel}
            className="w-[280px] shrink-0 md:w-[320px] lg:w-[432px]"
            storageKey="aisync_sm_sidebar_page_d"
          />
          {teamsContent}
        </div>
      </div>

      {showAddTeamModal && (
        <Modal title="Add Team" onClose={() => setShowAddTeamModal(false)} width="max-w-lg">
          <div className="grid gap-4">
            <div className="grid gap-1">
              <span className="ui-label">Team Name</span>
              <input
                className="ui-input text-xs"
                value={addTeamName}
                onChange={(event) => setAddTeamName(event.target.value)}
                placeholder="SM-New Team"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1">
                <span className="ui-label">Documentation Saving Default</span>
                <select
                  className="ui-input text-xs"
                  value={addTeamSavingDefault}
                  onChange={(event) =>
                    setAddTeamSavingDefault(event.target.value as DocumentationSavingDefault)
                  }
                >
                  {DOCUMENTATION_SAVING_DEFAULTS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1">
                <span className="ui-label">Saving Tag</span>
                <input
                  className="ui-input text-xs"
                  value={addTeamSavingTag}
                  onChange={(event) => setAddTeamSavingTag(event.target.value.toUpperCase())}
                  placeholder="TEAM-01"
                />
              </div>
            </div>

            <div className="grid gap-1">
              <span className="ui-label">Lead Provider</span>
              <div className="flex flex-wrap gap-2">
                {PROVIDERS.map((provider) => (
                  <button
                    key={provider}
                    className={`ui-button ${
                      addTeamProvider === provider ? 'ui-button-primary text-white' : 'text-neutral-700'
                    }`}
                    onClick={() => setAddTeamProvider(provider)}
                  >
                    {getProviderDisplayName(provider)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button className="ui-button ui-button-primary text-white" onClick={handleAddTeam}>
                Create Team
              </button>
              <button className="ui-button text-neutral-700" onClick={() => setShowAddTeamModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {promotionNamingDraft && (
        <Modal
          title="Configure Promoted Branch"
          onClose={() => setPromotionNamingDraft(null)}
          width="max-w-lg"
        >
          <div className="grid gap-4">
            <div className="text-xs leading-[1.5] text-neutral-600">
              Define the initial visible names before creating the new documentary branch. The
              numeric prefixes are generated by the system and the suffixes stay editable.
            </div>

            <div className="grid gap-3">
              <label className="grid gap-1">
                <span className="ui-label">New Sub-Manager</span>
                <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                  <div className="ui-surface-subtle rounded-[12px] px-3 py-2 text-xs text-neutral-600">
                    {promotionNamingDraft.smIndex}-SM-
                  </div>
                  <input
                    className="ui-input text-xs"
                    value={promotionNamingDraft.subManagerSuffix}
                    onChange={(event) =>
                      setPromotionNamingDraft((current) =>
                        current ? { ...current, subManagerSuffix: event.target.value } : current,
                      )
                    }
                    autoFocus
                  />
                </div>
              </label>

              <label className="grid gap-1">
                <span className="ui-label">New Worker 1</span>
                <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                  <div className="ui-surface-subtle rounded-[12px] px-3 py-2 text-xs text-neutral-600">
                    {promotionNamingDraft.smIndex}-01-W-
                  </div>
                  <input
                    className="ui-input text-xs"
                    value={promotionNamingDraft.worker1Suffix}
                    onChange={(event) =>
                      setPromotionNamingDraft((current) =>
                        current ? { ...current, worker1Suffix: event.target.value } : current,
                      )
                    }
                  />
                </div>
              </label>

              <label className="grid gap-1">
                <span className="ui-label">New Worker 2</span>
                <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                  <div className="ui-surface-subtle rounded-[12px] px-3 py-2 text-xs text-neutral-600">
                    {promotionNamingDraft.smIndex}-02-W-
                  </div>
                  <input
                    className="ui-input text-xs"
                    value={promotionNamingDraft.worker2Suffix}
                    onChange={(event) =>
                      setPromotionNamingDraft((current) =>
                        current ? { ...current, worker2Suffix: event.target.value } : current,
                      )
                    }
                  />
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button
                className="ui-button text-neutral-700"
                onClick={() => setPromotionNamingDraft(null)}
              >
                Cancel
              </button>
              <button
                className="ui-button ui-button-primary text-white"
                onClick={handleConfirmPromotionNames}
              >
                Edit Names & Create Branch
              </button>
            </div>
          </div>
        </Modal>
      )}

      {selectedNode && !promotionNamingDraft && (
        <Modal
          title={`Edit Team - ${selectedNode.label}`}
          onClose={() => setSelectedNodeId(null)}
          width="max-w-2xl"
        >
          <div className="grid gap-5">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div className="grid gap-1">
                <span className="ui-label">Team Name</span>
                <input
                  className="ui-input text-xs"
                  value={draftLabel}
                  onChange={(event) => setDraftLabel(event.target.value)}
                />
              </div>

              <div className="grid gap-1">
                <span className="ui-label">Lead Role</span>
                <div className="ui-surface-subtle px-3 py-2 text-xs text-neutral-700">
                  {getRoleLabel(selectedNode.type)}
                </div>
              </div>
            </div>

            <div className="grid gap-1">
              <span className="ui-label">Lead Provider</span>
              <div className="flex flex-wrap gap-2">
                {PROVIDERS.map((provider) => (
                  <button
                    key={provider}
                    className={`ui-button ${
                      draftProvider === provider
                        ? 'ui-button-primary text-white'
                        : 'text-neutral-700'
                    }`}
                    onClick={() => setDraftProvider(provider)}
                  >
                    {getProviderDisplayName(provider)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1">
                <span className="ui-label">Documentation Saving Default</span>
                <select
                  className="ui-input text-xs"
                  value={draftSavingDefault}
                  onChange={(event) =>
                    setDraftSavingDefault(event.target.value as DocumentationSavingDefault)
                  }
                >
                  {DOCUMENTATION_SAVING_DEFAULTS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1">
                <span className="ui-label">Saving Tag</span>
                <input
                  className="ui-input text-xs"
                  value={draftSavingTag}
                  onChange={(event) => setDraftSavingTag(event.target.value.toUpperCase())}
                />
              </div>
            </div>

            <div
              className="ui-surface-subtle grid gap-4 rounded-[18px] px-4 py-4"
              style={{
                borderColor: getTeamTheme(selectedNode.teamId).border,
                color: getTeamTheme(selectedNode.teamId).accent,
              }}
            >
              <div className="grid gap-1">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  Team Controls
                </div>
                <div className="text-xs leading-[1.4] text-neutral-600">
                  Use this panel for structural operations: rename, add, promote, erase, refresh,
                  and provider reassignment for the focused agent.
                </div>
              </div>
              <div className="grid gap-1">
                <span className="ui-label">Agent Focus</span>
                <select
                  className="ui-input text-xs"
                  value={selectedAgentId}
                  onChange={(event) => setSelectedAgentId(event.target.value)}
                >
                  {manageableAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.label} | {getRoleLabel(agent.type)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedAgent && (
                <>
                  <div className="grid gap-1">
                    <span className="ui-label">Selected Agent Name</span>
                    <input
                      className="ui-input text-xs"
                      value={draftAgentLabel}
                      onChange={(event) => setDraftAgentLabel(event.target.value)}
                    />
                  </div>

                  <div className="grid gap-1">
                    <span className="ui-label">Selected Agent Provider</span>
                    <div className="flex flex-wrap gap-2">
                      {PROVIDERS.map((provider) => (
                        <button
                          key={`selected-agent-${provider}`}
                          className={`ui-button ${
                            draftAgentProvider === provider
                              ? 'ui-button-primary text-white'
                              : 'text-neutral-700'
                          }`}
                          onClick={() => setDraftAgentProvider(provider)}
                        >
                          {getProviderDisplayName(provider)}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="flex flex-wrap gap-2">
                <button className="ui-button text-neutral-700 shadow-sm" onClick={handleAddAgent}>
                  Add Agent
                </button>
                <button
                  className="ui-button text-neutral-700 shadow-sm"
                  onClick={handlePromoteAgent}
                  disabled={teamAgents.length === 0}
                >
                  Promote Agent
                </button>
                <button
                  className="ui-button text-neutral-700 shadow-sm"
                  onClick={handleEraseAgent}
                  disabled={teamAgents.length === 0}
                >
                  Erase Agent
                </button>
                <button
                  className="ui-button text-neutral-700 shadow-sm"
                  onClick={handleRefreshAgent}
                  disabled={manageableAgents.length === 0}
                >
                  Refresh Agent
                </button>
                <button
                  className="ui-button border-red-200 text-red-700 shadow-sm hover:border-red-300 hover:text-red-800"
                  onClick={handleEraseTeam}
                  disabled={!selectedFamilyLead}
                >
                  Erase Team
                </button>
              </div>

              <div className="text-xs text-neutral-600">
                Add grows the team. Promote creates a new sub-manager branch from the selected
                worker and seeds two child workers. Erase removes the selected agent or branch.
                Refresh cycles the selected agent provider. Erase Team removes only the active
                family scope shown in this Edit modal, never a different family. This modal
                remains the primary place for elasticity operations so the map stays visually
                clean.
              </div>
            </div>

            <div className="flex flex-wrap gap-3 border-t border-neutral-200 pt-4">
              <button
                className="ui-button ui-button-primary text-white"
                onClick={() => {
                  openTeamWorkspace(selectedNode);
                  setSelectedNodeId(null);
                }}
              >
                Go to Workspace
              </button>
              <button className="ui-button ml-auto text-neutral-700" onClick={handleSaveNode}>
                Save changes
              </button>
            </div>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}
