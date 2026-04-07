import { useEffect, useMemo, useRef, useState } from 'react';
import { getAuditEventIdFromLocation, openAuditDetailWindow } from '../auditLogLaunch';
import { FileViewer } from '../components/FileViewer';
import { Modal } from '../components/Modal';
import { SubManagerModuleShell } from '../components/SubManagerModuleShell';
import { Toast } from '../components/Toast';
import { useApp } from '../context';
import { getTeamTheme } from '../data/teams';
import { getSecondarySubManagerLabel } from '../pageLabels';
import { getWorkPhaseClassName, getWorkPhaseState } from '../phaseState';
import type { CalendarEvent } from '../types';

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

const DEMO_AUDIT_DATE = new Date(2026, 2, 16);

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

function getAgentLabel(agent: CalendarEvent['agent']) {
  if (agent === 'manager') return 'Manager';
  if (agent === 'worker1') return 'Worker 1';
  return 'Worker 2';
}

function getAgentAccent(agent: CalendarEvent['agent']) {
  if (agent === 'manager') return 'var(--color-role-manager-accent)';
  if (agent === 'worker1') return 'var(--color-role-worker1-accent)';
  return 'var(--color-role-worker2-accent)';
}

function getEventTheme(event: CalendarEvent) {
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

function buildEventSummary(event: CalendarEvent) {
  const actor = event.actorLabel ?? event.sourceLabel ?? getAgentLabel(event.agent);
  const action = event.actionLabel ?? 'Audit event logged';
  const team = event.teamLabel ?? 'Main Workspace';
  const output = event.outputLabel ?? event.title;
  return `${actor} logged "${action}" for ${team}. Output linked: ${output}.`;
}

export function PageC() {
  const { state, dispatch } = useApp();
  const subManagerLabel = getSecondarySubManagerLabel('C');
  const launchAppliedRef = useRef(false);
  const [viewMode, setViewMode] = useState<AuditViewMode>('month');
  const [focusDate, setFocusDate] = useState(() => new Date(DEMO_AUDIT_DATE));
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
      [...state.calendarEvents]
        .map((event) => ({
          ...event,
          teamLabel: event.teamLabel ?? 'Main Workspace',
          userLabel: event.userLabel ?? state.userName,
          actorLabel: event.actorLabel ?? event.sourceLabel ?? getAgentLabel(event.agent),
          managerLabel: event.managerLabel ?? 'AI General Manager',
          actionLabel: event.actionLabel ?? 'Audit event logged',
          outputLabel: event.outputLabel ?? event.title.split('|').pop()?.trim() ?? event.title,
          phaseState: getWorkPhaseState(event.phaseState),
        }))
        .sort((left, right) => `${left.date} ${left.time}`.localeCompare(`${right.date} ${right.time}`)),
    [state.calendarEvents, state.userName],
  );

  const filterOptions = useMemo(
    () => ({
      users: [...new Set(normalizedEvents.map((event) => event.userLabel).filter(Boolean))],
      teams: [...new Set(normalizedEvents.map((event) => event.teamLabel).filter(Boolean))],
      workers: [...new Set(normalizedEvents.map((event) => event.workerLabel).filter(Boolean))],
      managers: [...new Set(normalizedEvents.map((event) => event.managerLabel).filter(Boolean))],
    }),
    [normalizedEvents],
  );

  const filteredEvents = useMemo(
    () =>
      normalizedEvents.filter((event) => {
        if (filters.activity === 'saved-chat-versions' && !event.versionId) return false;
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
  const selectedEventFile =
    state.savedFiles.find((file) => file.id === selectedEvent?.fileId) ?? null;
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
        return { teamLabel, theme: getEventTheme(event ?? ({ teamId: 'global' } as CalendarEvent)) };
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

  const resetFocus = () => setFocusDate(new Date(DEMO_AUDIT_DATE));

  const openEvent = (event: CalendarEvent) => {
    if (openAuditDetailWindow(event)) {
      setToast('Audit detail opened in a new window.');
      return;
    }

    setToast('Popup blocked. Audit detail opened in this window.');

    if (event.versionId && event.versionSource && event.versionThreadId) {
      dispatch({
        type: 'OPEN_WORKSPACE_VERSION_DETAIL',
        target: {
          source: event.versionSource,
          versionId: event.versionId,
          threadId: event.versionThreadId,
          agent: event.versionSource === 'main' ? event.agent : undefined,
          teamId: event.versionSource === 'team' ? event.teamId : undefined,
        },
      });
      return;
    }

    setSelectedEventId(event.id);
  };

  const openLinkedFile = (event: CalendarEvent) => {
    const file = state.savedFiles.find((candidate) => candidate.id === event.fileId);

    if (!file) {
      setToast('Linked file not found.');
      return;
    }

    setSelectedEventId(null);
    setOpenFileId(file.id);
  };

  const renderMonthEvent = (event: CalendarEvent) => {
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
        onClick={() => openEvent(event)}
        title={`${event.time} ${event.actionLabel}`}
      >
        <span
          className="mr-1 inline-flex h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: getAgentAccent(event.agent) }}
        />
        <span className="mr-1 font-semibold">{event.time}</span>
        <span>{event.actionLabel}</span>
      </button>
    );
  };

  const renderWeekEvent = (event: CalendarEvent) => {
    const theme = getEventTheme(event);

    return (
      <button
        key={event.id}
        className="rounded-[12px] border bg-white px-3 py-3 text-left shadow-[var(--shadow-soft)]"
        style={{ borderColor: theme.border, boxShadow: `inset 0 2px 0 ${theme.ribbon}` }}
        onClick={() => openEvent(event)}
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
            {getAgentLabel(event.agent)}
          </span>
        </div>
      </button>
    );
  };

  const renderDayEvent = (event: CalendarEvent) => {
    const theme = getEventTheme(event);

    return (
      <button
        key={event.id}
        className="rounded-[16px] border bg-white px-4 py-4 text-left shadow-[var(--shadow-soft)]"
        style={{ borderColor: theme.border, boxShadow: `inset 0 2px 0 ${theme.ribbon}` }}
        onClick={() => openEvent(event)}
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
                style={{ backgroundColor: getAgentAccent(event.agent) }}
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
              <div key={date} className="ui-surface-subtle px-3 py-3">
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
                          onClick={() => setFocusDate(cellDate)}
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
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-neutral-900">
                  {DAY_NAMES[date.getDay()]}, {MONTH_NAMES[date.getMonth()]} {date.getDate()}
                </div>
                <div className="text-[11px] text-neutral-500">{events.length} events</div>
              </div>
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
                    onClick={() => setFocusDate(date)}
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
      <div className="ui-surface-subtle px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-400">Daily Focus</div>
            <div className="mt-1 text-lg font-semibold text-neutral-900">
              {focusDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
          </div>
          <div className="text-sm text-neutral-500">{dayEvents.length} events</div>
        </div>
      </div>

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
      <div className="ui-surface-subtle px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="grid gap-2.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold tracking-[0.14em] text-neutral-900">
                  AUDIT LOG
                </span>
                <span className="rounded-full border border-neutral-200/90 bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
                  Filter Panel
                </span>
              </div>
              <div className="mt-0.5 text-[11px] text-neutral-500">
                {filteredEvents.length} events visible
              </div>
            </div>

            <div className="text-left sm:text-right">
              <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-400">
                Period
              </div>
              <div className="mt-0.5 text-sm font-semibold text-neutral-900">
                {formatPeriodLabel(focusDate, viewMode)}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
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
                  Reset
                </button>
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-2 xl:min-w-[720px] xl:flex-1 xl:grid-cols-5">
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

          <div className="hidden xl:flex items-center justify-between gap-3 text-[11px] text-neutral-500">
            <div>{getViewDescription(viewMode)}</div>
            <div className="flex max-w-[52%] gap-1.5 overflow-x-auto">
              {teamLegend.map(({ teamLabel, theme }) => (
                <span
                  key={teamLabel}
                  className="ui-pill"
                  style={{ borderColor: theme.border, color: theme.accent, backgroundColor: theme.soft }}
                >
                  {teamLabel}
                </span>
              ))}
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
      <SubManagerModuleShell managerDisplayName={subManagerLabel}>
        {calendarContent}
      </SubManagerModuleShell>

      {openFile && openProject && (
        <FileViewer
          file={openFile}
          projectName={openProject.name}
          onClose={() => setOpenFileId(null)}
        />
      )}

      {selectedEvent && (
        <Modal
          title={selectedEvent.actionLabel ?? selectedEvent.title}
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
                {getAgentLabel(selectedEvent.agent)}
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
              <div className="mt-3 text-sm text-neutral-600">
                Source label: {selectedEvent.sourceLabel ?? selectedEvent.actorLabel}
              </div>
              <div className="mt-1 text-sm text-neutral-600">
                Linked file: {selectedEventFile?.title ?? selectedEvent.fileId}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className="ui-button ui-button-primary text-white"
                onClick={() => openLinkedFile(selectedEvent)}
              >
                Open Linked File
              </button>
              <button className="ui-button text-neutral-700" onClick={() => setSelectedEventId(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}
