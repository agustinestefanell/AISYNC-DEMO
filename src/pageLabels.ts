import type { DocumentationViewMode, Page, SecondaryManagerPage } from './types';

export function getSecondarySubManagerLabel(page: SecondaryManagerPage) {
  if (page === 'B') return 'SM Documentation Mode';
  if (page === 'C') return 'SM Data Log';
  if (page === 'D') return 'SM Team Map';
  if (page === 'E') return 'SM Prompts Library';
  return 'SM Cross Verification';
}

export function getPageLabel(page: Page) {
  if (page === 'A') return 'Main Workspace';
  if (page === 'B') return 'Documentation Mode';
  if (page === 'C') return 'Audit Log';
  if (page === 'D') return 'Teams Map';
  if (page === 'E') return 'Prompts Library';
  if (page === 'G') return 'Cross Verification';
  if (page === 'H') return 'Saved Chat Versions';
  return 'Secondary Workspace';
}

export function getBottomNavPageLabel(page: Page, secondaryWorkspaceLabel?: string) {
  if (page === 'F') {
    if (secondaryWorkspaceLabel === 'Cross Verification') {
      return secondaryWorkspaceLabel;
    }

    return secondaryWorkspaceLabel
      ? `Secondary Workspace | ${secondaryWorkspaceLabel}`
      : 'Secondary Workspace';
  }

  return getPageLabel(page);
}

export function getTopRibbonSectionLabel(page: Page, secondaryWorkspaceLabel?: string) {
  if (page === 'F') {
    return secondaryWorkspaceLabel ?? 'Secondary Workspace';
  }

  return getPageLabel(page);
}

export function getDocumentationViewLabel(view: DocumentationViewMode) {
  if (view === 'repository') return 'Repository View';
  if (view === 'structure') return 'Structure View';
  if (view === 'audit') return 'Audit View';
  if (view === 'investigate') return 'Investigate View';
  return 'Knowledge Map';
}

export function getDocumentationViewDescription(view: DocumentationViewMode) {
  if (view === 'repository') {
    return 'Primary production view for operating documentation, metadata, and retrieval.';
  }

  if (view === 'structure') {
    return 'Hierarchy and provenance view based on the documentary mirror of Teams.';
  }

  if (view === 'audit') {
    return 'Traceability view for reconstructing document movements, events, and responsibilities.';
  }

  if (view === 'investigate') {
    return 'Contextual view for thematic investigation, chronology, and related document exploration.';
  }

  return 'Secondary analytical view for clusters, dependencies, and documentary gaps.';
}
