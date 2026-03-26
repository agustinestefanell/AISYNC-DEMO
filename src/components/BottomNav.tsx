import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context';
import { CROSS_VERIFICATION_TEAM_ID, getTeamTheme } from '../data/teams';
import { getBottomNavPageLabel } from '../pageLabels';
import type { Page, SecondaryWorkspaceTarget } from '../types';

type NavItem = {
  key: string;
  label: string;
  shortLabel: string;
  page: Page;
  workspace?: SecondaryWorkspaceTarget;
};

const PAGE_ITEMS: NavItem[] = [
  { key: 'D', label: 'Teams Map', shortLabel: 'Teams', page: 'D' },
  { key: 'C', label: 'Audit Log', shortLabel: 'Log', page: 'C' },
  { key: 'A', label: 'Main Workspace', shortLabel: 'Main', page: 'A' },
  {
    key: 'cross_verification',
    label: 'Cross Verification',
    shortLabel: 'Cross',
    page: 'G',
    workspace: {
      teamId: CROSS_VERIFICATION_TEAM_ID,
      label: 'Cross Verification',
      color: getTeamTheme(CROSS_VERIFICATION_TEAM_ID).ribbon,
      nodeId: `${CROSS_VERIFICATION_TEAM_ID}_sm`,
      nodeType: 'senior_manager',
      rootNodeId: `${CROSS_VERIFICATION_TEAM_ID}_sm`,
      focusNodeId: `${CROSS_VERIFICATION_TEAM_ID}_sm`,
    },
  },
  { key: 'B', label: 'Documentation Mode', shortLabel: 'Docs', page: 'B' },
  { key: 'E', label: 'Prompts Library', shortLabel: 'Prompts', page: 'E' },
];

const SETTINGS_ITEMS = ['Project Settings', 'Agent Labels', 'Theme Preset'];
const ADVANCED_ITEMS: Array<{ label: string; page?: Page }> = [
  { label: 'Version History', page: 'H' },
  { label: 'Session Inspector' },
  { label: 'Forward Review' },
  { label: 'Backup Notes' },
];

function getShouldUseCompactNav() {
  if (typeof window === 'undefined') {
    return true;
  }

  return (
    window.matchMedia('(max-width: 639px)').matches ||
    window.matchMedia('(orientation: landscape) and (max-width: 915px) and (max-height: 480px)')
      .matches
  );
}

function NavButton({
  label,
  active,
  href,
  onNavigate,
}: {
  label: string;
  active?: boolean;
  href: string;
  onNavigate: () => void;
}) {
  return (
    <a
      href={href}
      className={`ui-nav-button transition-colors ${
        active ? 'text-white' : 'text-white/78 hover:text-white'
      }`}
      onClick={(event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }

        event.preventDefault();
        onNavigate();
      }}
    >
      {label}
    </a>
  );
}

