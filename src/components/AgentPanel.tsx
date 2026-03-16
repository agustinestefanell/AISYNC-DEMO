import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useApp } from '../context';
import type { AgentRole, FileType, Message } from '../types';
import { ContextUploadModal, type ContextUploadItem } from './ContextUploadModal';
import { Modal } from './Modal';
import { SaveBackupModal } from './SaveBackupModal';
import { Toast } from './Toast';

const MODEL_LABELS: Record<AgentRole, string> = {
  manager: 'Gemini',
  worker1: 'Claude',
  worker2: 'GPT-5',
};

const PANEL_NAMES: Record<AgentRole, string> = {
  manager: 'PROJECT MANAGER',
  worker1: 'Worker 1',
  worker2: 'Worker 2',
};

const FORWARD_DEFAULTS: Record<AgentRole, AgentRole> = {
  manager: 'worker1',
  worker1: 'worker2',
  worker2: 'manager',
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

  return `FORWARDED FROM ${sourceLabel}\n\n${body}`;
}

export interface AgentPanelProps {
  agent: AgentRole;
  showSaveAction?: boolean;
  showRefreshAction?: boolean;
  editableRole?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function AgentPanel({
  agent,
  showRefreshAction = true,
  editableRole = false,
  className,
  style,
}: AgentPanelProps) {
  const { state, dispatch, saveFile } = useApp();
  const messages = state.messages[agent];
  const selectedIds = state.selectedMessages[agent];
  const draft = state.drafts[agent];
  const viewportRef = useRef<HTMLDivElement>(null);
  const isManager = agent === 'manager';

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
  const [forwardTarget, setForwardTarget] = useState<AgentRole>(FORWARD_DEFAULTS[agent]);
  const [fileTitle, setFileTitle] = useState('');
  const [fileType, setFileType] = useState<FileType>('Conversation');
  const [projectId, setProjectId] = useState(state.projects[0]?.id ?? '');
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));

  const targetOptions = useMemo(
    () =>
      (['manager', 'worker1', 'worker2'] as AgentRole[]).filter(
        (option) => option !== agent,
      ),
    [agent],
  );
  const selectedMessages = useMemo(
    () => messages.filter((message) => selectedIds.includes(message.id)),
    [messages, selectedIds],
  );

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
      setEventDate(new Date().toISOString().slice(0, 10));
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

  const headerLabel = useMemo(() => {
    if (agent === 'manager') {
      return `${PANEL_NAMES.manager} | ${MODEL_LABELS.manager}`;
    }

    const roleValue = state.workerRoles[agent] || '';
    return `${PANEL_NAMES[agent]} - ${roleValue} | ${MODEL_LABELS[agent]} | (Click to set this role)`;
  }, [agent, state.workerRoles]);

  const sendMessage = () => {
    if (!draft.trim()) {
      return;
    }

    dispatch({
      type: 'ADD_MESSAGE',
      agent,
      message: {
        id: createMessageId(),
        role: 'user',
        content: draft.trim(),
        timestamp: getNowTime(),
        agent,
        senderLabel: 'User',
      },
    });
    dispatch({ type: 'SET_DRAFT', agent, value: '' });

    window.setTimeout(() => {
      const replyBank = STUB_REPLIES[agent];
      const reply = replyBank[Math.floor(Math.random() * replyBank.length)];
      dispatch({
        type: 'ADD_MESSAGE',
        agent,
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
    if (selectedIds.length === 0) {
      setToast('Select messages to forward first.');
      return;
    }

    const orderedMessages = messages.filter((message) => selectedIds.includes(message.id));
    const sourceLabel = getAgentLabel(agent).toUpperCase();
    const forwardedContent = buildForwardedContent(orderedMessages, sourceLabel);

    dispatch({
      type: 'ADD_MESSAGE',
      agent: forwardTarget,
      message: {
        id: createMessageId(),
        role: 'system',
        content: forwardedContent,
        timestamp: getNowTime(),
        agent: forwardTarget,
        senderLabel: 'System',
        variant: 'forwarded',
      },
    });
    dispatch({ type: 'CLEAR_SELECTION', agent });
    setToast(`Forwarded ${orderedMessages.length} message(s) to ${getAgentLabel(forwardTarget)}.`);
  };

  const handleSave = () => {
    if (selectedMessages.length === 0) {
      setToast('Select the messages you want to back up first.');
      return;
    }

    saveFile({
      agent,
      content: buildSaveContent(selectedMessages),
      title: fileTitle.trim() || `Session_${agent}_${new Date().toISOString().slice(0, 10)}`,
      type: fileType,
      projectId,
      date: eventDate,
    });
    dispatch({ type: 'CLEAR_SELECTION', agent });
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

    setShowSaveModal(true);
  };

  const openPromptsLibrary = () => {
    dispatch({ type: 'SET_PAGE', page: 'E' });
  };

  return (
    <div
      data-agent-panel={agent}
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden border-r last:border-r-0 ${
        isManager
          ? 'ui-manager-panel'
          : 'border-r-neutral-200 bg-white'
      } ${className ?? ''}`}
      style={style}
    >
      <div
        className={`ui-chat-panel-header px-3 py-2 ${
          isManager
            ? 'ui-manager-header'
            : 'ui-worker-header'
        }`}
      >
        <div className="ui-chat-panel-header-row flex flex-wrap items-center gap-2">
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
              className={`ui-chat-panel-title flex-1 text-left text-[11px] font-semibold tracking-[0.12em] ${
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

          <button className="ui-chat-prompt shrink-0" onClick={openPromptsLibrary}>
            + Prompts
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={`ui-chat-viewport scrollbar-thin flex-1 overflow-y-auto px-3 py-3 ${
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
                  <button
                    className={`mt-1 h-4 w-4 rounded border transition-colors ${
                      isSelected
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
                        : 'border-neutral-300 bg-white hover:border-neutral-500'
                    }`}
                    onClick={() =>
                      dispatch({
                        type: 'TOGGLE_SELECT_MESSAGE',
                        agent,
                        messageId: message.id,
                      })
                    }
                  >
                    <span className="sr-only">Select message</span>
                  </button>
                )}

                <button
                  className={`max-w-[88%] text-left ${isUser ? 'order-1' : ''}`}
                  onClick={() =>
                    dispatch({
                      type: 'TOGGLE_SELECT_MESSAGE',
                      agent,
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
                    onClick={() =>
                      dispatch({
                        type: 'TOGGLE_SELECT_MESSAGE',
                        agent,
                        messageId: message.id,
                      })
                    }
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
        className={`ui-chat-composer-section shrink-0 px-3 pb-2 pt-1 ${
          isManager ? 'ui-manager-section' : 'ui-worker-section'
        }`}
      >
        <div className="ui-chat-composer">
          <input
            className="ui-chat-composer-input"
            placeholder={`Message ${MODEL_LABELS[agent]}...`}
            value={draft}
            onChange={(event) =>
              dispatch({ type: 'SET_DRAFT', agent, value: event.target.value })
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
          />
          <button
            className="ui-button ui-button-primary ui-chat-send text-xs text-white"
            onClick={sendMessage}
          >
            Send
          </button>
        </div>
      </div>

      <div
        className={`ui-chat-forward-section shrink-0 px-3 pb-2 pt-1 ${
          isManager ? 'ui-manager-section' : 'ui-worker-section-soft'
        }`}
      >
        <div className="ui-forward-row">
          <span className="ui-meta shrink-0 text-[11px]">Select messages to forward</span>

          <div className="ui-forward-select-wrap">
            <select
              className="ui-forward-select"
              value={forwardTarget}
              onChange={(event) => setForwardTarget(event.target.value as AgentRole)}
            >
              {targetOptions.map((option) => (
                <option key={option} value={option}>
                  {getAgentLabel(option)}
                </option>
              ))}
            </select>
            <span className="ui-forward-select-caret">v</span>
          </div>

          <button
            className="ui-button px-3 text-xs text-neutral-700 disabled:cursor-not-allowed disabled:opacity-45"
            onClick={handleForward}
            title="Forward selected messages"
            disabled={selectedIds.length === 0}
          >
            Send
          </button>
        </div>

        {(showSaveSelection || selectedIds.length > 0 || contextItems.length > 0) && (
          <div className="mt-2 grid gap-2">
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
                      dispatch({ type: 'CLEAR_SELECTION', agent });
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

            {selectedIds.length > 0 && !showSaveSelection && (
              <button
                className="mt-1 text-[11px] text-neutral-500 underline-offset-2 hover:underline"
                onClick={() => dispatch({ type: 'CLEAR_SELECTION', agent })}
              >
                Clear selection
              </button>
            )}
          </div>
        )}
      </div>

      {showRefreshAction && (
        <div
          className={`ui-chat-actions-section shrink-0 px-3 pb-3 pt-1 ${
            isManager ? 'ui-manager-section' : 'ui-worker-section'
          }`}
        >
          <div className="ui-chat-actions-grid grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              className="ui-button px-3 text-xs text-neutral-700"
              onClick={() => setShowRefreshConfirm(true)}
            >
              Refresh Session
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
              className="ui-button px-3 text-xs text-neutral-700"
              onClick={() => setShowContextModal(true)}
            >
              Upload Context
            </button>
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
                dispatch({ type: 'RESET_CHAT', agent });
                dispatch({ type: 'CLEAR_SELECTION', agent });
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
                dispatch({ type: 'CLEAR_CHAT', agent });
                dispatch({ type: 'CLEAR_SELECTION', agent });
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
