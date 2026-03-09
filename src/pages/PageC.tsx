import { useMemo, useState } from 'react';
import { AgentPanel } from '../components/AgentPanel';
import { DividerRail } from '../components/DividerRail';
import { FileViewer } from '../components/FileViewer';
import { Toast } from '../components/Toast';
import { useApp } from '../context';
import { SECONDARY_MANAGER_PANEL_WIDTH } from '../layout';

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

  return (
    <div className="app-page-shell h-full min-h-0 min-w-0 overflow-hidden px-3 py-3">
      <div className="app-frame mx-auto flex h-full min-h-0 w-full max-w-[1600px] overflow-hidden">
        <AgentPanel
          agent="manager"
          style={{ width: SECONDARY_MANAGER_PANEL_WIDTH, flexShrink: 0 }}
        />

        <DividerRail />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--color-surface-soft)]">
          <div className="px-3 pb-2 pt-3">
            <div className="ui-surface py-2 text-center">
              <span className="text-sm font-semibold tracking-[0.14em] text-neutral-900">
                DOCUMENTATION CALENDAR
              </span>
            </div>
          </div>

          <div className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-3" style={{ minHeight: 0 }}>
            <div className="ui-surface flex h-full min-h-[520px] flex-col p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    className="ui-button text-neutral-700"
                    onClick={goToPreviousMonth}
                  >
                    Prev
                  </button>
                  <button
                    className="ui-button text-neutral-700"
                    onClick={goToNextMonth}
                  >
                    Next
                  </button>
                </div>

                <div className="text-sm font-semibold text-neutral-900">
                  {MONTH_NAMES[month]} {year}
                </div>

                <div className="flex items-center gap-3 text-[11px] text-neutral-500">
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
              </div>

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

              <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-500">
                <div>Dense seed activity is scheduled between 09:00 and 17:00.</div>
                <div>Click any event to open the linked file.</div>
              </div>
            </div>
          </div>
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
