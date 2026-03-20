import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AgentPanel } from '../components/AgentPanel';
import { DividerRail } from '../components/DividerRail';
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
  getInitialTeamsMapState,
  getProviderDisplayName,
  getRoleLabel,
  getSecondaryWorkspaceTarget,
  getTeamTheme,
  getTopLevelUnits,
  getWorkersByTeam,
  getWorkspaceAgentForTeam,
  saveTeamsMapState,
  type DocumentationSavingDefault,
  type TeamsMapState,
} from '../data/teams';
import { openTeamWorkspaceWindow } from '../teamWorkspaceLaunch';
import type { AIProvider, TeamsGraphNode } from '../types';

type TeamsViewMode = 'map' | 'tree';

function getSavingDefaultShortLabel(value: DocumentationSavingDefault) {
  if (value === 'Documentation Mode') return 'Docs Mode';
  if (value === 'Team Workspace') return 'Team Save';
  return 'Audit Log';
}

function CanvasViewport({
  initialZoom,
  minZoom,
  maxZoom,
  contentWidthClass,
  children,
}: {
  initialZoom: number;
  minZoom: number;
  maxZoom: number;
  contentWidthClass: string;
  children: ReactNode;
}) {
  const [zoom, setZoom] = useState(initialZoom);
  const [isDragging, setIsDragging] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const pendingOffsetRef = useRef({ x: 0, y: 0 });
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

  const updateZoom = (nextZoom: number) => {
    setZoom(clampZoom(nextZoom));
  };

  const resetViewport = () => {
    setZoom(initialZoom);
    offsetRef.current = { x: 0, y: 0 };
    pendingOffsetRef.current = { x: 0, y: 0 };
    applyTransform();
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

  useEffect(
    () => () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    },
    [],
  );

  return (
    <div className="relative overflow-hidden rounded-[20px] border border-neutral-200 bg-[var(--color-surface-soft)] shadow-[var(--shadow-soft)]">
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2" data-pan-block="true">
        <button
          className="ui-button min-h-9 w-9 px-0 text-base text-neutral-700"
          onClick={() => updateZoom(zoom + 0.1)}
          title="Zoom In"
        >
          +
        </button>
        <button
          className="ui-button min-h-9 w-9 px-0 text-base text-neutral-700"
          onClick={() => updateZoom(zoom - 0.1)}
          title="Zoom Out"
        >
          -
        </button>
        <button className="ui-button min-h-9 px-3 text-xs text-neutral-700" onClick={resetViewport}>
          Reset
        </button>
      </div>

      <div
        className="relative h-[min(72vh,760px)] min-h-[500px] overflow-hidden select-none"
        style={{ touchAction: 'none', cursor: isDragging ? 'grabbing' : 'grab' }}
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest('[data-pan-block="true"]')) {
            return;
          }

          dragStateRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originX: offsetRef.current.x,
            originY: offsetRef.current.y,
          };
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
        onPointerUp={(event) => stopDragging(event.currentTarget, event.pointerId)}
        onPointerCancel={(event) => stopDragging(event.currentTarget, event.pointerId)}
        onWheel={(event) => {
          event.preventDefault();
          const nextZoom = zoom + (event.deltaY < 0 ? 0.08 : -0.08);
          setZoom(clampZoom(nextZoom));
        }}
      >
        <div className="absolute inset-0 flex items-start justify-center p-2 sm:p-3">
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
  subtitle,
  ribbonColor,
  softColor,
  borderColor,
  accentColor,
  chips,
  compact,
  outlineOnly,
  actionLabel,
  secondaryActionLabel,
  onClick,
  onSecondaryAction,
}: {
  title: string;
  subtitle: string;
  ribbonColor: string;
  softColor: string;
  borderColor: string;
  accentColor: string;
  chips: string[];
  compact?: boolean;
  outlineOnly?: boolean;
  actionLabel: string;
  secondaryActionLabel?: string;
  onClick: () => void;
  onSecondaryAction?: () => void;
}) {
  const shellBackground = outlineOnly ? '#ffffff' : ribbonColor;
  const shellColor = outlineOnly ? accentColor : '#ffffff';

  return (
    <div
      role="button"
      tabIndex={0}
      data-pan-block="true"
      className={`w-full overflow-hidden rounded-[16px] border text-left shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-[1px] ${
        compact ? 'max-w-[180px]' : ''
      }`}
      style={{ borderColor: outlineOnly ? accentColor : borderColor, backgroundColor: softColor }}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <div
        className="px-3 py-2"
        style={{
          backgroundColor: shellBackground,
          color: shellColor,
          borderBottom: outlineOnly ? `1px solid ${borderColor}` : undefined,
        }}
      >
        <div className="text-[9px] uppercase tracking-[0.18em] opacity-75">{subtitle}</div>
        <div className={`mt-1 font-semibold ${compact ? 'text-[11px]' : 'text-[12px]'}`}>{title}</div>
      </div>

      <div className={`grid gap-2 px-3 py-3 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
        <div className="flex flex-wrap gap-1">
          {chips.slice(0, compact ? 2 : 3).map((chip) => (
            <span
              key={`${title}_${chip}`}
              className="rounded-full border px-2 py-0.5"
              style={{ borderColor, color: accentColor, backgroundColor: '#ffffff' }}
            >
              {chip}
            </span>
          ))}
        </div>

        <div className="grid gap-1">
          <div className="h-2.5 rounded-full bg-neutral-100" />
          <div className="h-2.5 rounded-full bg-neutral-100" />
          {!compact && <div className="h-2.5 w-[72%] rounded-full bg-neutral-100" />}
        </div>

        <div className="flex gap-1">
          <span
            className="rounded-md px-2 py-1 text-[9px] font-medium text-white"
            style={{ backgroundColor: ribbonColor }}
          >
            {actionLabel}
          </span>
          {secondaryActionLabel && (
            <button
              data-pan-block="true"
              className="rounded-md border border-neutral-200 px-2 py-1 text-[9px] text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-900"
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
  workersByTeam,
  countsByTeam,
  teamSettingsByTeam,
  onOpenMainWorkspace,
  onOpenWorkspace,
  onEditTeam,
}: {
  projectName: string;
  generalManager: TeamsGraphNode;
  topLevelUnits: TeamsGraphNode[];
  workersByTeam: Record<string, TeamsGraphNode[]>;
  countsByTeam: Record<string, ReturnType<typeof countArtifacts>>;
  teamSettingsByTeam: TeamsMapState['teamSettingsByTeam'];
  onOpenMainWorkspace: () => void;
  onOpenWorkspace: (node: TeamsGraphNode) => void;
  onEditTeam: (nodeId: string) => void;
}) {
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

  return (
    <CanvasViewport initialZoom={0.94} minZoom={0.7} maxZoom={1.12} contentWidthClass="w-[1140px]">
        <div className="flex flex-col items-center">
          <div className="rounded-[18px] border border-neutral-200 bg-white px-6 py-4 text-center shadow-[var(--shadow-soft)]">
            <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Main Project</div>
            <div className="mt-1 text-lg font-semibold text-neutral-900">{projectName}</div>
          </div>

          <div className="h-8 w-px bg-neutral-900/70" />

          <div className="w-full max-w-[760px] rounded-[20px] border border-[rgba(17,17,17,0.12)] bg-white shadow-[var(--shadow-soft)]">
            <div className="rounded-t-[20px] bg-neutral-950 px-5 py-3 text-white">
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/60">Main Workspace</div>
              <div className="mt-1 text-base font-semibold">{generalManager.label}</div>
            </div>

            <div className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(180px,1.15fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <div
                className="rounded-[16px] border px-4 py-4"
                style={{
                  borderColor: 'var(--color-role-manager-border)',
                  backgroundColor: 'var(--color-role-manager-soft)',
                  boxShadow: 'inset 0 2px 0 var(--color-role-manager-accent)',
                }}
              >
                <div
                  className="text-[10px] uppercase tracking-[0.16em]"
                  style={{ color: 'var(--color-role-manager-accent)' }}
                >
                  Manager Node
                </div>
                <div className="mt-2 text-sm font-semibold text-neutral-900">{generalManager.label}</div>
                <div className="mt-2 text-[11px] text-neutral-500">{getProviderDisplayName(generalManager.provider)}</div>
              </div>
              {workspaceRoles.map((role) => (
                <div
                  key={role.label}
                  className="rounded-[16px] border px-4 py-4"
                  style={{
                    borderColor: role.border,
                    backgroundColor: role.soft,
                    boxShadow: `inset 0 2px 0 ${role.accent}`,
                  }}
                >
                  <div
                    className="text-[10px] uppercase tracking-[0.16em]"
                    style={{ color: role.accent }}
                  >
                    Core Team
                  </div>
                  <div className="mt-2 text-sm font-semibold text-neutral-900">{role.label}</div>
                  <div className="mt-2 text-[11px] text-neutral-500">Main Workspace chatbox</div>
                </div>
              ))}
            </div>

            <div className="flex justify-center gap-2 border-t border-neutral-200 px-4 py-4">
              <button className="ui-button ui-button-primary text-white" onClick={onOpenMainWorkspace} data-pan-block="true">
                Go to Main Workspace
              </button>
            </div>
          </div>

          <div className="mt-6 h-8 w-px bg-neutral-900/70" />

          <div className="relative w-full pt-8">
            <div className="absolute left-1/2 top-0 h-8 w-px -translate-x-1/2 bg-neutral-900/70" />
            <div className="absolute left-[10%] right-[10%] top-8 h-px bg-neutral-900/70" />

            <div className="grid gap-6 pt-6 xl:grid-cols-3">
              {topLevelUnits.map((unit) => {
                const theme = getTeamTheme(unit.teamId);
                const allWorkers = workersByTeam[unit.teamId] ?? [];
                const visibleWorkers =
                  unit.type === 'worker'
                    ? allWorkers.filter((worker) => worker.id !== unit.id)
                    : allWorkers;
                const counts = countsByTeam[unit.teamId] ?? {
                  conversations: 0,
                  documents: 0,
                  reports: 0,
                };
                const teamSettings = teamSettingsByTeam[unit.teamId];
                const isDirectUnit = unit.type === 'worker';

                return (
                  <div key={unit.id} className="relative flex flex-col items-center">
                    <div className="absolute top-0 h-6 w-px bg-neutral-900/70" />

                    <div className="w-full pt-6">
                      <div className="flex flex-col items-center">
                        <TreeWorkspaceCard
                          title={unit.label}
                          subtitle={
                            unit.type === 'senior_manager'
                              ? 'Sub-Team Workspace'
                              : 'Direct Team Workspace'
                          }
                          ribbonColor={theme.ribbon}
                          softColor={theme.soft}
                          borderColor={theme.border}
                          accentColor={theme.accent}
                          chips={[
                            getProviderDisplayName(unit.provider),
                            getSavingDefaultShortLabel(teamSettings?.documentationSavingDefault ?? 'Documentation Mode'),
                            `Tag ${teamSettings?.savingTag ?? 'TEAM'}`,
                          ]}
                          outlineOnly={isDirectUnit}
                          actionLabel="Open"
                          secondaryActionLabel="Edit Team"
                          onClick={() => onOpenWorkspace(unit)}
                          onSecondaryAction={() => onEditTeam(unit.id)}
                        />

                        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                          <span>{counts.conversations} conversations</span>
                          <span>{counts.documents} documents</span>
                          <span>{counts.reports} reports</span>
                        </div>

                        {visibleWorkers.length > 0 && (
                          <>
                            <div className="h-5 w-px bg-neutral-900/70" />
                            <div className="relative w-full px-5 pt-3">
                              {visibleWorkers.length > 1 && (
                                <div className="absolute left-[18%] right-[18%] top-0 h-px bg-neutral-900/70" />
                              )}
                              <div
                                className="grid gap-3 pt-3"
                                style={{
                                  gridTemplateColumns: `repeat(${Math.min(Math.max(visibleWorkers.length, 1), 3)}, minmax(0, 1fr))`,
                                }}
                              >
                                {visibleWorkers.map((worker) => (
                                  <div key={worker.id} className="flex flex-col items-center">
                                    <div className="h-3 w-px bg-neutral-900/70" />
                                    <TreeWorkspaceCard
                                      title={worker.label}
                                      subtitle="Worker"
                                      ribbonColor={theme.ribbon}
                                      softColor={theme.soft}
                                      borderColor={theme.border}
                                      accentColor={theme.accent}
                                      chips={[getProviderDisplayName(worker.provider), 'Worker']}
                                      compact
                                      actionLabel="Workspace"
                                      onClick={() => onOpenWorkspace(unit)}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CanvasViewport>
  );
}

function TreeOverviewView({
  projectName,
  generalManager,
  topLevelUnits,
  workersByTeam,
  onOpenWorkspace,
  onEditTeam,
}: {
  projectName: string;
  generalManager: TeamsGraphNode;
  topLevelUnits: TeamsGraphNode[];
  workersByTeam: Record<string, TeamsGraphNode[]>;
  onOpenWorkspace: (node: TeamsGraphNode) => void;
  onEditTeam: (nodeId: string) => void;
}) {
  return (
    <CanvasViewport initialZoom={0.82} minZoom={0.55} maxZoom={1.15} contentWidthClass="w-[900px]">
        <div className="flex flex-col items-center">
          <div className="mb-4 max-w-3xl text-center">
            <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Tree</div>
            <div className="mt-1 text-sm text-neutral-600">
              Minimal organizational overview only. Use this to see the whole structure at a glance,
              then click a team node to open its workspace in a separate window.
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="rounded-full border border-neutral-200 bg-white px-5 py-3 text-center shadow-[var(--shadow-soft)]">
              <div className="text-[9px] uppercase tracking-[0.18em] text-neutral-500">Project</div>
              <div className="mt-1 text-sm font-semibold text-neutral-900">{projectName}</div>
            </div>

            <div className="h-7 w-px bg-neutral-900/55" />

            <div className="rounded-full border border-neutral-200 bg-neutral-950 px-6 py-3 text-center text-white shadow-[var(--shadow-soft)]">
              <div className="text-[9px] uppercase tracking-[0.18em] text-white/55">Main Workspace</div>
              <div className="mt-1 text-sm font-semibold">{generalManager.label}</div>
            </div>

            <div className="mt-5 h-8 w-px bg-neutral-900/55" />

            <div className="relative w-full pt-8">
              <div className="absolute left-1/2 top-0 h-8 w-px -translate-x-1/2 bg-neutral-900/55" />
              <div className="absolute left-[10%] right-[10%] top-8 h-px bg-neutral-900/55" />

              <div className="grid gap-6 pt-6 xl:grid-cols-3">
                {topLevelUnits.map((unit) => {
                  const theme = getTeamTheme(unit.teamId);
                  const workers = workersByTeam[unit.teamId] ?? [];
                  const visibleWorkers =
                    unit.type === 'worker'
                      ? workers.filter((worker) => worker.id !== unit.id)
                      : workers;

                  return (
                    <div key={unit.id} className="relative flex flex-col items-center">
                      <div className="absolute top-0 h-6 w-px bg-neutral-900/55" />

                      <button
                        data-pan-block="true"
                        className="w-full rounded-full border px-4 py-3 text-center shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-[1px]"
                        style={{
                          borderColor: theme.ribbon,
                          backgroundColor: theme.ribbon,
                        }}
                        onClick={() => onOpenWorkspace(unit)}
                      >
                        <div
                          className="text-[9px] uppercase tracking-[0.18em]"
                          style={{ color: 'rgba(255,255,255,0.72)' }}
                        >
                          Team Node
                        </div>
                        <div className="mt-1 text-sm font-semibold text-white">{unit.label}</div>
                      </button>
                      <button
                        data-pan-block="true"
                        className="mt-2 ui-button min-h-8 px-3 text-[11px] text-neutral-700"
                        onClick={() => onEditTeam(unit.id)}
                      >
                        Edit Team
                      </button>

                      {visibleWorkers.length > 0 && (
                        <>
                          <div className="h-4 w-px bg-neutral-900/55" />
                          <div className="relative w-full px-6 pt-3">
                            {visibleWorkers.length > 1 && (
                              <div className="absolute left-[20%] right-[20%] top-0 h-px bg-neutral-900/55" />
                            )}
                            <div
                              className="grid gap-3 pt-3"
                              style={{
                                gridTemplateColumns: `repeat(${Math.min(Math.max(visibleWorkers.length, 1), 3)}, minmax(0, 1fr))`,
                              }}
                              >
                              {visibleWorkers.map((worker) => (
                                <div key={worker.id} className="flex flex-col items-center">
                                  <div className="h-3 w-px bg-neutral-900/55" />
                                  <button
                                    data-pan-block="true"
                                    className="rounded-full border px-3 py-2 text-[10px] font-medium shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-[1px]"
                                    style={{
                                      borderColor: theme.ribbon,
                                      backgroundColor: theme.ribbon,
                                      color: '#ffffff',
                                    }}
                                    onClick={() => onOpenWorkspace(unit)}
                                  >
                                    {worker.label}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </CanvasViewport>
  );
}

export function PageD() {
  const { state, dispatch } = useApp();
  const [showManagerMobile, setShowManagerMobile] = useState(false);
  const [teamsState, setTeamsState] = useState<TeamsMapState>(getInitialTeamsMapState);
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [draftLabel, setDraftLabel] = useState('');
  const [draftProvider, setDraftProvider] = useState<AIProvider>('OpenAI');
  const [draftSavingDefault, setDraftSavingDefault] = useState<DocumentationSavingDefault>('Documentation Mode');
  const [draftSavingTag, setDraftSavingTag] = useState('');
  const [addTeamName, setAddTeamName] = useState('');
  const [addTeamProvider, setAddTeamProvider] = useState<AIProvider>('OpenAI');
  const [addTeamSavingDefault, setAddTeamSavingDefault] = useState<DocumentationSavingDefault>('Documentation Mode');
  const [addTeamSavingTag, setAddTeamSavingTag] = useState('');
  const [toast, setToast] = useState('');
  const [viewMode, setViewMode] = useState<TeamsViewMode>('map');

  useEffect(() => {
    saveTeamsMapState(teamsState);
  }, [teamsState]);

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
    () => getTopLevelUnits(teamsState.teamsGraph),
    [teamsState.teamsGraph],
  );
  const workersByTeam = useMemo(
    () => getWorkersByTeam(teamsState.teamsGraph),
    [teamsState.teamsGraph],
  );
  const artifactCountsByTeam = useMemo(
    () =>
      Object.fromEntries(
        topLevelUnits.map((unit) => [unit.teamId, countArtifacts(teamsState.foldersByTeam[unit.teamId] ?? [])]),
      ),
    [teamsState.foldersByTeam, topLevelUnits],
  );
  const totalWorkers = teamsState.teamsGraph.filter((node) => node.type === 'worker').length;
  const selectedTeamMembers = useMemo(
    () =>
      selectedNode
        ? teamsState.teamsGraph.filter((node) => node.teamId === selectedNode.teamId)
        : [],
    [selectedNode, teamsState.teamsGraph],
  );
  const selectedTeamLead =
    selectedTeamMembers.find((node) => node.parentId === 'gm_1') ?? selectedNode;
  const teamAgents = selectedTeamMembers.filter((node) => node.id !== selectedTeamLead?.id);
  const manageableAgents = teamAgents.length > 0 ? teamAgents : selectedTeamMembers;

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

  const handleSaveNode = () => {
    if (!selectedNode) {
      return;
    }

    setTeamsState((current) => ({
      ...current,
      teamsGraph: current.teamsGraph.map((node) =>
        node.id === selectedNode.id
          ? { ...node, label: draftLabel.trim() || node.label, provider: draftProvider }
          : node,
      ),
      teamSettingsByTeam: {
        ...current.teamSettingsByTeam,
        [selectedNode.teamId]: {
          documentationSavingDefault: draftSavingDefault,
          savingTag: draftSavingTag.trim().toUpperCase() || current.teamSettingsByTeam[selectedNode.teamId]?.savingTag || 'TEAM',
        },
      },
    }));
    setToast('Node updated.');
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

    const leadLabel = selectedTeamLead.label;
    const promotedLabel = promotedAgent.label;

    setTeamsState((current) => ({
      ...current,
      teamsGraph: current.teamsGraph.map((node) => {
        if (node.teamId !== selectedNode.teamId) {
          return node;
        }

        if (node.id === promotedAgent.id) {
          return {
            ...node,
            type: selectedTeamLead.type === 'senior_manager' ? 'senior_manager' : 'worker',
            parentId: 'gm_1',
            label: leadLabel,
            phaseState: 'In Review',
          };
        }

        if (node.id === selectedTeamLead.id) {
          return {
            ...node,
            type: 'worker',
            parentId: promotedAgent.id,
            label: promotedLabel,
          };
        }

        if (node.parentId === selectedTeamLead.id) {
          return {
            ...node,
            parentId: promotedAgent.id,
          };
        }

        return node;
      }),
    }));
    setSelectedNodeId(promotedAgent.id);
    setSelectedAgentId(selectedTeamLead.id);
    setToast('Agent promoted to team lead.');
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

    setTeamsState((current) => ({
      ...current,
      teamsGraph: current.teamsGraph.filter((node) => node.id !== selectedAgentId),
    }));
    setToast('Agent erased from team.');
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

    const workspace = getSecondaryWorkspaceTarget(node);

    if (openTeamWorkspaceWindow(workspace)) {
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
          <div className="ui-surface flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <h1 className="ui-title text-[20px] uppercase tracking-[0.12em]">Teams Map</h1>
              <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                Operational Elasticity View
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full border border-neutral-200 bg-white p-1">
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

              <div className="ui-surface px-3 py-2 text-xs text-neutral-600">
                Teams {topLevelUnits.length} / Workers {totalWorkers}
              </div>

              <button
                className="ui-button ui-button-primary text-white"
                onClick={() => {
                  setAddTeamName('');
                  setAddTeamProvider('OpenAI');
                  setAddTeamSavingDefault('Documentation Mode');
                  setAddTeamSavingTag('');
                  setShowAddTeamModal(true);
                }}
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
                workersByTeam={workersByTeam}
                countsByTeam={artifactCountsByTeam}
                teamSettingsByTeam={teamsState.teamSettingsByTeam}
                onOpenMainWorkspace={() => openMainWorkspace(generalManager)}
                onOpenWorkspace={openTeamWorkspace}
                onEditTeam={setSelectedNodeId}
              />
            ) : (
              <TreeOverviewView
                projectName={state.projectName}
                generalManager={generalManager}
                topLevelUnits={topLevelUnits}
                workersByTeam={workersByTeam}
                onOpenWorkspace={openTeamWorkspace}
                onEditTeam={setSelectedNodeId}
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
            Manager Panel
          </div>
          <button
            className="ui-button min-h-9 px-3 text-xs text-neutral-700"
            onClick={() => setShowManagerMobile((value) => !value)}
          >
            {showManagerMobile ? 'Hide Manager' : 'Show Manager'}
          </button>
        </div>

        {showManagerMobile && (
          <div className="app-frame app-short-landscape-flex flex h-[46dvh] min-h-0 overflow-hidden sm:hidden">
            <AgentPanel agent="manager" />
          </div>
        )}

        <div className="app-frame app-short-landscape-flex flex min-h-0 flex-1 overflow-hidden sm:hidden">
          {teamsContent}
        </div>

        <div className="app-frame app-short-landscape-hide hidden min-h-0 flex-1 overflow-hidden sm:flex">
          <AgentPanel agent="manager" className="w-[280px] shrink-0 md:w-[320px] lg:w-[432px]" />
          <DividerRail />
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

      {selectedNode && (
        <Modal
          title={`Edit Team - ${selectedNode.label}`}
          onClose={() => setSelectedNodeId(null)}
          width="max-w-xl"
        >
          <div className="grid gap-4">
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
              className="ui-surface-subtle grid gap-3 px-3 py-3"
              style={{
                borderColor: getTeamTheme(selectedNode.teamId).border,
                color: getTeamTheme(selectedNode.teamId).accent,
              }}
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                Team Controls
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

              <div className="flex flex-wrap gap-2">
                <button className="ui-button text-neutral-700" onClick={handleAddAgent}>
                  Add Agent
                </button>
                <button
                  className="ui-button text-neutral-700"
                  onClick={handlePromoteAgent}
                  disabled={teamAgents.length === 0}
                >
                  Promote Agent
                </button>
                <button
                  className="ui-button text-neutral-700"
                  onClick={handleEraseAgent}
                  disabled={teamAgents.length === 0}
                >
                  Erase Agent
                </button>
                <button
                  className="ui-button text-neutral-700"
                  onClick={handleRefreshAgent}
                  disabled={manageableAgents.length === 0}
                >
                  Refresh Agent
                </button>
              </div>

              <div className="text-xs text-neutral-600">
                Add grows the team. Promote swaps the selected agent into the lead slot. Erase
                removes an additional agent. Refresh cycles the selected agent provider.
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
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
