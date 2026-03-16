import { useMemo, useState } from 'react';
import { AgentPanel } from '../components/AgentPanel';
import { DividerRail } from '../components/DividerRail';
import { FileViewer } from '../components/FileViewer';
import { Toast } from '../components/Toast';
import { useApp } from '../context';

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

function parseDateParts(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

export function PageC() {
  const { state } = useApp();
  const [showManagerMobile, setShowManagerMobile] = useState(false);
  const [showLegendTablet, setShowLegendTablet] = useState(false);
  const [showNotesTablet, setShowNotesTablet] = useState(false);
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(2);
  const [openFileId, setOpenFileId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const openFile = state.savedFiles.find((file) => file.id === openFileId) ?? null;
  const openProject =
    state.projects.find((project) => project.id === openFile?.projectId) ?? null;

  const eventsByDay = useMemo(() => {
    const map = new Map<number, typeof state.calendarEvents>();

    state.calendarEvents.forEach((event) => {
      const parts = parseDateParts(event.date);
      if (parts.year === year && parts.month === month + 1) {
        const current = map.get(parts.day) ?? [];
        map.set(
          parts.day,
          [...current, event].sort((left, right) => left.time.localeCompare(right.time)),
        );
      }
    });

    return map;
  }, [month, state.calendarEvents, year]);

  const mobileEventGroups = useMemo(
    () => Array.from(eventsByDay.entries()).sort(([left], [right]) => left - right),
    [eventsByDay],
  );

  const cells: Array<number | null> = [];
  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const goToPreviousMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((value) => value - 1);
      return;
    }
    setMonth((value) => value - 1);
  };

  const goToNextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((value) => value + 1);
      return;
    }
    setMonth((value) => value + 1);
  };

  const chipTone: Record<string, string> = {
    manager: 'border-neutral-400 bg-neutral-900 text-white',
    worker1: 'border-neutral-300 bg-neutral-200 text-neutral-900',
    worker2: 'border-neutral-300 bg-neutral-100 text-neutral-800',
  };

  const legendContent = (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-500">
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 rounded bg-neutral-900" />
        Manager
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 rounded border border-neutral-300 bg-neutral-200" />
        Worker 1
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 rounded border border-neutral-300 bg-neutral-100" />
        Worker 2
      </span>
    </div>
  );

  const calendarContent = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--color-surface-soft)]">
      <div className="px-2 pb-2 pt-2 sm:px-3 sm:pt-3">
        <div className="ui-surface py-3 text-center sm:py-2">
          <span className="text-sm font-semibold tracking-[0.14em] text-neutral-900">
            DOCUMENTATION CALENDAR
          </span>
        </div>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-2 sm:px-3 sm:pb-3" style={{ minHeight: 0 }}>
        <div className="ui-surface flex h-full min-h-[520px] flex-col p-3 sm:p-4">
          <div className="mb-3 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button className="ui-button text-neutral-700" onClick={goToPreviousMonth}>
                  Prev
                </button>
                <button className="ui-button text-neutral-700" onClick={goToNextMonth}>
                  Next
                </button>
              </div>

              <div className="text-sm font-semibold text-neutral-900">
                {MONTH_NAMES[month]} {year}
              </div>

              <div className="hidden lg:flex">{legendContent}</div>
            </div>

            <div className="app-short-landscape-hide hidden flex-wrap gap-2 sm:flex lg:hidden">
              <button
                className={`ui-button px-3 text-xs ${
                  showLegendTablet ? 'ui-button-primary text-white' : 'text-neutral-700'
                }`}
                onClick={() => setShowLegendTablet((value) => !value)}
              >
                Legend
              </button>
              <button
                className={`ui-button px-3 text-xs ${
                  showNotesTablet ? 'ui-button-primary text-white' : 'text-neutral-700'
                }`}
                onClick={() => setShowNotesTablet((value) => !value)}
              >
                Notes
              </button>
            </div>

            {showLegendTablet && (
              <div className="app-short-landscape-hide ui-surface-subtle hidden px-3 py-2 sm:block lg:hidden">
                {legendContent}
              </div>
            )}

            {showNotesTablet && (
              <div className="app-short-landscape-hide ui-surface-subtle hidden px-3 py-2 text-[11px] text-neutral-600 sm:block lg:hidden">
                Dense seed activity is scheduled between 09:00 and 17:00. Click any event to open the linked file.
              </div>
            )}
          </div>

          <div className="app-short-landscape-grid grid gap-3 sm:hidden" data-calendar-list>
            {mobileEventGroups.length > 0 ? (
              mobileEventGroups.map(([day, events]) => (
                <div key={day} className="ui-surface-subtle px-3 py-3">
                  <div className="mb-2 text-sm font-semibold text-neutral-900">
                    {MONTH_NAMES[month]} {day}, {year}
                  </div>
                  <div className="grid gap-2">
                    {events.map((event) => (
                      <button
                        key={event.id}
                        className="rounded-[10px] border border-neutral-200 bg-white px-3 py-2 text-left shadow-[var(--shadow-soft)]"
                        onClick={() => {
                          const file = state.savedFiles.find(
                            (candidate) => candidate.id === event.fileId,
                          );
                          if (file) {
                            setOpenFileId(file.id);
                          } else {
                            setToast('Linked file not found.');
                          }
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-neutral-900">{event.time}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] ${chipTone[event.agent]}`}>
                            {event.agent === 'manager'
                              ? 'Manager'
                              : event.agent === 'worker1'
                                ? 'Worker 1'
                                : 'Worker 2'}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-neutral-700">{event.title}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="ui-surface-subtle flex min-h-[220px] items-center justify-center px-4 text-center text-sm text-neutral-500">
                No events scheduled for this month.
              </div>
            )}
          </div>

          <div className="app-short-landscape-hide hidden sm:block" data-calendar-grid>
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
              {cells.map((day, index) => (
                <div
                  key={`${day ?? 'empty'}_${index}`}
                  className={`min-h-[88px] rounded-[10px] border p-1.5 ${
                    day ? 'border-neutral-200/90 bg-[var(--color-surface-soft)]' : 'border-transparent bg-transparent'
                  }`}
                >
                  {day && (
                    <>
                      <div className="mb-1 text-xs font-semibold text-neutral-700">{day}</div>
                      <div className="grid gap-0.5">
                        {(eventsByDay.get(day) ?? []).slice(0, 5).map((event) => (
                          <button
                            key={event.id}
                            className={`truncate rounded border px-1.5 py-1 text-left text-[9px] ${chipTone[event.agent]}`}
                            onClick={() => {
                              const file = state.savedFiles.find(
                                (candidate) => candidate.id === event.fileId,
                              );
                              if (file) {
                                setOpenFileId(file.id);
                              } else {
                                setToast('Linked file not found.');
                              }
                            }}
                            title={`${event.time} ${event.title}`}
                          >
                            <span className="mr-1 font-semibold">{event.time}</span>
                            <span>{event.title}</span>
                          </button>
                        ))}
                        {(eventsByDay.get(day) ?? []).length > 5 && (
                          <div className="px-1.5 text-[9px] text-neutral-400">
                            +{(eventsByDay.get(day) ?? []).length - 5} more
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-3 hidden items-center justify-between text-[11px] text-neutral-500 lg:flex">
              <div>Dense seed activity is scheduled between 09:00 and 17:00.</div>
              <div>Click any event to open the linked file.</div>
            </div>
          </div>
        </div>
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
          {calendarContent}
        </div>

        <div className="app-frame app-short-landscape-hide hidden min-h-0 flex-1 overflow-hidden sm:flex">
          <AgentPanel agent="manager" className="w-[280px] shrink-0 md:w-[320px] lg:w-[432px]" />
          <DividerRail />
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

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}
