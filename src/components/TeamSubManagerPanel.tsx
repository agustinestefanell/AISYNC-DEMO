import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { buildTeamSubManagerAuditAnswerPayload } from '../auditRouting';
import { useApp } from '../context';
import { openCrossVerificationWindow } from '../crossVerificationLaunch';
import { getProviderDisplayName } from '../data/teams';
import { isValidTeamSubManagerForwardTarget } from '../reviewForwardPolicy';
import type { AIProvider, FileType, ReviewForwardTargetOption, WorkspaceVersion } from '../types';
import { formatWorkspaceVersionTimestamp } from '../versioning';
import { Modal } from './Modal';
import { LockIconButton } from './LockIconButton';
import { SaveBackupModal } from './SaveBackupModal';
import { Toast } from './Toast';
import type { TeamMessage } from './SecondaryWorkspacePanel';

function createMessageId() {
  return `team_manager_msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getNowTime() {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildForwardedContent(messages: TeamMessage[], sourceLabel: string) {
  const body = messages
    .map((message) => `${message.senderLabel}: ${message.content.trim()}`)
    .join('\n\n');

  return `REVIEWED & FORWARDED FROM ${sourceLabel}\n\n${body}`;
}

function buildSaveContent(messages: TeamMessage[]) {
  return messages.map((message) => `${message.senderLabel}: ${message.content}`).join('\n\n');
}

export interface TeamSubManagerForwardOption extends ReviewForwardTargetOption {}

export function TeamSubManagerPanel({
  teamId,
  teamLabel,
  provider,
  theme,
  messages,
  selectedIds,
  draft,
  documentLocked,
  workspaceVersions,
  seedMessages,
  forwardOptions,
  onSetDraft,
  onToggleDocumentLock,
  onSaveVersion,
  onToggleSelect,
  onClearSelection,
  onAddUserMessage,
  onAddAgentReply,
  onForwardSelection,
  onResetToSeed,
  onClearChat,
  style,
}: {
  teamId: string;
  teamLabel: string;
  provider: AIProvider;
  theme: {
    ribbon: string;
    soft: string;
    border: string;
    accent: string;
  };
  messages: TeamMessage[];
  selectedIds: string[];
  draft: string;
  documentLocked: boolean;
  workspaceVersions: WorkspaceVersion[];
  seedMessages: TeamMessage[];
  forwardOptions: TeamSubManagerForwardOption[];
  onSetDraft: (value: string) => void;
  onToggleDocumentLock: () => void;
  onSaveVersion: () => void;
  onToggleSelect: (messageId: string) => void;
  onClearSelection: () => void;
  onAddUserMessage: (message: TeamMessage) => void;
  onAddAgentReply: (message: TeamMessage) => void;
  onForwardSelection: (target: TeamSubManagerForwardOption, message: TeamMessage) => void;
  onResetToSeed: (messages: TeamMessage[]) => void;
  onClearChat: () => void;
  style?: CSSProperties;
}) {
  const { state, saveFile, dispatch } = useApp();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);
  const [showSaveSelection, setShowSaveSelection] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [toast, setToast] = useState('');
  const [forwardTarget, setForwardTarget] = useState(forwardOptions[0]?.id ?? '');
  const [fileTitle, setFileTitle] = useState('');
  const [fileType, setFileType] = useState<FileType>('Conversation');
  const [projectId, setProjectId] = useState(state.projects[0]?.id ?? '');
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));

  const selectedMessages = useMemo(
    () => messages.filter((message) => selectedIds.includes(message.id)),
    [messages, selectedIds],
  );
  const latestVersion = workspaceVersions[workspaceVersions.length - 1] ?? null;
  const versionSummary = latestVersion
    ? `Version ${latestVersion.versionNumber} - Saved ${formatWorkspaceVersionTimestamp(
        latestVersion.savedAt,
      )}`
    : 'No version saved yet';

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    viewport.scrollTop = viewport.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (forwardOptions.length > 0 && !forwardOptions.some((option) => option.id === forwardTarget)) {
      setForwardTarget(forwardOptions[0].id);
    }
  }, [forwardOptions, forwardTarget]);

  useEffect(() => {
    if (showSaveModal) {
      setProjectId((current) => current || state.projects[0]?.id || '');
      setEventDate(new Date().toISOString().slice(0, 10));
      setFileTitle(
        `${teamLabel.replace(/[^a-zA-Z0-9]+/g, '_')}_SubManager_${new Date().toISOString().slice(0, 10)}`,
      );
    }
  }, [showSaveModal, state.projects, teamLabel]);

  useEffect(() => {
    if (showSaveModal && selectedMessages.length === 0) {
      setShowSaveModal(false);
    }
  }, [selectedMessages.length, showSaveModal]);

  const sendMessage = () => {
    if (documentLocked) {
      setToast('Document lock is active. Unlock this sub-manager thread to send new content.');
      return;
    }

    if (!draft.trim()) {
      return;
    }

    onAddUserMessage({
      id: createMessageId(),
      role: 'user',
      content: draft.trim(),
      timestamp: getNowTime(),
      senderLabel: 'User',
    });
    onSetDraft('');

    window.setTimeout(() => {
      onAddAgentReply({
        id: createMessageId(),
        role: 'agent',
        content: `${teamLabel} Sub-Manager logged the update and is coordinating the next reviewed team action.`,
        timestamp: getNowTime(),
        senderLabel: getProviderDisplayName(provider),
      });
    }, 620);
  };

  const handleForward = () => {
    if (documentLocked) {
      setToast('Document lock is active. Unlock this sub-manager thread to review and forward.');
      return;
    }

    if (selectedMessages.length === 0) {
      setToast('Select messages to review and forward first.');
      return;
    }

    const target = forwardOptions.find((option) => option.id === forwardTarget);
    if (!target || !isValidTeamSubManagerForwardTarget(target, forwardOptions)) {
      setToast('Choose a valid destination first.');
      return;
    }

    onForwardSelection(target, {
      id: createMessageId(),
      role: 'system',
      content: buildForwardedContent(selectedMessages, `${teamLabel.toUpperCase()} SUB-MANAGER`),
      timestamp: getNowTime(),
      senderLabel: 'System',
      variant: 'forwarded',
    });
    onClearSelection();
    setToast(`Reviewed & forwarded ${selectedMessages.length} message(s) to ${target.label}.`);
  };

  const handleSave = () => {
    if (selectedMessages.length === 0) {
      setToast('Select the messages you want to back up first.');
      return;
    }

    saveFile({
      agent: 'manager',
      sourceLabel: `${teamLabel} | Sub-Manager`,
      content: buildSaveContent(selectedMessages),
      title:
        fileTitle.trim() ||
        `${teamLabel}_SubManager_${new Date().toISOString().slice(0, 10)}`,
      type: fileType,
      projectId,
      date: eventDate,
    });
    onClearSelection();
    setShowSaveSelection(false);
    setShowSaveModal(false);
    setToast('Saved to Documentation Mode.');
  };

  const openSaveBackup = () => {
    setShowSaveSelection(true);

    if (selectedMessages.length === 0) {
      setToast('Manual backup requires selecting messages first.');
      return;
    }

    setShowSaveModal(true);
  };

  const handleAuditAnswer = () => {
    if (documentLocked) {
      setToast('Document lock is active. Unlock this sub-manager thread to audit the selection.');
      return;
    }

    if (selectedMessages.length === 0) {
      return;
    }

    const payload = buildTeamSubManagerAuditAnswerPayload({
      page: 'F',
      workspace: state.secondaryWorkspace,
      teamId,
      teamLabel,
      selectedMessages,
    });

    if (openCrossVerificationWindow(payload)) {
      setToast('Cross Verification opened in a new window.');
      return;
    }

    dispatch({ type: 'OPEN_CROSS_VERIFICATION_ROUTE', payload });
    setToast('Popup blocked. Cross Verification opened in this window.');
  };

  const handleSaveVersion = () => {
    if (messages.length === 0) {
      setToast('Add or keep some thread content before saving a version.');
      return;
    }

    onSaveVersion();
    setToast(`Version ${workspaceVersions.length + 1} saved.`);
  };

  return (
    <div
      data-team-panel={`${teamId}-sub-manager`}
      className="flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-neutral-200 bg-white last:border-r-0"
      style={{ ...style, borderTopColor: theme.ribbon, borderTopWidth: 2 }}
    >
      <div
        className="ui-chat-panel-header ui-team-panel-header px-3 py-2"
        style={{ backgroundColor: theme.soft, color: theme.accent }}
      >
        <div className="ui-chat-panel-header-row flex items-start justify-between gap-2">
          <div className="ui-chat-panel-title min-w-0 flex-1 text-left text-[11px] font-semibold tracking-[0.12em]">
            <div className="truncate uppercase tracking-[0.16em] text-[10px] opacity-70">
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="ui-role-dot"
                  style={{ backgroundColor: theme.ribbon, boxShadow: `0 0 0 4px ${theme.soft}` }}
                />
                <span>{teamLabel}</span>
              </span>
            </div>
            <div className="truncate text-[11px] font-semibold text-neutral-900">
              Sub-Manager | {getProviderDisplayName(provider)}
            </div>
            <div className="ui-chat-panel-meta">{versionSummary}</div>
          </div>

          <LockIconButton locked={documentLocked} onClick={onToggleDocumentLock} />
        </div>
      </div>

      <div
        ref={viewportRef}
        className="ui-chat-viewport scrollbar-thin flex-1 overflow-y-auto px-3 py-2"
        style={{ minHeight: 0 }}
      >
        <div className="ui-chat-message-list flex flex-col gap-3">
          {messages.map((message) => {
            const isSelected = selectedIds.includes(message.id);
            const isUser = message.role === 'user';
            const isForwarded = message.variant === 'forwarded';

            return (
              <div
                key={message.id}
                className={`ui-chat-message-row group flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <button
                    className={`mt-1 h-4 w-4 rounded border transition-colors ${
                      isSelected
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
                        : 'border-neutral-300 bg-white hover:border-neutral-500'
                    }`}
                    onClick={() => onToggleSelect(message.id)}
                  >
                    <span className="sr-only">Select message</span>
                  </button>
                )}

                <button
                  className={`max-w-[88%] text-left ${isUser ? 'order-1' : ''}`}
                  onClick={() => onToggleSelect(message.id)}
                >
                  <div className="ui-chat-message-meta mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-neutral-400">
                    <span>{message.senderLabel}</span>
                    <span>{message.timestamp}</span>
                  </div>
                  <div
                    className={`ui-chat-message-bubble px-3 py-2 text-xs leading-5 transition-shadow ${
                      isForwarded
                        ? 'ui-message-bubble ui-message-bubble-forwarded'
                        : isUser
                          ? 'ui-message-bubble ui-message-bubble-user'
                          : 'ui-message-bubble border-[rgba(164,145,102,0.14)]'
                    } ${isSelected ? 'ring-2 ring-[rgba(0,122,255,0.18)]' : ''}`}
                  >
                    {isForwarded ? (
                      <>
                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                          {message.content.split('\n')[0]}
                        </div>
                        <div className="whitespace-pre-wrap">
                          {message.content.split('\n').slice(2).join('\n')}
                        </div>
                      </>
                    ) : (
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    )}
                  </div>
                </button>

                {isUser && (
                  <button
                    className={`mt-1 h-4 w-4 rounded border transition-colors ${
                      isSelected
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
                        : 'border-neutral-300 bg-white hover:border-neutral-500'
                    }`}
                    onClick={() => onToggleSelect(message.id)}
                  >
                    <span className="sr-only">Select message</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="ui-chat-composer-section shrink-0 px-3 pb-0.5 pt-0.5"
        style={{ backgroundColor: theme.soft }}
      >
        <div className="ui-chat-composer">
          <input
            className="ui-chat-composer-input"
            placeholder={
              documentLocked
                ? 'Document locked. Unlock to message this sub-manager thread.'
                : `Message ${teamLabel} Sub-Manager...`
            }
            value={draft}
            disabled={documentLocked}
            onChange={(event) => onSetDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
          />
          <button
            className="ui-button ui-button-primary ui-chat-send ui-chat-action-button text-xs text-white disabled:cursor-not-allowed disabled:opacity-45"
            onClick={sendMessage}
            disabled={documentLocked}
          >
            Send
          </button>
        </div>
      </div>

      <div
        className="ui-chat-forward-section shrink-0 px-3 pb-0.5 pt-0.5"
        style={{ backgroundColor: theme.soft }}
      >
        <div className="ui-forward-stack">
          <div className="ui-forward-row">
            <div className="ui-forward-select-wrap">
              <select
                className="ui-forward-select"
                value={forwardTarget}
                disabled={documentLocked}
                onChange={(event) => setForwardTarget(event.target.value)}
              >
                {forwardOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="ui-forward-select-caret">v</span>
            </div>

            <button
              className="ui-button ui-button-primary ui-chat-action-button text-xs text-white disabled:cursor-not-allowed disabled:opacity-45"
              onClick={handleForward}
              title="Review and forward selected messages"
              disabled={documentLocked || selectedMessages.length === 0 || forwardOptions.length === 0}
            >
              Review & Forward
            </button>
          </div>
        </div>

        {(showSaveSelection || selectedMessages.length > 0) && (
          <div className="mt-2 grid gap-2">
            {showSaveSelection && (
              <div className="ui-surface-subtle flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[11px] text-neutral-700">
                <div>
                  Manual backup selection required. Choose the exact messages to save before
                  confirming the backup.
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="ui-pill border-transparent bg-white text-neutral-700">
                    {selectedMessages.length} selected
                  </span>
                  <button
                    className="ui-button min-h-7 px-3 text-[11px] text-neutral-700 disabled:cursor-not-allowed disabled:opacity-45"
                    onClick={() => setShowSaveModal(true)}
                    disabled={selectedMessages.length === 0}
                  >
                    Save Selected
                  </button>
                  <button
                    className="ui-button min-h-7 px-3 text-[11px] text-neutral-700"
                    onClick={() => {
                      onClearSelection();
                      setShowSaveSelection(false);
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {selectedMessages.length > 0 && !showSaveSelection && (
              <button
                className="mt-1 text-[11px] text-neutral-500 underline-offset-2 hover:underline"
                onClick={onClearSelection}
              >
                Clear selection
              </button>
            )}
          </div>
        )}
      </div>

      <div
        className="ui-chat-actions-section shrink-0 px-3 pb-2 pt-0"
        style={{ backgroundColor: theme.soft }}
      >
        <div className="ui-chat-actions-grid grid grid-cols-1 gap-1 sm:grid-cols-4">
          <button
            className="ui-button px-3 text-xs text-neutral-700"
            onClick={() => setShowRefreshConfirm(true)}
          >
            Refresh Session
          </button>
          <button
            className="ui-button px-3 text-xs text-neutral-700 disabled:cursor-not-allowed disabled:opacity-45"
            onClick={handleSaveVersion}
            disabled={messages.length === 0}
          >
            Save Version
          </button>
          <button
            className={`ui-button px-3 text-xs ${
              showSaveSelection ? 'ui-button-primary text-white' : 'text-neutral-700'
            }`}
            onClick={openSaveBackup}
          >
            Save / Backup
          </button>
          <button
            className="ui-button ui-button-primary px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-45"
            onClick={handleAuditAnswer}
            disabled={documentLocked || selectedMessages.length === 0}
            title="Send the selected content to Cross Verification"
          >
            Audit AI Answer
          </button>
        </div>
      </div>

      {showRefreshConfirm && (
        <Modal title="Refresh session" onClose={() => setShowRefreshConfirm(false)}>
          <p className="mb-4 text-sm text-neutral-600">
            Reset this session to seed content or clear the chat entirely.
          </p>
          <div className="flex justify-end gap-2">
            <button className="ui-button text-neutral-700" onClick={() => setShowRefreshConfirm(false)}>
              Cancel
            </button>
            <button
              className="ui-button text-neutral-700"
              onClick={() => {
                onResetToSeed(seedMessages);
                setShowRefreshConfirm(false);
                setShowSaveSelection(false);
                setToast('Seed session restored.');
              }}
            >
              Reset to seed
            </button>
            <button
              className="ui-button ui-button-primary text-white"
              onClick={() => {
                onClearChat();
                setShowRefreshConfirm(false);
                setShowSaveSelection(false);
                setToast('Session cleared.');
              }}
            >
              Clear all
            </button>
          </div>
        </Modal>
      )}

      <SaveBackupModal
        open={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        selectedMessages={selectedMessages}
        fileTitle={fileTitle}
        onFileTitleChange={setFileTitle}
        fileType={fileType}
        onFileTypeChange={(value) => setFileType(value as FileType)}
        projectId={projectId}
        onProjectIdChange={setProjectId}
        eventDate={eventDate}
        onEventDateChange={setEventDate}
        projects={state.projects}
        onSave={handleSave}
      />

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}
