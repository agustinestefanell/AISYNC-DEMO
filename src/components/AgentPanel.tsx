import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { buildMainWorkspaceAuditAnswerPayload } from '../auditRouting';
import { useApp } from '../context';
import { openCrossVerificationWindow } from '../crossVerificationLaunch';
import { appendMessageToTeamManagerThread } from '../crossVerificationRouting';
import {
  getAgentPanelForwardTargets,
  isValidAgentPanelForwardTarget,
} from '../reviewForwardPolicy';
import { createSavedObjectStorageEntry } from '../savedObjects';
import type { AgentRole, DocumentationOriginWorkspace, FileType, Message } from '../types';
import {
  createCheckpointActivityEvent,
  createCheckpointSavedObject,
  createWorkspaceVersion,
  createWorkspaceVersionEvent,
  formatWorkspaceVersionTimestamp,
} from '../versioning';
import { ContextUploadModal, type ContextUploadItem } from './ContextUploadModal';
import { LockIconButton } from './LockIconButton';
import { MessageSelectionToggle } from './MessageSelectionToggle';
import { Modal } from './Modal';
import { SaveBackupModal } from './SaveBackupModal';
import { Toast } from './Toast';

const MODEL_LABELS: Record<AgentRole, string> = {
  manager: 'Gemini',
  worker1: 'Claude',
  worker2: 'GPT-5',
};

const PANEL_NAMES: Record<AgentRole, string> = {
  manager: 'AI General Manager',
  worker1: 'Worker 1',
  worker2: 'Worker 2',
};

const STUB_REPLIES: Record<AgentRole, string[]> = {
  manager: [
    'Coordination noted. I will structure the next step and assign it to the right worker.',
    'I have enough context. Converting this into a clean execution brief now.',
    'Received. I will keep the workflow simple and route only the required context.',
  ],
  worker1: [
    'Task accepted. I am producing the technical output with the current constraints in mind.',
    'Understood. I am validating the request and turning it into an execution-ready answer.',
    'Confirmed. I will return a concise technical response without expanding scope.',
  ],
  worker2: [
    'Received. I am translating the input into a clear, user-facing summary.',
    'Confirmed. I will synthesize the request and return a clean draft.',
    'Working on it. I will keep the answer structured and easy to reuse.',
  ],
};

function createMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getNowTime() {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getAgentLabel(agent: AgentRole) {
  if (agent === 'manager') return 'Manager';
  if (agent === 'worker1') return 'Worker 1';
  return 'Worker 2';
}

function buildSaveContent(messages: Message[]) {
  return messages
    .map((message) => `${message.senderLabel}: ${message.content}`)
    .join('\n\n');
}

function buildForwardedContent(messages: Message[], sourceLabel: string) {
  const body = messages
    .map((message) => `${message.senderLabel}: ${message.content.trim()}`)
    .join('\n\n');

  return `REVIEWED & FORWARDED FROM ${sourceLabel}\n\n${body}`;
}

export interface AgentPanelProps {
  agent: AgentRole;
  showSaveAction?: boolean;
  showRefreshAction?: boolean;
  editableRole?: boolean;
  auditSourcePage?: 'A';
  managerDisplayName?: string;
  selectionScope?: string;
  panelScope?: string;
  sourceWorkspace?: DocumentationOriginWorkspace;
  sourcePanelId?: string;
  sourcePanelLabel?: string;
  className?: string;
  style?: CSSProperties;
}

function buildHandoffMinimumContext(messages: Message[]) {
  if (messages.length === 0) {
    return 'No selected context available.';
  }

  const excerpt = messages
    .map((message) => `${message.senderLabel}: ${message.content.trim()}`)
    .join(' ')
    .slice(0, 280);

  return `${messages.length} selected message(s). ${excerpt}${excerpt.length >= 280 ? '...' : ''}`;
}

export function AgentPanel({
  agent,
  showRefreshAction = true,
  editableRole = false,
  auditSourcePage,
  managerDisplayName,
  selectionScope,
  panelScope,
  sourceWorkspace = 'main-workspace',
  sourcePanelId,
  sourcePanelLabel,
  className,
  style,
}: AgentPanelProps) {
  const { state, dispatch, saveSelection, createHandoff } = useApp();
  const resolvedSelectionScope = selectionScope ?? agent;
  const resolvedPanelScope = panelScope ?? agent;
  const messages = state.messages[resolvedPanelScope] ?? state.messages[agent] ?? [];
  const selectedIds = state.selectedMessages[resolvedSelectionScope] ?? [];
  const draft = state.drafts[resolvedPanelScope] ?? state.drafts[agent] ?? '';
  const documentLocked = state.documentLocks[resolvedPanelScope] ?? state.documentLocks[agent] ?? false;
  const workspaceVersions =
    state.workspaceVersions[resolvedPanelScope] ?? state.workspaceVersions[agent] ?? [];
  const resolvedPanelId = sourcePanelId ?? resolvedPanelScope;
  const resolvedPanelLabel =
    sourcePanelLabel ??
    (agent === 'manager'
      ? managerDisplayName ?? PANEL_NAMES.manager
      : PANEL_NAMES[agent]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const isManager = agent === 'manager';
  const rolePanelClass =
    agent === 'manager'
      ? 'ui-role-panel-manager'
      : agent === 'worker1'
        ? 'ui-role-panel-worker1'
        : 'ui-role-panel-worker2';
  const roleAccentColor =
    agent === 'manager'
      ? 'var(--color-role-manager-accent)'
      : agent === 'worker1'
        ? 'var(--color-role-worker1-accent)'
        : 'var(--color-role-worker2-accent)';
  const roleAccentSoft =
    agent === 'manager'
      ? 'var(--color-role-manager-soft)'
      : agent === 'worker1'
        ? 'var(--color-role-worker1-soft)'
        : 'var(--color-role-worker2-soft)';

  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSaveSelection, setShowSaveSelection] = useState(false);
  const [showContextModal, setShowContextModal] = useState(false);
  const [contextItems, setContextItems] = useState<ContextUploadItem[]>([]);
  const [toast, setToast] = useState('');
  const [roleInput, setRoleInput] = useState(
    agent === 'manager' ? '' : state.workerRoles[agent],
  );
  const [editingRole, setEditingRole] = useState(false);
  const [forwardTarget, setForwardTarget] = useState('');
  const [fileTitle, setFileTitle] = useState('');
  const [fileType] = useState<FileType>('Conversation');
  const [projectId, setProjectId] = useState(state.projects[0]?.id ?? '');
  const [saveTimestamp, setSaveTimestamp] = useState(new Date().toISOString());

  const targetOptions = useMemo(
    () => getAgentPanelForwardTargets(agent, managerDisplayName),
    [agent, managerDisplayName],
  );
  const selectedMessages = useMemo(
    () => messages.filter((message) => selectedIds.includes(message.id)),
    [messages, selectedIds],
  );
  const hasSelection = selectedIds.length > 0;
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
    if (showSaveModal) {
      setProjectId((current) => current || state.projects[0]?.id || '');
      setSaveTimestamp(new Date().toISOString());
      setFileTitle(`Session_${agent}_${new Date().toISOString().slice(0, 10)}`);
    }
  }, [agent, showSaveModal, state.projects]);

  useEffect(() => {
    if (editableRole) {
      setRoleInput(agent === 'manager' ? '' : state.workerRoles[agent]);
    }
  }, [agent, editableRole, state.workerRoles]);

  useEffect(() => {
    if (showSaveModal && selectedMessages.length === 0) {
      setShowSaveModal(false);
    }
  }, [selectedMessages.length, showSaveModal]);

  useEffect(() => {
    if (!targetOptions.some((option) => option.id === forwardTarget)) {
      setForwardTarget(targetOptions[0]?.id ?? '');
    }
  }, [forwardTarget, targetOptions]);

  const headerLabel = useMemo(() => {
    if (agent === 'manager') {
      return `${managerDisplayName ?? PANEL_NAMES.manager} | ${MODEL_LABELS.manager}`;
    }

    const roleValue = state.workerRoles[agent] || '';
    return `${PANEL_NAMES[agent]} - ${roleValue} | ${MODEL_LABELS[agent]} | (Click to set this role)`;
  }, [agent, managerDisplayName, state.workerRoles]);

  const sendMessage = () => {
    if (documentLocked) {
      setToast('Panel lock is active. Unlock panel to send new content.');
      return;
    }

    if (!draft.trim()) {
      return;
    }

    dispatch({
      type: 'ADD_MESSAGE',
      agent,
      panelScope: resolvedPanelScope,
      message: {
        id: createMessageId(),
        role: 'user',
        content: draft.trim(),
        timestamp: getNowTime(),
        agent,
        senderLabel: 'User',
      },
    });
    dispatch({ type: 'SET_DRAFT', agent, value: '', panelScope: resolvedPanelScope });

    window.setTimeout(() => {
      const replyBank = STUB_REPLIES[agent];
      const reply = replyBank[Math.floor(Math.random() * replyBank.length)];
      dispatch({
        type: 'ADD_MESSAGE',
        agent,
        panelScope: resolvedPanelScope,
        message: {
          id: createMessageId(),
          role: 'agent',
          content: reply,
          timestamp: getNowTime(),
          agent,
          senderLabel: MODEL_LABELS[agent],
        },
      });
    }, 850);
  };

  const handleForward = () => {
    if (documentLocked) {
      setToast('Panel lock is active. Unlock panel to review and forward.');
      return;
    }

    if (selectedIds.length === 0) {
      setToast('Select messages to review and forward first.');
      return;
    }

    if (!isValidAgentPanelForwardTarget(agent, forwardTarget, managerDisplayName)) {
      setToast('Choose a valid destination inside the current review hierarchy.');
      return;
    }

    const target =
      targetOptions.find((option) => option.id === forwardTarget) ?? null;
    if (!target) {
      setToast('Choose a valid destination inside the current review hierarchy.');
      return;
    }

    const orderedMessages = messages.filter((message) => selectedIds.includes(message.id));
    const sourceLabel = getAgentLabel(agent).toUpperCase();
    const forwardedContent = buildForwardedContent(orderedMessages, sourceLabel);
    const forwardedMessage: Message = {
      id: createMessageId(),
      role: 'system',
      content: forwardedContent,
      timestamp: getNowTime(),
      agent: target.agentRole ?? 'manager',
      senderLabel: 'System',
      variant: 'forwarded',
    };

    if (target.kind === 'main-worker' && target.agentRole) {
      dispatch({
        type: 'ADD_MESSAGE',
        agent: target.agentRole,
        message: {
          ...forwardedMessage,
          agent: target.agentRole,
        },
      });
    } else if (target.kind === 'general-manager' && target.agentRole) {
      dispatch({
        type: 'ADD_MESSAGE',
        agent: target.agentRole,
        message: {
          ...forwardedMessage,
          agent: target.agentRole,
        },
      });
    } else if (target.kind === 'team-sub-manager' && target.teamId) {
      appendMessageToTeamManagerThread(target.teamId, {
        id: forwardedMessage.id,
        role: forwardedMessage.role,
        content: forwardedMessage.content,
        timestamp: forwardedMessage.timestamp,
        senderLabel: forwardedMessage.senderLabel,
        variant: forwardedMessage.variant,
      });
    } else {
      setToast('That destination is blocked by the current review hierarchy.');
      return;
    }

    dispatch({ type: 'CLEAR_SELECTION', agent, selectionScope: resolvedSelectionScope });
    dispatch({
      type: 'ADD_ACTIVITY_EVENT',
      event: {
        id: `activity_${Date.now()}`,
        eventType: 'review-forward',
        createdAt: new Date().toISOString(),
        actor: state.userName,
        sourceWorkspace,
        sourceTeamId: 'global',
        sourceTeamLabel: 'Main Workspace',
        sourcePanelId: resolvedPanelId,
        sourcePanelLabel: resolvedPanelLabel,
        projectId: state.projects[0]?.id ?? 'project_1',
        relatedObjectId: null,
        detail: `Reviewed and forwarded ${orderedMessages.length} message(s) to ${target.label}`,
        metadata: {
          destinationLabel: target.label,
          selectedCount: orderedMessages.length,
        },
      },
    });
    setToast(`Reviewed & forwarded ${orderedMessages.length} message(s) to ${target.label}.`);
  };

  const handleCreateHandoff = () => {
    if (documentLocked) {
      setToast('Panel lock is active. Unlock panel to create a handoff package.');
      return;
    }

    if (selectedIds.length === 0) {
      setToast('Select messages first to create a handoff package.');
      return;
    }

    const target =
      targetOptions.find((option) => option.id === forwardTarget) ?? null;
    if (!target) {
      setToast('Choose a valid handoff destination inside the current hierarchy.');
      return;
    }

    const orderedMessages = messages.filter((message) => selectedIds.includes(message.id));
    const project = state.projects.find((item) => item.id === projectId) ?? state.projects[0];
    const destination =
      target.kind === 'team-sub-manager'
        ? {
            workspace: 'team-workspace' as const,
            teamId: target.teamId ?? null,
            teamLabel: target.label,
            panelId: target.nodeId ?? `${target.teamId ?? 'team'}-sub-manager`,
            panelLabel: target.label,
          }
        : {
            workspace: 'main-workspace' as const,
            teamId: 'global',
            teamLabel: 'Main Workspace',
            panelId: `main-${target.agentRole ?? 'manager'}`,
            panelLabel: target.label,
          };

    createHandoff({
      title: `Handoff | ${getAgentLabel(agent)} -> ${target.label}`,
      projectId: project?.id ?? projectId,
      sourceWorkspace,
      sourceTeamId: 'global',
      sourceTeamLabel: 'Main Workspace',
      sourcePanelId: resolvedPanelId,
      sourcePanelLabel: resolvedPanelLabel,
      destinationWorkspace: destination.workspace,
      destinationTeamId: destination.teamId,
      destinationTeamLabel: destination.teamLabel,
      destinationPanelId: destination.panelId,
      destinationPanelLabel: destination.panelLabel,
      transferredMessages: orderedMessages.map((message) => ({
        id: message.id,
        senderLabel: message.senderLabel,
        timestamp: message.timestamp,
        content: message.content,
      })),
      transferredContent: buildSaveContent(orderedMessages),
      objective: `Transfer reviewed work from ${getAgentLabel(agent)} to ${target.label}.`,
      minimumContext: buildHandoffMinimumContext(orderedMessages),
      riskNotes: documentLocked ? ['Source panel was locked at handoff time.'] : [],
    });
    dispatch({ type: 'CLEAR_SELECTION', agent, selectionScope: resolvedSelectionScope });
    setToast(`Handoff package created for ${target.label}.`);
  };

  const handleAuditAnswer = () => {
    if (documentLocked) {
      setToast('Panel lock is active. Unlock panel to audit the selected content.');
      return;
    }

    if (!auditSourcePage || selectedMessages.length === 0) {
      return;
    }

    const payload = buildMainWorkspaceAuditAnswerPayload({
      page: auditSourcePage,
      agent,
      managerDisplayName,
      selectedMessages,
    });

    if (openCrossVerificationWindow(payload)) {
      setToast('Cross Verification opened in a new window.');
      return;
    }

    dispatch({ type: 'OPEN_CROSS_VERIFICATION_ROUTE', payload });
    setToast('Popup blocked. Cross Verification opened in this window.');
  };

  const handleSave = () => {
    if (selectedMessages.length === 0) {
      setToast('Select the messages you want to back up first.');
      return;
    }

    saveSelection({
      agent,
      content: buildSaveContent(selectedMessages),
      title: fileTitle.trim() || `Session_${agent}_${new Date().toISOString().slice(0, 10)}`,
      type: fileType,
      projectId,
      selectedMessages: selectedMessages.map((message) => ({
        id: message.id,
        senderLabel: message.senderLabel,
        timestamp: message.timestamp,
        content: message.content,
      })),
      date: saveTimestamp.slice(0, 10),
      sourcePanelId: resolvedPanelId,
      sourcePanelLabel: resolvedPanelLabel,
    });
    dispatch({ type: 'CLEAR_SELECTION', agent, selectionScope: resolvedSelectionScope });
    setShowSaveModal(false);
    setShowSaveSelection(false);
    setToast('Saved to Documentation Mode.');
  };

  const openSaveBackup = () => {
    setShowSaveSelection(true);

    if (selectedMessages.length === 0) {
      setToast('Manual backup requires selecting messages first.');
      return;
    }

    setSaveTimestamp(new Date().toISOString());
    setShowSaveModal(true);
  };

  const openPromptsLibrary = () => {
    dispatch({ type: 'SET_PAGE', page: 'E' });
  };

  const handleSaveVersion = () => {
    if (messages.length === 0) {
      setToast('Add or keep some thread content before saving a version.');
      return;
    }

    const version = createWorkspaceVersion(
      messages,
      draft,
      documentLocked,
      workspaceVersions,
      documentLocked ? 'Locked checkpoint' : undefined,
    );

    dispatch({
      type: 'SAVE_WORKSPACE_VERSION',
      agent,
      version,
      panelScope: resolvedPanelScope,
    });
    const checkpoint = createCheckpointSavedObject({
      version,
      projectId: state.projects[0]?.id ?? 'project_1',
      projectLabel: state.projects[0]?.name ?? state.projects[0]?.id ?? 'project_1',
      createdBy: state.userName,
      sourceWorkspace,
      sourceTeamId: 'global',
      sourceTeamLabel: 'Main Workspace',
      sourcePanelId: resolvedPanelId,
      sourcePanelLabel: resolvedPanelLabel,
      threadId: resolvedPanelScope,
      threadLabel: resolvedPanelLabel,
    });
    dispatch({
      type: 'SAVE_SAVED_OBJECT',
      object: checkpoint,
      storageEntry: createSavedObjectStorageEntry(checkpoint),
    });
    dispatch({
      type: 'ADD_ACTIVITY_EVENT',
      event: createCheckpointActivityEvent({
        checkpoint,
        actor: state.userName,
      }),
    });
    dispatch({
      type: 'ADD_CALENDAR_EVENT',
      event: createWorkspaceVersionEvent({
        version,
        projectId: state.projects[0]?.id ?? 'project_1',
        agent,
        userLabel: state.userName,
        sourceLabel: resolvedPanelLabel,
        teamId: 'global',
        teamLabel: 'Main Workspace',
        threadLabel: resolvedPanelLabel,
        actorLabel: resolvedPanelLabel,
        managerLabel: 'AI General Manager',
        workerLabel: agent === 'manager' ? undefined : getAgentLabel(agent),
        versionSource: 'main',
        versionThreadId: resolvedPanelScope,
      }),
    });
    setToast(`Version ${version.versionNumber} saved.`);
  };

  return (
    <div
      data-agent-panel={agent}
      className={`ui-role-panel flex min-h-0 min-w-0 flex-col overflow-hidden border-r last:border-r-0 ${
        isManager
          ? 'ui-manager-panel'
          : 'border-r-neutral-200 bg-white'
      } ${rolePanelClass} ${className ?? ''}`}
      style={style}
    >
      <div
        className={`ui-chat-panel-header px-3 py-2 ${
          isManager
            ? 'ui-manager-header'
            : 'ui-worker-header'
        }`}
      >
        <div className="ui-chat-panel-header-row flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <span
              aria-hidden="true"
              className="ui-role-dot"
              style={{ backgroundColor: roleAccentColor, boxShadow: `0 0 0 4px ${roleAccentSoft}` }}
            />
            <div className="min-w-0 flex-1">
              {editableRole && editingRole ? (
                <input
                  className="ui-input h-8 min-h-8 flex-1 px-2 text-xs"
                  value={roleInput}
                  onChange={(event) => setRoleInput(event.target.value)}
                  onBlur={() => {
                    dispatch({
                      type: 'SET_WORKER_ROLE',
                      worker: agent as 'worker1' | 'worker2',
                      role: roleInput.trim(),
                    });
                    setEditingRole(false);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      dispatch({
                        type: 'SET_WORKER_ROLE',
                        worker: agent as 'worker1' | 'worker2',
                        role: roleInput.trim(),
                      });
                      setEditingRole(false);
                    }
                  }}
                  autoFocus
                />
              ) : (
                <button
                  className={`ui-chat-panel-title w-full text-left text-[11px] font-semibold tracking-[0.12em] ${
                    editableRole ? 'cursor-pointer' : 'cursor-default'
                  }`}
                  onClick={() => {
                    if (editableRole) {
                      setEditingRole(true);
                    }
                  }}
                >
                  {headerLabel}
                </button>
              )}
              <div className="ui-chat-panel-meta">{versionSummary}</div>
            </div>
          </div>

          <LockIconButton
            locked={documentLocked}
            onClick={() =>
              dispatch({
                type: 'SET_DOCUMENT_LOCK',
                agent,
                value: !documentLocked,
                panelScope: resolvedPanelScope,
              })
            }
          />
        </div>
      </div>

      <div
        className={`shrink-0 px-3 pb-1 pt-1 ${
          isManager ? 'ui-manager-section' : 'ui-worker-section-soft'
        }`}
      >
        <div className="ui-chat-tools-row">
          <button className="ui-chat-prompt shrink-0" onClick={openPromptsLibrary}>
            Prompt Library
          </button>
          <button className="ui-chat-prompt shrink-0" onClick={() => setShowContextModal(true)}>
            Add Context File
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={`ui-chat-viewport scrollbar-thin flex-1 overflow-y-auto px-3 py-2 ${
          isManager ? 'ui-manager-viewport' : 'ui-worker-viewport'
        }`}
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
                  <MessageSelectionToggle
                    selected={isSelected}
                    onClick={() =>
                      dispatch({
                        type: 'TOGGLE_SELECT_MESSAGE',
                        agent,
                        selectionScope: resolvedSelectionScope,
                        messageId: message.id,
                      })
                    }
                  />
                )}

                <button
                  className={`max-w-[88%] text-left ${isUser ? 'order-1' : ''}`}
                  onClick={() =>
                    dispatch({
                      type: 'TOGGLE_SELECT_MESSAGE',
                      agent,
                      selectionScope: resolvedSelectionScope,
                      messageId: message.id,
                    })
                  }
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
                          : isManager
                            ? 'ui-message-bubble border-[rgba(164,145,102,0.14)]'
                            : 'ui-message-bubble'
                    } ${isSelected ? 'ui-message-bubble-selected' : ''}`}
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
                  <MessageSelectionToggle
                    selected={isSelected}
                    onClick={() =>
                      dispatch({
                        type: 'TOGGLE_SELECT_MESSAGE',
                        agent,
                        selectionScope: resolvedSelectionScope,
                        messageId: message.id,
                      })
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div
        className={`ui-chat-composer-section shrink-0 px-3 pb-0.5 pt-0.5 ${
          isManager ? 'ui-manager-section' : 'ui-worker-section'
        }`}
      >
        <div className="ui-chat-composer">
          <input
            className="ui-chat-composer-input"
            placeholder={
              documentLocked
                ? 'Panel locked. Unlock panel to send new content.'
                : `Message ${MODEL_LABELS[agent]}...`
            }
            value={draft}
            disabled={documentLocked}
            onChange={(event) =>
              dispatch({ type: 'SET_DRAFT', agent, value: event.target.value, panelScope: resolvedPanelScope })
            }
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
        className={`ui-chat-forward-section shrink-0 px-3 pb-0.5 pt-0.5 ${
          isManager ? 'ui-manager-section' : 'ui-worker-section-soft'
        }`}
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
                {targetOptions.map((option) => (
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
              disabled={documentLocked || selectedIds.length === 0}
            >
              Review & Forward
            </button>
          </div>
          <button
            className="ui-button ui-button-primary ui-chat-action-button px-3 text-xs text-white disabled:cursor-not-allowed disabled:opacity-45"
            onClick={handleCreateHandoff}
            title="Create a formal handoff package from the selected messages and destination above"
            disabled={documentLocked || selectedIds.length === 0 || targetOptions.length === 0}
          >
            Create Handoff Package
          </button>
        </div>

        {(showSaveSelection || hasSelection || contextItems.length > 0) && (
          <div className="mt-2 grid gap-2">
            {hasSelection && (
              <div className="ui-surface-subtle px-3 py-2 text-[11px] text-neutral-700">
                Handoff package uses the current selection and the destination set above:
                <span className="ml-1 font-medium text-neutral-900">
                  {selectedIds.length} message{selectedIds.length === 1 ? '' : 's'} {'->'}{' '}
                  {targetOptions.find((option) => option.id === forwardTarget)?.label ?? 'No destination'}
                </span>
              </div>
            )}

            {showSaveSelection && (
              <div className="ui-surface-subtle flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[11px] text-neutral-700">
                <div>
                  Manual backup selection required. Choose the exact messages to save before
                  confirming the backup.
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="ui-pill border-transparent bg-white text-neutral-700">
                    {selectedIds.length} selected
                  </span>
                  <button
                    className="ui-button min-h-7 px-3 text-[11px] text-neutral-700 disabled:cursor-not-allowed disabled:opacity-45"
                    onClick={() => setShowSaveModal(true)}
                    disabled={selectedIds.length === 0}
                  >
                    Save Selected
                  </button>
                  <button
                    className="ui-button min-h-7 px-3 text-[11px] text-neutral-700"
                    onClick={() => {
                      dispatch({
                        type: 'CLEAR_SELECTION',
                        agent,
                        selectionScope: resolvedSelectionScope,
                      });
                      setShowSaveSelection(false);
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {contextItems.length > 0 && (
              <div className="ui-surface-subtle px-3 py-2 text-[11px] text-neutral-700">
                <div className="font-medium text-neutral-800">
                  Context ready: {contextItems.length} item{contextItems.length === 1 ? '' : 's'}
                </div>
                <div className="mt-1 truncate text-neutral-500">
                  {contextItems.slice(0, 2).map((item) => item.label).join(' | ')}
                  {contextItems.length > 2 ? ` | +${contextItems.length - 2} more` : ''}
                </div>
              </div>
            )}

            {hasSelection && !showSaveSelection && (
              <button
                className="mt-1 text-[11px] text-neutral-500 underline-offset-2 hover:underline"
                onClick={() =>
                  dispatch({
                    type: 'CLEAR_SELECTION',
                    agent,
                    selectionScope: resolvedSelectionScope,
                  })
                }
              >
                Clear selection
              </button>
            )}
          </div>
        )}
      </div>

      {showRefreshAction && (
        <div
          className={`ui-chat-actions-section shrink-0 px-3 pb-2 pt-0 ${
            isManager ? 'ui-manager-section' : 'ui-worker-section'
          }`}
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
              title="Create an operational checkpoint of the current workspace state"
            >
              Save Version
            </button>
            <button
              className={`ui-button px-3 text-xs ${
                hasSelection || showSaveSelection ? 'ui-button-primary text-white' : 'text-neutral-700'
              }`}
              onClick={openSaveBackup}
              title="Save the selected messages"
            >
              {hasSelection ? `Save Selection${selectedIds.length > 1 ? ` (${selectedIds.length})` : ''}` : 'Save Selection'}
            </button>
            {auditSourcePage ? (
              <button
                className="ui-button ui-button-primary px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-45"
                onClick={handleAuditAnswer}
                disabled={documentLocked || selectedMessages.length === 0}
                title="Send the selected content to Cross Verification"
              >
                Audit AI Answer
              </button>
            ) : (
              <div className="ui-chat-audit-slot">Audit AI Answer</div>
            )}
          </div>
        </div>
      )}

      {showRefreshConfirm && (
        <Modal title="Refresh session" onClose={() => setShowRefreshConfirm(false)}>
          <p className="mb-4 text-sm text-neutral-600">
            Reset this session to seed content or clear the chat entirely.
          </p>
          <div className="flex justify-end gap-2">
            <button
              className="ui-button text-neutral-700"
              onClick={() => setShowRefreshConfirm(false)}
            >
              Cancel
            </button>
            <button
              className="ui-button text-neutral-700"
              onClick={() => {
                dispatch({ type: 'RESET_CHAT', agent, panelScope: resolvedPanelScope });
                dispatch({ type: 'CLEAR_SELECTION', agent, selectionScope: resolvedSelectionScope });
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
                dispatch({ type: 'CLEAR_CHAT', agent, panelScope: resolvedPanelScope });
                dispatch({ type: 'CLEAR_SELECTION', agent, selectionScope: resolvedSelectionScope });
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
        projectLabel={state.projects.find((project) => project.id === projectId)?.name ?? projectId}
        sourceLabel={getAgentLabel(agent)}
        saveTimestamp={saveTimestamp}
        onSave={handleSave}
      />

      <ContextUploadModal
        open={showContextModal}
        onClose={() => setShowContextModal(false)}
        onSelect={(items) => {
          setContextItems(items);
          setToast(`Context loaded from ${items.length} selected item(s).`);
        }}
      />

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}
