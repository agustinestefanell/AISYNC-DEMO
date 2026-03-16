import { useEffect, useMemo, useState } from 'react';
import { AppProvider, useApp } from './context';
import { TopBar } from './components/TopBar';
import { BottomNav } from './components/BottomNav';
import { PageA } from './pages/PageA';
import { PageB } from './pages/PageB';
import { PageC } from './pages/PageC';
import { PageD } from './pages/PageD';
import { PageE } from './pages/PageE';
import { PageF } from './pages/PageF';
import type { Page } from './types';

const PAGE_SET = new Set<Page>(['A', 'B', 'C', 'D', 'E', 'F']);

function isVisibleElement(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const styles = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  return (
    styles.display !== 'none' &&
    styles.visibility !== 'hidden' &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function ResponsiveDiagnostics({
  enabled,
  currentPage,
}: {
  enabled: boolean;
  currentPage: Page;
}) {
  const [snapshot, setSnapshot] = useState('');

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      setSnapshot('');
      return;
    }

    const collect = () => {
      const visibleText = (selector: string) =>
        Array.from(document.querySelectorAll(selector))
          .filter((element) => isVisibleElement(element))
          .map((element) => (element.textContent || '').replace(/\s+/g, ' ').trim())
          .filter(Boolean);

      const visibleAttr = (selector: string, attribute: string) =>
        Array.from(document.querySelectorAll(selector))
          .filter((element) => isVisibleElement(element))
          .map((element) => element.getAttribute(attribute) || '')
          .filter(Boolean);

      const visibleFlag = (selector: string) =>
        Array.from(document.querySelectorAll(selector)).some((element) => isVisibleElement(element));

      const mainShell = document.querySelector('.app-main-shell');
      const pageShell = document.querySelector('.app-main-shell > .app-page-shell');

      setSnapshot(
        JSON.stringify({
          currentPage,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          docScrollWidth: document.documentElement.scrollWidth,
          bodyScrollWidth: document.body.scrollWidth,
          hasHorizontalOverflow:
            document.documentElement.scrollWidth > window.innerWidth ||
            document.body.scrollWidth > window.innerWidth,
          mainShellClientHeight: mainShell?.clientHeight ?? null,
          mainShellScrollHeight: mainShell?.scrollHeight ?? null,
          mainShellOverflowY:
            mainShell instanceof HTMLElement ? window.getComputedStyle(mainShell).overflowY : null,
          pageShellClientWidth: pageShell?.clientWidth ?? null,
          pageShellScrollWidth: pageShell?.scrollWidth ?? null,
          visibleAgentPanels: visibleAttr('[data-agent-panel]', 'data-agent-panel'),
          visibleTeamPanels: visibleAttr('[data-team-panel]', 'data-team-panel'),
          workspaceTabs: visibleAttr('[data-workspace-tab]', 'data-workspace-tab'),
          bottomNavButtons: visibleText('nav button'),
          mobileBottomNavVisible: visibleFlag('.ui-bottomnav-mobile'),
          desktopBottomNavVisible: visibleFlag('.ui-bottomnav-desktop'),
          mobileMenuButtonVisible: visibleFlag('[data-mobile-menu-button]'),
          mobileMenuOpen: visibleFlag('[data-mobile-menu-sheet]'),
          mobileMenuItems: visibleAttr('[data-mobile-menu-item]', 'data-mobile-menu-item'),
          docsManagerToggleVisible: visibleText('[data-docs-manager-toggle]').length > 0,
          docsProjectCardsVisible: visibleText('[data-docs-project-card]').length,
          calendarListVisible: visibleText('[data-calendar-list]').length > 0,
          calendarGridVisible: visibleText('[data-calendar-grid]').length > 0,
          teamsOutputsToggleVisible: visibleText('[data-teams-outputs-toggle]').length > 0,
          teamsCardsVisible: visibleText('[data-teams-card]').length,
          promptsFilterButtonVisible:
            visibleText('[data-prompts-filter-button]').length > 0,
          promptsSidebarVisible: visibleText('[data-prompts-sidebar]').length > 0,
        }),
      );
    };

    const schedule = () => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(collect);
      });
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    schedule();
    const timeoutId = window.setTimeout(collect, 400);
    window.addEventListener('resize', schedule);

    return () => {
      observer.disconnect();
      window.clearTimeout(timeoutId);
      window.removeEventListener('resize', schedule);
    };
  }, [currentPage, enabled]);

  if (!enabled) {
    return null;
  }

  return (
    <pre
      id="responsive-diagnostics"
      className="pointer-events-none absolute -left-[9999px] top-0 opacity-0"
      aria-hidden="true"
    >
      {snapshot}
    </pre>
  );
}

function AppInner() {
  const { state, dispatch } = useApp();
  const diagnosticsParams = useMemo(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    return new URLSearchParams(window.location.search);
  }, []);
  const diagnosticsEnabled = diagnosticsParams?.has('responsive_diag') ?? false;
  const pageOverride = diagnosticsParams?.get('page');

  useEffect(() => {
    if (!pageOverride || !PAGE_SET.has(pageOverride as Page) || state.currentPage === pageOverride) {
      return;
    }

    dispatch({ type: 'SET_PAGE', page: pageOverride as Page });
  }, [dispatch, pageOverride, state.currentPage]);

  return (
    <div className="app-root-shell app-page-shell flex min-h-0 min-w-0 flex-col overflow-hidden">
      <TopBar />
      <main className="app-main-shell min-h-0 min-w-0 flex-1 overflow-hidden">
        {state.currentPage === 'A' && <PageA />}
        {state.currentPage === 'B' && <PageB />}
        {state.currentPage === 'C' && <PageC />}
        {state.currentPage === 'D' && <PageD />}
        {state.currentPage === 'E' && <PageE />}
        {state.currentPage === 'F' && <PageF />}
      </main>
      <BottomNav />
      <ResponsiveDiagnostics enabled={diagnosticsEnabled} currentPage={state.currentPage} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
