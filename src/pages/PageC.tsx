import { useEffect, useMemo, useRef, useState } from 'react';
import { getAuditEventIdFromLocation } from '../auditLogLaunch';
import { buildAuditLogEntries, type AuditLogEntry } from '../auditLog';
import { AgentPanel } from '../components/AgentPanel';
import { CollapsibleManagerSidebar } from '../components/CollapsibleManagerSidebar';
import { FileViewer } from '../components/FileViewer';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { useApp } from '../context';
import { getTeamTheme } from '../data/teams';
import { getSecondarySubManagerLabel } from '../pageLabels';
import { getWorkPhaseClassName, getWorkPhaseState } from '../phaseState';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

type AuditViewMode = 'month' | 'week' | 'day';

type AuditFilters = {
  activity: 'all' | 'saved-chat-versions';
  user: string;
  team: string;
  worker: string;
  manager: string;
};

function parseDateParts(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

function buildDateFromKey(date: string) {
  const { year, month, day } = parseDateParts(date);
  return new Date(year, month - 1, day);
}

function buildDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date: Date, amount: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
}

function getStartOfWeek(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - next.getDay());
  return next;
}

function isSameDay(left: Date, right: Date) {
  return buildDateKey(left) === buildDateKey(right);
}

function getMonthCells(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<Date | null> = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function getAgentLabel(agent: AuditLogEntry['accentRole']) {
  if (agent === 'manager') return 'Manager';
  if (agent === 'worker1') return 'Worker 1';
  return 'Worker 2';
}

function getAgentAccent(agent: AuditLogEntry['accentRole']) {
  if (agent === 'manager') return 'var(--color-role-manager-accent)';
  if (agent === 'worker1') return 'var(--color-role-worker1-accent)';
  return 'var(--color-role-worker2-accent)';
}

function getEventTheme(event: AuditLogEntry) {
  if (!event.teamId || event.teamId === 'global') {
    return {
      ribbon: '#111827',
      soft: 'rgba(17, 24, 39, 0.08)',
      border: 'rgba(17, 24, 39, 0.16)',
      accent: '#111827',
    };
  }

  return getTeamTheme(event.teamId);
}

function formatPeriodLabel(date: Date, viewMode: AuditViewMode) {
  if (viewMode === 'month') {
    return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
  }

  if (viewMode === 'week') {
    const start = getStartOfWeek(date);
    const end = addDays(start, 6);
    return `${MONTH_NAMES[start.getMonth()]} ${start.getDate()} - ${MONTH_NAMES[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getViewDescription(viewMode: AuditViewMode) {
  if (viewMode === 'month') {
    return 'Month keeps the overview visual and dense. Use color for origin, then zoom or click for full detail.';
  }

  if (viewMode === 'week') {
    return 'Week exposes actor, action, team, and phase without losing the calendar rhythm.';
  }

  return 'Day surfaces the operational record with time, owner, phase, output, and traceable context.';
}

function buildEventSummary(event: AuditLogEntry) {
  const actor = event.actorLabel ?? getAgentLabel(event.accentRole);
  const action = event.actionLabel ?? 'Audit event logged';
  const team = event.teamLabel ?? 'Main Workspace';
  const output = event.outputLabel;
  return `${actor} logged "${action}" for ${team}. Output linked: ${output}.`;
}

export function PageC() {
  const { state, dispatch } = useApp();
  const subManagerLabel = getSecondarySubManagerLabel('C');
  const launchAppliedRef = useRef(false);
  const [showManagerMobile, setShowManagerMobile] = useState(false);
  const [showHowToUse, setShowHowToUse] = useState(false);
  const [viewMode, setViewMode] = useState<AuditViewMode>('month');
  const [focusDate, setFocusDate] = useState(() => new Date());
  const [filters, setFilters] = useState<AuditFilters>({
    activity: 'all',
    user: 'all',
    team: 'all',
    worker: 'all',
    manager: 'all',
  });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [openFileId, setOpenFileId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const normalizedEvents = useMemo(
    () =>
      buildAuditLogEntries({
        activityEvents: state.activityEvents,
        savedObjects: state.savedObjects,
        savedFiles: state.savedFiles,
        calendarEvents: state.calendarEvents,
        projects: state.projects,
        userName: state.userName,
      }).map((event) => ({
        ...event,
        phaseState: getWorkPhaseState(event.phaseState),
      })),
    [
      state.activityEvents,
      state.calendarEvents,
      state.projects,
      state.savedFiles,
      state.savedObjects,
      state.userName,
    ],
  );

  const filterOptions = useMemo(
    () => ({
      users: [...new Set(normalizedEvents.map((event) => event.userLabel).filter(Boolean))],
      teams: [...new Set(normalizedEvents.map((event) => event.teamLabel).filter(Boolean))],
      workers: [
        ...new Set(
          normalizedEvents
            .map((event) => event.workerLabel)
            .filter((value): value is string => Boolean(value)),
        ),
      ],
      managers: [...new Set(normalizedEvents.map((event) => event.managerLabel).filter(Boolean))],
    }),
    [normalizedEvents],
  );

  const filteredEvents = useMemo(
    () =>
      normalizedEvents.filter((event) => {
        if (
          filters.activity === 'saved-chat-versions' &&
          !(event.eventType === 'save-version' || event.versionReference)
        )
          return false;
        if (filters.user !== 'all' && event.userLabel !== filters.user) return false;
        if (filters.team !== 'all' && event.teamLabel !== filters.team) return false;
        if (filters.worker !== 'all' && event.workerLabel !== filters.worker) return false;
        if (filters.manager !== 'all' && event.managerLabel !== filters.manager) return false;
        return true;
      }),
    [filters.activity, filters.manager, filters.team, filters.user, filters.worker, normalizedEvents],
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, typeof filteredEvents>();

    filteredEvents.forEach((event) => {
      const current = map.get(event.date) ?? [];
      map.set(
        event.date,
        [...current, event].sort((left, right) => left.time.localeCompare(right.time)),
      );
    });

    return map;
  }, [filteredEvents]);

  const openFile = state.savedFiles.find((file) => file.id === openFileId) ?? null;
  const openProject =
    state.projects.find((project) => project.id === openFile?.projectId) ?? null;
  const selectedEvent = normalizedEvents.find((event) => event.id === selectedEventId) ?? null;
  const selectedEventFile = selectedEvent?.linkedFile ?? null;
  const selectedEventProject =
    state.projects.find((project) => project.id === selectedEvent?.projectId) ?? null;
  const auditEventIdFromLocation = useMemo(getAuditEventIdFromLocation, []);

  useEffect(() => {
    if (launchAppliedRef.current) {
      return;
    }

    launchAppliedRef.current = true;

    if (!auditEventIdFromLocation) {
      return;
    }

    setSelectedEventId(auditEventIdFromLocation);
  }, [auditEventIdFromLocation]);

  const monthCells = useMemo(() => getMonthCells(focusDate), [focusDate]);
  const mobileMonthEventGroups = useMemo(
    () =>
      Array.from(eventsByDate.entries())
        .filter(([date]) => {
          const eventDate = buildDateFromKey(date);
          return (
            eventDate.getFullYear() === focusDate.getFullYear() &&
            eventDate.getMonth() === focusDate.getMonth()
          );
        })
        .sort(([left], [right]) => left.localeCompare(right)),
    [eventsByDate, focusDate],
  );

  const weekDates = useMemo(() => {
    const start = getStartOfWeek(focusDate);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [focusDate]);

  const dayEvents = eventsByDate.get(buildDateKey(focusDate)) ?? [];

  const teamLegend = useMemo(
    () =>
      filterOptions.teams.map((teamLabel) => {
        const event = normalizedEvents.find((candidate) => candidate.teamLabel === teamLabel);
        return {
          teamLabel,
          theme: getEventTheme(
            event ??
              ({
                teamId: 'global',
                accentRole: 'manager',
              } as AuditLogEntry),
          ),
        };
      }),
    [filterOptions.teams, normalizedEvents],
  );

  const goToPrevious = () => {
    if (viewMode === 'month') {
      setFocusDate((value) => addMonths(value, -1));
      return;
    }

    if (viewMode === 'week') {
      setFocusDate((value) => addDays(value, -7));
      return;
    }

    setFocusDate((value) => addDays(value, -1));
  };

  const goToNext = () => {
    if (viewMode === 'month') {
      setFocusDate((value) => addMonths(value, 1));
      return;
    }

    if (viewMode === 'week') {
      setFocusDate((value) => addDays(value, 7));
      return;
    }

    setFocusDate((value) => addDays(value, 1));
  };

  const resetFocus = () => setFocusDate(new Date());

  const toggleTeamFilter = (teamLabel: string) => {
    setFilters((current) => ({
      ...current,
      team: current.team === teamLabel ? 'all' : teamLabel,
    }));
  };

  const openEvent = (event: AuditLogEntry) => {
    setSelectedEventId(event.id);
  };

  const openLinkedFile = (event: AuditLogEntry) => {
    const file = event.linkedFileId
      ? state.savedFiles.find((candidate) => candidate.id === event.linkedFileId)
      : null;

    if (!file) {
      setToast('Linked file not found.');
      return;
    }

    setSelectedEventId(null);
    setOpenFileId(file.id);
  };

  const renderMonthEvent = (event: AuditLogEntry) => {
    const theme = getEventTheme(event);

    return (
      <button
        key={event.id}
        className="w-full truncate rounded-[8px] border px-1.5 py-1 text-left text-[9px] font-medium"
        style={{
          borderColor: theme.border,
          backgroundColor: theme.soft,
          color: theme.accent,
        }}
        onClick={(clickEvent) => {
          clickEvent.stopPropagation();
          openEvent(event);
        }}
        title={`${event.time} ${event.actionLabel}`}
      >
        <span
          className="mr-1 inline-flex h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: getAgentAccent(event.accentRole) }}
        />
        <span className="mr-1 font-semibold">{event.time}</span>
        <span>{event.actionLabel}</span>
      </button>
    );
  };

  const renderWeekEvent = (event: AuditLogEntry) => {
    const theme = getEventTheme(event);

    return (
      <button
        key={event.id}
        className="rounded-[12px] border bg-white px-3 py-3 text-left shadow-[var(--shadow-soft)]"
        style={{ borderColor: theme.border, boxShadow: `inset 0 2px 0 ${theme.ribbon}` }}
        onClick={(clickEvent) => {
          clickEvent.stopPropagation();
          openEvent(event);
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-neutral-900">{event.time}</div>
          <span className={getWorkPhaseClassName(event.phaseState ?? 'Open')}>
            {event.phaseState}
          </span>
        </div>
        <div className="mt-2 text-sm font-semibold text-neutral-900">{event.actionLabel}</div>
        <div className="mt-1 text-xs text-neutral-600">{event.outputLabel}</div>
        <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
          <span className="ui-pill" style={{ borderColor: theme.border, color: theme.accent }}>
            {event.teamLabel}
          </span>
          <span className="ui-pill border-neutral-200 text-neutral-700">
            {event.actorLabel}
          </span>
          <span className="ui-pill border-neutral-200 text-neutral-500">
            {getAgentLabel(event.accentRole)}
          </span>
        </div>
      </button>
    );
  };

  const renderDayEvent = (event: AuditLogEntry) => {
    const theme = getEventTheme(event);

    return (
      <button
        key={event.id}
        className="rounded-[16px] border bg-white px-4 py-4 text-left shadow-[var(--shadow-soft)]"
        style={{ borderColor: theme.border, boxShadow: `inset 0 2px 0 ${theme.ribbon}` }}
        onClick={(clickEvent) => {
          clickEvent.stopPropagation();
          openEvent(event);
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-neutral-900">{event.time}</div>
            <div className="mt-1 text-base font-semibold text-neutral-900">{event.actionLabel}</div>
          </div>
          <span className={getWorkPhaseClassName(event.phaseState ?? 'Open')}>
            {event.phaseState}
          </span>
        </div>

        <div className="mt-3 grid gap-3 text-sm text-neutral-700 md:grid-cols-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-400">Actor</div>
            <div className="mt-1 flex items-center gap-2">
                <span
                  className="inline-flex h-2 w-2 rounded-full"
                  style={{ backgroundColor: getAgentAccent(event.accentRole) }}
                />
                <span>{event.actorLabel}</span>
              </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-400">Output</div>
            <div className="mt-1">{event.outputLabel}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-400">Team</div>
            <div className="mt-1">{event.teamLabel}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-400">Requested By</div>
            <div className="mt-1">{event.userLabel}</div>
          </div>
        </div>
      </button>
    );
  };

  const renderMonthView = (
    <>
      <div className="app-short-landscape-grid grid gap-3 sm:hidden">
        {mobileMonthEventGroups.length > 0 ? (
          mobileMonthEventGroups.map(([date, events]) => {
            const eventDate = buildDateFromKey(date);
            return (
              <div
                key={date}
                className="ui-surface-subtle px-3 py-3"
                onClick={() => {
                  setFocusDate(eventDate);
                  setViewMode('day');
                }}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-neutral-900">
                    {MONTH_NAMES[eventDate.getMonth()]} {eventDate.getDate()}, {eventDate.getFullYear()}
                  </div>
                  <div className="text-[11px] text-neutral-500">{events.length} events</div>
                </div>
                <div className="grid gap-2">
                  {events.map((event) => renderWeekEvent(event))}
                </div>
              </div>
            );
          })
        ) : (
          <div className="ui-surface-subtle flex min-h-[220px] items-center justify-center px-4 text-center text-sm text-neutral-500">
            No events scheduled for this month.
          </div>
        )}
      </div>

      <div className="app-short-landscape-hide hidden sm:block">
        <div className="grid grid-cols-7 gap-1">
          {DAY_NAMES.map((name) => (
            <div
              key={name}
              className="py-1 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500"
            >
              {name}
            </div>
          ))}
        </div>

        <div className="mt-1 grid flex-1 auto-rows-fr grid-cols-7 gap-1">
          {monthCells.map((cellDate, index) => {
            const dayKey = cellDate ? buildDateKey(cellDate) : null;
            const events = dayKey ? eventsByDate.get(dayKey) ?? [] : [];
            const isFocused = cellDate ? isSameDay(cellDate, focusDate) : false;

            return (
              <div
                key={`${dayKey ?? 'empty'}_${index}`}
                className={`min-h-[116px] rounded-[12px] border p-1.5 ${
                  cellDate ? 'bg-[var(--color-surface-soft)]' : 'border-transparent bg-transparent'
                }`}
                style={{
                  borderColor: cellDate
                    ? isFocused
                      ? 'rgba(17, 24, 39, 0.24)'
                      : 'rgba(17, 24, 39, 0.08)'
                    : 'transparent',
                }}
                onClick={() => {
                  if (!cellDate) {
                    return;
                  }
                  setFocusDate(cellDate);
                  setViewMode('day');
                }}
              >
                {cellDate && (
                  <>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-neutral-700">{cellDate.getDate()}</div>
                      {events.length > 0 && (
                        <div className="text-[10px] text-neutral-400">{events.length}</div>
                      )}
                    </div>
                    <div className="grid gap-0.5">
                      {events.slice(0, 4).map((event) => renderMonthEvent(event))}
                      {events.length > 4 && (
                        <button
                          className="px-1.5 text-left text-[9px] text-neutral-400 hover:text-neutral-700"
                          onClick={(clickEvent) => {
                            clickEvent.stopPropagation();
                            setFocusDate(cellDate);
                            setViewMode('day');
                          }}
                        >
                          +{events.length - 4} more
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );

  const renderWeekView = (
    <>
      <div className="grid gap-3 sm:hidden">
        {weekDates.map((date) => {
          const dateKey = buildDateKey(date);
          const events = eventsByDate.get(dateKey) ?? [];

          return (
            <div key={dateKey} className="ui-surface-subtle px-3 py-3">
              <button
                className="mb-2 flex w-full items-center justify-between gap-3 rounded-[10px] px-1 py-1 text-left hover:bg-white"
                onClick={() => {
                  setFocusDate(date);
                  setViewMode('day');
                }}
              >
                <div className="text-sm font-semibold text-neutral-900">
                  {DAY_NAMES[date.getDay()]}, {MONTH_NAMES[date.getMonth()]} {date.getDate()}
                </div>
                <div className="text-[11px] text-neutral-500">{events.length} events</div>
              </button>
              {events.length > 0 ? (
                <div className="grid gap-2">{events.map((event) => renderWeekEvent(event))}</div>
              ) : (
                <div className="rounded-[12px] border border-dashed border-neutral-200 px-3 py-4 text-sm text-neutral-400">
                  No filtered activity on this day.
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="hidden sm:block">
        <div className="overflow-x-auto">
          <div className="grid min-w-[920px] grid-cols-7 gap-2">
            {weekDates.map((date) => {
              const dateKey = buildDateKey(date);
              const events = eventsByDate.get(dateKey) ?? [];
              const isFocused = isSameDay(date, focusDate);

              return (
                <div
                  key={dateKey}
                  className="ui-surface-subtle min-h-[420px] px-2 py-3"
                  style={{
                    borderColor: isFocused ? 'rgba(17, 24, 39, 0.24)' : undefined,
                  }}
                >
                  <button
                    className="w-full rounded-[10px] px-2 py-2 text-left hover:bg-white"
                    onClick={() => {
                      setFocusDate(date);
                      setViewMode('day');
                    }}
                  >
                    <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-400">
                      {DAY_NAMES[date.getDay()]}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-neutral-900">
                      {MONTH_NAMES[date.getMonth()]} {date.getDate()}
                    </div>
                  </button>
                  <div className="mt-3 grid gap-2">
                    {events.length > 0 ? (
                      events.map((event) => renderWeekEvent(event))
                    ) : (
                      <div className="rounded-[12px] border border-dashed border-neutral-200 px-3 py-4 text-sm text-neutral-400">
                        No filtered activity.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );

  const renderDayView = (
    <div className="grid gap-3">
      {dayEvents.length > 0 ? (
        <div className="grid gap-3">{dayEvents.map((event) => renderDayEvent(event))}</div>
      ) : (
        <div className="ui-surface-subtle flex min-h-[220px] items-center justify-center px-4 text-center text-sm text-neutral-500">
          No filtered activity for this day.
        </div>
      )}
    </div>
  );

  const ribbonContent = (
    <div className="mb-2">
      <div className="ui-surface-subtle px-3 py-2 sm:px-4 sm:py-2.5">
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold tracking-[0.14em] text-neutral-900">
                  AUDIT LOG
                </span>
                <span className="text-[11px] text-neutral-500">{getViewDescription(viewMode)}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500">
                <span className="font-medium text-neutral-700">{formatPeriodLabel(focusDate, viewMode)}</span>
                <span>{filteredEvents.length} events visible</span>
                {filters.team !== 'all' && <span>Team filter: {filters.team}</span>}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full border border-neutral-200 bg-white p-0.5 shadow-[var(--shadow-soft)]">
                {(['month', 'week', 'day'] as AuditViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    className={`h-8 rounded-full px-3 text-xs font-medium ${
                      viewMode === mode
                        ? 'bg-neutral-900 text-white'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                    onClick={() => setViewMode(mode)}
                  >
                    {mode === 'month' ? 'Month' : mode === 'week' ? 'Week' : 'Day'}
                  </button>
                ))}
              </div>

              <div className="rounded-full border border-neutral-200 bg-white p-0.5 shadow-[var(--shadow-soft)]">
                <button
                  className="h-8 rounded-full px-3 text-xs font-medium text-neutral-600 hover:text-neutral-900"
                  onClick={goToPrevious}
                >
                  Prev
                </button>
                <button
                  className="h-8 rounded-full px-3 text-xs font-medium text-neutral-600 hover:text-neutral-900"
                  onClick={goToNext}
                >
                  Next
                </button>
                <button
                  className="h-8 rounded-full px-3 text-xs font-medium text-neutral-600 hover:text-neutral-900"
                  onClick={resetFocus}
                >
                  TODAY
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
            <div className="grid flex-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
              <select
                className="ui-input min-h-8 h-8 text-xs"
                value={filters.activity}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    activity: event.target.value as AuditFilters['activity'],
                  }))
                }
              >
                <option value="all">All activity</option>
                <option value="saved-chat-versions">Saved Chat Versions</option>
              </select>

              <select
                className="ui-input min-h-8 h-8 text-xs"
                value={filters.user}
                onChange={(event) => setFilters((current) => ({ ...current, user: event.target.value }))}
              >
                <option value="all">All users</option>
                {filterOptions.users.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>

              <select
                className="ui-input min-h-8 h-8 text-xs"
                value={filters.team}
                onChange={(event) => setFilters((current) => ({ ...current, team: event.target.value }))}
              >
                <option value="all">All teams</option>
                {filterOptions.teams.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>

              <select
                className="ui-input min-h-8 h-8 text-xs"
                value={filters.worker}
                onChange={(event) => setFilters((current) => ({ ...current, worker: event.target.value }))}
              >
                <option value="all">All workers</option>
                {filterOptions.workers.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>

              <select
                className="ui-input min-h-8 h-8 text-xs"
                value={filters.manager}
                onChange={(event) => setFilters((current) => ({ ...current, manager: event.target.value }))}
              >
                <option value="all">All managers</option>
                {filterOptions.managers.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="ui-button min-h-8 h-8 px-3 text-xs text-neutral-700"
              onClick={() =>
                setFilters({
                  activity: 'all',
                  user: 'all',
                  team: 'all',
                  worker: 'all',
                  manager: 'all',
                })
              }
            >
              Clear Filters
            </button>
          </div>

          <div className="border-t border-neutral-200/80 pt-2">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="scrollbar-thin flex gap-1.5 overflow-x-auto pb-0.5 lg:flex-1">
                <button
                  className={`ui-pill shrink-0 transition-colors ${
                    filters.team === 'all'
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400 hover:text-neutral-900'
                  }`}
                  onClick={() => setFilters((current) => ({ ...current, team: 'all' }))}
                >
                  All teams
                </button>
                {teamLegend.map(({ teamLabel, theme }) => {
                  const isActive = filters.team === teamLabel;
                  return (
                    <button
                      key={teamLabel}
                      className={`ui-pill shrink-0 transition-colors ${
                        isActive ? 'font-semibold shadow-[var(--shadow-soft)]' : 'hover:shadow-[var(--shadow-soft)]'
                      }`}
                      style={
                        isActive
                          ? {
                              borderColor: theme.accent,
                              backgroundColor: theme.accent,
                              color: '#ffffff',
                            }
                          : {
                              borderColor: theme.border,
                              color: theme.accent,
                              backgroundColor: theme.soft,
                            }
                      }
                      onClick={() => toggleTeamFilter(teamLabel)}
                      title={`Filter Audit Log by ${teamLabel}`}
                    >
                      {teamLabel}
                    </button>
                  );
                })}
              </div>
              <button
                className="shrink-0 self-start text-xs font-medium text-[var(--color-accent-strong)] underline underline-offset-2 hover:text-[var(--color-accent)]"
                onClick={() => setShowHowToUse(true)}
              >
                How to use Audit Log
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const calendarContent = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--color-surface-soft)]">
      <div
        className="scrollbar-thin flex-1 overflow-y-auto px-2 py-2 sm:px-3 sm:py-3"
        style={{ minHeight: 0 }}
      >
        <div className="ui-surface flex h-full min-h-[520px] flex-col p-3 sm:p-4">
          {ribbonContent}

          {viewMode === 'month' && renderMonthView}
          {viewMode === 'week' && renderWeekView}
          {viewMode === 'day' && renderDayView}
        </div>
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
            <AgentPanel
              agent="manager"
              managerDisplayName={subManagerLabel}
              selectionScope="page-c:manager"
              panelScope="page-c:manager"
              sourceWorkspace="audit-log"
            />
          </div>
        )}

        <div className="app-frame app-short-landscape-flex flex min-h-0 flex-1 overflow-hidden sm:hidden">
          {calendarContent}
        </div>

        <div className="app-frame app-short-landscape-hide hidden min-h-0 flex-1 overflow-hidden sm:flex">
          <CollapsibleManagerSidebar
            managerDisplayName={subManagerLabel}
            className="w-[280px] shrink-0 md:w-[320px] lg:w-[432px]"
            storageKey="aisync_sm_sidebar_page_c"
            selectionScope="page-c:manager"
            panelScope="page-c:manager"
          />
          {calendarContent}
        </div>
      </div>

      {openFile && openProject && (
        <FileViewer
          file={openFile}
          projectName={openProject.name}
          onClose={() => setOpenFileId(null)}
        />
      )}

      {selectedEvent && (
        <Modal
          title={selectedEvent.actionLabel}
          onClose={() => setSelectedEventId(null)}
          width="max-w-2xl"
        >
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <span className={getWorkPhaseClassName(selectedEvent.phaseState ?? 'Open')}>
                {selectedEvent.phaseState}
              </span>
              <span
                className="ui-pill"
                style={{
                  borderColor: getEventTheme(selectedEvent).border,
                  color: getEventTheme(selectedEvent).accent,
                  backgroundColor: getEventTheme(selectedEvent).soft,
                }}
              >
                {selectedEvent.teamLabel}
              </span>
              <span className="ui-pill border-neutral-200 text-neutral-700">
                {selectedEvent.actorLabel}
              </span>
              <span className="ui-pill border-neutral-200 text-neutral-500">
                {getAgentLabel(selectedEvent.accentRole)}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="ui-surface-subtle px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-400">When</div>
                <div className="mt-1 text-sm font-medium text-neutral-900">
                  {buildDateFromKey(selectedEvent.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}{' '}
                  at {selectedEvent.time}
                </div>
              </div>
              <div className="ui-surface-subtle px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-400">Output</div>
                <div className="mt-1 text-sm font-medium text-neutral-900">{selectedEvent.outputLabel}</div>
              </div>
              <div className="ui-surface-subtle px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-400">Requested By</div>
                <div className="mt-1 text-sm font-medium text-neutral-900">{selectedEvent.userLabel}</div>
              </div>
              <div className="ui-surface-subtle px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-400">Manager</div>
                <div className="mt-1 text-sm font-medium text-neutral-900">{selectedEvent.managerLabel}</div>
              </div>
              <div className="ui-surface-subtle px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-400">Worker</div>
                <div className="mt-1 text-sm font-medium text-neutral-900">
                  {selectedEvent.workerLabel ?? 'Manager-led step'}
                </div>
              </div>
              <div className="ui-surface-subtle px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-400">Project</div>
                <div className="mt-1 text-sm font-medium text-neutral-900">
                  {selectedEventProject?.name ?? selectedEvent.projectId}
                </div>
              </div>
            </div>

            <div className="ui-surface-subtle px-4 py-4">
              <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-400">Full Record</div>
              <div className="mt-2 text-sm leading-6 text-neutral-700">
                {buildEventSummary(selectedEvent)}
              </div>
              {selectedEvent.versionReference && (
                <div className="mt-3 rounded-[12px] border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-700">
                  This version event opens `Saved Chat Detail`, where `View History` and `Resume Work` remain available in the approved recovery path.
                </div>
              )}
              <div className="mt-3 text-sm text-neutral-600">
                Source panel: {selectedEvent.sourcePanelLabel}
              </div>
              <div className="mt-1 text-sm text-neutral-600">
                Linked object: {selectedEvent.relatedObject?.title ?? 'No linked saved object'}
              </div>
              <div className="mt-1 text-sm text-neutral-600">
                Linked file: {selectedEventFile?.title ?? selectedEvent.linkedFileId ?? 'No linked file'}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedEvent.linkedFileId && (
                <button
                  className="ui-button ui-button-primary text-white"
                  onClick={() => openLinkedFile(selectedEvent)}
                >
                  Open Linked File
                </button>
              )}
              {selectedEvent.versionReference && (
                <button
                  className="ui-button ui-button-primary text-white"
                  onClick={() => {
                    setSelectedEventId(null);
                    dispatch({
                      type: 'OPEN_WORKSPACE_VERSION_DETAIL',
                      target: selectedEvent.versionReference!,
                    });
                  }}
                >
                  Open Saved Chat Detail
                </button>
              )}
              {selectedEvent.versionReference && (
                <button
                  className="ui-button text-neutral-700"
                  onClick={() => {
                    setSelectedEventId(null);
                    dispatch({ type: 'OPEN_WORKSPACE_VERSION_HISTORY' });
                  }}
                >
                  Open View History
                </button>
              )}
              <button className="ui-button text-neutral-700" onClick={() => setSelectedEventId(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showHowToUse && (
        <Modal
          title="How to use Audit Log"
          onClose={() => setShowHowToUse(false)}
          width="max-w-4xl"
        >
          <div className="grid gap-6 text-sm leading-6 text-neutral-700">
            <section className="grid gap-2">
              <h2 className="text-xl font-semibold tracking-[-0.01em] text-neutral-900">
                How Audit Log works
              </h2>
              <div className="grid gap-2">
                <h3 className="text-base font-semibold text-neutral-900">What this screen is</h3>
                <p>Audit Log is the visible history of your work.</p>
                <p>Here you can find things you saved before and open them again later.</p>
                <p>Think of this screen as a mix of:</p>
                <ul className="list-disc pl-5">
                  <li>calendar</li>
                  <li>event record</li>
                  <li>and an entry point to recover previous work</li>
                </ul>
              </div>
            </section>

            <section className="grid gap-3">
              <h3 className="text-base font-semibold text-neutral-900">How it works</h3>

              <div className="grid gap-2">
                <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-500">
                  1. When you work in a chat
                </h4>
                <p>You work normally inside a chat panel in the Workspace.</p>
                <p>There you have buttons such as:</p>
                <ul className="list-disc pl-5">
                  <li>Save Version</li>
                  <li>Save / Backup</li>
                  <li>Review &amp; Forward</li>
                  <li>Audit AI Answer</li>
                </ul>
                <p>Each one has a different purpose.</p>
              </div>

              <div className="grid gap-2">
                <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-500">
                  2. If you press Save Version
                </h4>
                <p>Every time you press Save Version in a chat panel, AISync creates a checkpoint.</p>
                <p>A checkpoint is:</p>
                <ul className="list-disc pl-5">
                  <li>a saved version of that moment of work</li>
                  <li>with date and time</li>
                  <li>ready to be found later</li>
                </ul>
                <p>That checkpoint is registered in Audit Log on the day and time when you saved it.</p>
                <p className="font-semibold text-neutral-900">
                  Save Version -&gt; Audit Log -&gt; Saved Chat Detail -&gt; View History -&gt; Resume Work
                </p>
                <div>
                  <div className="font-semibold text-neutral-900">What this allows you to do</div>
                  <ul className="mt-1 list-disc pl-5">
                    <li>not lose an important milestone</li>
                    <li>go back to an earlier point</li>
                    <li>continue working later from that saved state</li>
                  </ul>
                </div>
              </div>

              <div className="grid gap-2">
                <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-500">
                  3. If you want to recover that work later
                </h4>
                <p>Go to Audit Log.</p>
                <p>There, look for the approximate day and time when you saved the version.</p>
                <p>When you find the event:</p>
                <ul className="list-disc pl-5">
                  <li>click it</li>
                  <li>open the saved detail</li>
                  <li>review more information</li>
                  <li>and, if applicable, resume work from there</li>
                </ul>
              </div>

              <div className="grid gap-2">
                <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-500">
                  4. If you do not remember exactly when you saved it
                </h4>
                <p>That is fine.</p>
                <p>Audit Log exists precisely for that:</p>
                <ul className="list-disc pl-5">
                  <li>to help you locate what you did</li>
                  <li>to show you the order of events</li>
                  <li>and to give you a visual clue in the calendar and in the event history</li>
                </ul>
                <p>
                  Also, the Audit Log Sub-Manager helps you read that history and understand what was
                  saved and from which point you can re-enter.
                </p>
              </div>
            </section>

            <section className="grid gap-3">
              <h3 className="text-base font-semibold text-neutral-900">
                What each Audit Log related function does
              </h3>

              <div className="grid gap-2">
                <h4 className="text-sm font-semibold text-neutral-900">Save Version</h4>
                <p>Saves a version of the current chat state.</p>
                <div>
                  <div className="font-semibold text-neutral-900">What it creates</div>
                  <ul className="mt-1 list-disc pl-5">
                    <li>a checkpoint</li>
                    <li>with date and time</li>
                    <li>visible later in Audit Log</li>
                  </ul>
                </div>
                <div>
                  <div className="font-semibold text-neutral-900">When to use it</div>
                  <p>Use it when you feel:</p>
                  <ul className="mt-1 list-disc pl-5">
                    <li>“this is a good point”</li>
                    <li>“I want to save this progress”</li>
                    <li>“I want to be able to come back to this later”</li>
                  </ul>
                </div>
              </div>

              <div className="grid gap-2">
                <h4 className="text-sm font-semibold text-neutral-900">Save / Backup</h4>
                <p>Saves chat content so it is not lost.</p>
                <p>Depending on how the demo is configured, it may be used to save:</p>
                <ul className="list-disc pl-5">
                  <li>a selection of messages</li>
                  <li>or a backup of chat content</li>
                </ul>
                <div>
                  <div className="font-semibold text-neutral-900">What it is for</div>
                  <p>
                    It is useful to preserve material that matters, even if it is not yet a formal
                    work version.
                  </p>
                </div>
                <div>
                  <div className="font-semibold text-neutral-900">Difference from Save Version</div>
                  <ul className="mt-1 list-disc pl-5">
                    <li>
                      <strong>Save Version</strong> saves a resumable work point
                    </li>
                    <li>
                      <strong>Save / Backup</strong> saves content for preservation
                    </li>
                  </ul>
                </div>
              </div>

              <div className="grid gap-2">
                <h4 className="text-sm font-semibold text-neutral-900">Review &amp; Forward</h4>
                <p>
                  Lets you review content before sending it to another agent or to another part of the
                  system.
                </p>
                <div>
                  <div className="font-semibold text-neutral-900">What it is for</div>
                  <p>It prevents work from being forwarded automatically without human control.</p>
                </div>
                <div>
                  <div className="font-semibold text-neutral-900">What it leaves behind</div>
                  <p>That movement may also become part of the system traceability.</p>
                </div>
              </div>

              <div className="grid gap-2">
                <h4 className="text-sm font-semibold text-neutral-900">Audit AI Answer</h4>
                <p>Sends a response into the contrast or review flow between agents.</p>
                <div>
                  <div className="font-semibold text-neutral-900">What it is for</div>
                  <p>
                    It helps check whether an answer is good enough or whether it should be contrasted
                    before being adopted.
                  </p>
                </div>
                <div>
                  <div className="font-semibold text-neutral-900">What it leaves behind</div>
                  <p>That event also becomes part of the work trail.</p>
                </div>
              </div>

              <div className="grid gap-2">
                <h4 className="text-sm font-semibold text-neutral-900">View History</h4>
                <p>Shows the version history or related checkpoints for that chat or saved point.</p>
                <div>
                  <div className="font-semibold text-neutral-900">What it is for</div>
                  <p>It helps you see:</p>
                  <ul className="mt-1 list-disc pl-5">
                    <li>what existed before</li>
                    <li>which versions are available</li>
                    <li>how the work evolved over time</li>
                  </ul>
                </div>
              </div>

              <div className="grid gap-2">
                <h4 className="text-sm font-semibold text-neutral-900">Resume Work</h4>
                <p>Takes you back to the Workspace so you can continue working from that saved point.</p>
                <div>
                  <div className="font-semibold text-neutral-900">What it is for</div>
                  <p>It lets you continue without starting from zero.</p>
                </div>
                <div>
                  <div className="font-semibold text-neutral-900">What it does in practice</div>
                  <p>
                    It takes you back to the correct workspace with the checkpoint context as the
                    continuity base.
                  </p>
                  <p>
                    Resume Work is meant to continue from a saved state, not to perform a destructive
                    restore of the whole AISync system.
                  </p>
                </div>
              </div>
            </section>

            <section className="grid gap-3">
              <h3 className="text-base font-semibold text-neutral-900">Basic step-by-step use</h3>

              <div className="grid gap-2">
                <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-500">
                  Case 1 — I want to save an important milestone
                </h4>
                <p>You work in the chat. You press Save Version. AISync creates a checkpoint.</p>
                <p>That checkpoint is registered in Audit Log with date and time.</p>
                <p>Later, you can search for it again.</p>
              </div>

              <div className="grid gap-2">
                <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-500">
                  Case 2 — I want to recover something I did before
                </h4>
                <p>You enter Audit Log.</p>
                <p>You look for the approximate day and time.</p>
                <p>You open the event.</p>
                <p>You read the detail.</p>
                <p>If you want to continue from there, you use Resume Work.</p>
              </div>

              <div className="grid gap-2">
                <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-500">
                  Case 3 — I do not remember exactly when I saved it
                </h4>
                <p>You enter Audit Log.</p>
                <p>You browse the calendar or the event list.</p>
                <p>You open nearby records.</p>
                <p>You identify the correct one by its content.</p>
                <p>You open it or resume from it.</p>
              </div>
            </section>

            <section className="grid gap-3">
              <h3 className="text-base font-semibold text-neutral-900">What you should remember</h3>
              <div className="grid gap-2">
                <div className="font-semibold text-neutral-900">Simple idea</div>
                <p>If you save a version, you will later be able to find it in Audit Log.</p>
              </div>
              <div className="grid gap-2">
                <div className="font-semibold text-neutral-900">More important idea</div>
                <p>
                  Audit Log is not there to show you “technical data”. It is there to help you find
                  previous work and use it again.
                </p>
              </div>
              <div className="grid gap-2">
                <div className="font-semibold text-neutral-900">Practical translation</div>
                <ul className="list-disc pl-5">
                  <li>you save in the Workspace</li>
                  <li>you find it in Audit Log</li>
                  <li>you review the detail</li>
                  <li>you resume from there</li>
                </ul>
              </div>
            </section>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}