export function BottomNav() {
  const { state, dispatch } = useApp();
  const [showSettings, setShowSettings] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [useCompactNav, setUseCompactNav] = useState(getShouldUseCompactNav);
  const currentPageLabel = useMemo(
    () => getBottomNavPageLabel(state.currentPage, state.secondaryWorkspace?.label),
    [state.currentPage, state.secondaryWorkspace],
  );
  const secondaryWorkspaceNavItem = useMemo<NavItem | null>(() => {
    if (!state.secondaryWorkspace || state.secondaryWorkspace.teamId === CROSS_VERIFICATION_TEAM_ID) {
      return null;
    }

    return {
      key: 'secondary_workspace',
      label: 'Secondary Workspace',
      shortLabel: 'Workspace',
      page: 'F' as const,
    };
  }, [state.secondaryWorkspace]);
  const mobilePages = useMemo(() => {
    if (!secondaryWorkspaceNavItem) {
      return PAGE_ITEMS;
    }

    return [
      ...PAGE_ITEMS,
      secondaryWorkspaceNavItem,
    ];
  }, [secondaryWorkspaceNavItem]);

  const closeMenus = () => {
    setShowSettings(false);
    setShowAdvanced(false);
    setShowMobileMenu(false);
  };

  const ribbonColor =
    state.currentPage === 'G'
      ? getTeamTheme(CROSS_VERIFICATION_TEAM_ID).ribbon
      : state.currentPage === 'F' && state.secondaryWorkspace
        ? state.secondaryWorkspace.color
        : '#111111';

  const navigateToPage = (page: Page) => {
    if (page === 'H') {
      dispatch({ type: 'OPEN_WORKSPACE_VERSION_HISTORY' });
    } else {
      dispatch({ type: 'SET_PAGE', page });
    }
    closeMenus();
  };

  const navigateToCrossVerification = () => {
    dispatch({ type: 'OPEN_CROSS_VERIFICATION_ROUTE' });
    closeMenus();
  };

  const isCrossVerificationActive =
    state.currentPage === 'G' ||
    (state.currentPage === 'F' && state.secondaryWorkspace?.teamId === CROSS_VERIFICATION_TEAM_ID);

  const buildPageHref = (page: Page) => {
    if (typeof window === 'undefined') {
      return `/?page=${page}`;
    }

    const url = new URL(window.location.href);
    url.searchParams.set('page', page);
    url.searchParams.delete('doc_view');
    url.searchParams.delete('doc_item');
    url.searchParams.delete('doc_open');
    url.searchParams.delete('doc_focus');
    url.searchParams.delete('cv_launch');
    url.searchParams.delete('audit_event');
    url.searchParams.delete('team_workspace_launch');
    return url.toString();
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const diagnosticsParams = new URLSearchParams(window.location.search);
    if (diagnosticsParams.has('responsive_diag') && diagnosticsParams.has('open_mobile_menu')) {
      setShowMobileMenu(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const compactWidth = window.matchMedia('(max-width: 639px)');
    const compactLandscape = window.matchMedia(
      '(orientation: landscape) and (max-width: 915px) and (max-height: 480px)',
    );

    const syncNavMode = () => {
      const nextUseCompactNav = compactWidth.matches || compactLandscape.matches;
      setUseCompactNav(nextUseCompactNav);

      if (!nextUseCompactNav) {
        setShowMobileMenu(false);
      }
    };

    syncNavMode();

    compactWidth.addEventListener('change', syncNavMode);
    compactLandscape.addEventListener('change', syncNavMode);

    return () => {
      compactWidth.removeEventListener('change', syncNavMode);
      compactLandscape.removeEventListener('change', syncNavMode);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <nav
        className="ui-bottomnav relative shrink-0 px-2 text-white sm:px-4"
        style={{ backgroundColor: ribbonColor }}
      >
        <div
          className={`ui-bottomnav-desktop mx-auto max-w-[1600px] min-w-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 py-1 lg:h-12 lg:flex-nowrap lg:gap-5 lg:py-0 ${
            useCompactNav ? 'hidden' : 'flex'
          }`}
        >
          <NavButton
            label="Teams Map"
            active={state.currentPage === 'D'}
            href={buildPageHref('D')}
            onNavigate={() => navigateToPage('D')}
          />

          <span className="hidden text-white/20 lg:block">|</span>

          <NavButton
            label="Audit Log"
            active={state.currentPage === 'C'}
            href={buildPageHref('C')}
            onNavigate={() => navigateToPage('C')}
          />

          <span className="hidden text-white/20 lg:block">|</span>

          <NavButton
            label="Main Workspace"
            active={state.currentPage === 'A'}
            href={buildPageHref('A')}
            onNavigate={() => navigateToPage('A')}
          />

          <span className="hidden text-white/20 lg:block">|</span>

          <NavButton
            label="Cross Verification"
            active={isCrossVerificationActive}
            href={buildPageHref('G')}
            onNavigate={navigateToCrossVerification}
          />

          <span className="hidden text-white/20 lg:block">|</span>

          <NavButton
            label="Documentation Mode"
            active={state.currentPage === 'B'}
            href={buildPageHref('B')}
            onNavigate={() => navigateToPage('B')}
          />

          <span className="hidden text-white/20 lg:block">|</span>

          <NavButton
            label="Prompts Library"
            active={state.currentPage === 'E'}
            href={buildPageHref('E')}
            onNavigate={() => navigateToPage('E')}
          />

          {secondaryWorkspaceNavItem && (
            <>
              <span className="hidden text-white/20 lg:block">|</span>
              <NavButton
                label="Secondary Workspace"
                active={state.currentPage === 'F' && !isCrossVerificationActive}
                href={buildPageHref('F')}
                onNavigate={() => navigateToPage('F')}
              />
            </>
          )}

          <span className="hidden text-white/20 lg:block">|</span>

          <div className="relative">
            <button
              className="ui-nav-button text-white/78 transition-colors hover:text-white"
              onClick={() => {
                setShowSettings((value) => !value);
                setShowAdvanced(false);
                setShowMobileMenu(false);
              }}
            >
              Settings
            </button>
            {showSettings && (
              <div className="ui-popover absolute bottom-12 left-1/2 min-w-44 -translate-x-1/2 py-1">
                {SETTINGS_ITEMS.map((item) => (
                  <button
                    key={item}
                    className="block w-full px-4 py-2 text-left text-xs text-white/86 transition-colors hover:bg-white/8"
                    onClick={closeMenus}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="hidden text-white/20 lg:block">|</span>

          <div className="relative">
            <button
              className="ui-nav-button text-white/78 transition-colors hover:text-white"
              onClick={() => {
                setShowAdvanced((value) => !value);
                setShowSettings(false);
                setShowMobileMenu(false);
              }}
            >
              Advanced
            </button>
            {showAdvanced && (
              <div className="ui-popover absolute bottom-12 right-0 min-w-48 py-1">
                {ADVANCED_ITEMS.map((item) => (
                  <button
                    key={item.label}
                    className="block w-full px-4 py-2 text-left text-xs text-white/65 transition-colors hover:bg-white/8"
                    onClick={() => (item.page ? navigateToPage(item.page) : closeMenus())}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          className={`ui-bottomnav-mobile mx-auto min-h-14 max-w-[1600px] min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-1 ${
            useCompactNav ? 'grid' : 'hidden'
          }`}
        >
          <div className="min-w-0 px-2">
            <div className="ui-bottomnav-current-label truncate text-[10px] uppercase tracking-[0.16em] text-white/45">
              Navigation
            </div>
            <div className="ui-bottomnav-current-page truncate text-sm font-medium text-white">
              {currentPageLabel}
            </div>
          </div>

          <button
            data-mobile-menu-button
            aria-controls="mobile-navigation-sheet"
            aria-expanded={showMobileMenu}
            className="ui-bottomnav-menu-button inline-flex min-h-11 items-center gap-2 rounded-full border border-white/12 bg-white/10 px-4 text-xs font-semibold tracking-[0.14em] text-white transition-colors hover:bg-white/16"
            onClick={() => {
              setShowMobileMenu((value) => !value);
              setShowSettings(false);
              setShowAdvanced(false);
            }}
          >
            <span className="ui-bottomnav-menu-icon flex h-3.5 w-4 shrink-0 flex-col justify-between" aria-hidden="true">
              <span className="block h-[1.5px] rounded-full bg-current" />
              <span className="block h-[1.5px] rounded-full bg-current" />
              <span className="block h-[1.5px] rounded-full bg-current" />
            </span>
            <span>MENU</span>
          </button>
        </div>
      </nav>

      {showMobileMenu && useCompactNav && (
        <div
          className="app-short-landscape-block fixed inset-0 z-[170] bg-black/35"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeMenus();
            }
          }}
        >
          <div className="absolute inset-x-0 bottom-0 flex justify-center px-2 pb-[calc(env(safe-area-inset-bottom)+4.5rem)] pt-4">
            <div
              id="mobile-navigation-sheet"
              data-mobile-menu-sheet
              className="ui-popover ui-bottomnav-menu-sheet fade-in w-full max-w-sm overflow-hidden"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-white/10 px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">
                  Navigate
                </div>
                <div className="mt-1 text-sm font-medium text-white">Choose a destination</div>
              </div>

              <div className="ui-bottomnav-menu-scroll max-h-[min(68dvh,26rem)] overflow-y-auto py-1">
                {mobilePages.map((item) => (
                  <button
                    key={item.key}
                    data-mobile-menu-item={item.label}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-white/86 transition-colors hover:bg-white/8"
                    onClick={() =>
                      item.workspace ? navigateToCrossVerification() : navigateToPage(item.page)
                    }
                  >
                    <span>{item.label}</span>
                    <span className="text-[10px] uppercase tracking-[0.16em] text-white/45">
                      {(item.workspace
                        ? isCrossVerificationActive
                        : state.currentPage === item.page) &&
                      !(item.key === 'secondary_workspace' && isCrossVerificationActive)
                        ? 'Current'
                        : item.shortLabel}
                    </span>
                  </button>
                ))}

                <div className="border-b border-t border-white/10 px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-white/45">
                  Settings
                </div>
                {SETTINGS_ITEMS.map((item) => (
                  <button
                    key={item}
                    data-mobile-menu-item={item}
                    className="block w-full px-4 py-3 text-left text-sm text-white/72 transition-colors hover:bg-white/8 hover:text-white"
                    onClick={closeMenus}
                  >
                    {item}
                  </button>
                ))}

                <div className="border-b border-t border-white/10 px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-white/45">
                  Advanced
                </div>
                {ADVANCED_ITEMS.map((item) => (
                  <button
                    key={item.label}
                    data-mobile-menu-item={item.label}
                    className="block w-full px-4 py-3 text-left text-sm text-white/72 transition-colors hover:bg-white/8 hover:text-white"
                    onClick={() => (item.page ? navigateToPage(item.page) : closeMenus())}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
