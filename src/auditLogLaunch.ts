import type { WorkspaceVersionReference } from './types';

interface AuditDetailLaunchTarget {
  id: string;
  versionReference?: WorkspaceVersionReference | null;
}

function buildBaseUrl() {
  const url = new URL(window.location.href);
  url.search = '';
  return url;
}

export function getAuditEventIdFromLocation() {
  if (typeof window === 'undefined') {
    return null;
  }

  return new URLSearchParams(window.location.search).get('audit_event');
}

export function getWorkspaceVersionReferenceFromLocation(): WorkspaceVersionReference | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const source = params.get('version_source');
  const versionId = params.get('version_id');
  const threadId = params.get('version_thread');

  if (!source || !versionId || !threadId) {
    return null;
  }

  if (source !== 'main' && source !== 'team') {
    return null;
  }

  return {
    source,
    versionId,
    threadId,
    agent: source === 'main' ? (params.get('version_agent') as WorkspaceVersionReference['agent']) ?? undefined : undefined,
    teamId: source === 'team' ? params.get('version_team') ?? undefined : undefined,
    panelScope: source === 'main' ? params.get('version_panel') ?? undefined : undefined,
  };
}

export function openAuditDetailWindow(event: AuditDetailLaunchTarget) {
  if (typeof window === 'undefined') {
    return false;
  }

  const url = buildBaseUrl();

  if (event.versionReference) {
    url.searchParams.set('page', 'H');
    url.searchParams.set('version_source', event.versionReference.source);
    url.searchParams.set('version_id', event.versionReference.versionId);
    url.searchParams.set('version_thread', event.versionReference.threadId);

    if (event.versionReference.source === 'main' && event.versionReference.agent) {
      url.searchParams.set('version_agent', event.versionReference.agent);
    }

    if (event.versionReference.source === 'main' && event.versionReference.panelScope) {
      url.searchParams.set('version_panel', event.versionReference.panelScope);
    }

    if (event.versionReference.source === 'team' && event.versionReference.teamId) {
      url.searchParams.set('version_team', event.versionReference.teamId);
    }
  } else {
    url.searchParams.set('page', 'C');
    url.searchParams.set('audit_event', event.id);
  }

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
