import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Modal } from '../components/Modal';
import { MessageSelectionToggle } from '../components/MessageSelectionToggle';
import { SaveBackupModal } from '../components/SaveBackupModal';
import { Toast } from '../components/Toast';
import { DividerRail } from '../components/DividerRail';
import {
  buildCrossVerificationSubManagerRoutingTarget,
  buildGeneralManagerRoutingTarget,
  buildTeamSubManagerRoutingTarget,
  buildTeamWorkerRoutingTarget,
} from '../auditRouting';
import { useApp } from '../context';
import {
  appendMessageToTeamManagerThread,
  appendMessageToTeamWorker,
  clearCrossVerificationSessionState,
  getCrossVerificationSessionState,
  getWorkspaceThreadState,
  saveCrossVerificationSessionState,
  setSecondaryWorkspaceFocusThread,
  setWorkspaceThreadState,
  TEAM_MANAGER_THREAD_ID,
  type RoutedWorkspaceMessage,
} from '../crossVerificationRouting';
import {
  getCrossVerificationLaunchIdFromLocation,
  readCrossVerificationLaunch,
} from '../crossVerificationLaunch';
import { CROSS_VERIFICATION_TEAM_ID, getTeamTheme } from '../data/teams';
import { getPageLabel } from '../pageLabels';
import {
  getCrossVerificationForwardTargets,
  isValidAuditRoutingTargetForReviewForward,
} from '../reviewForwardPolicy';
import type {
  AuditAnswerPayload,
  AuditAnswerRoutingTarget,
  FileType,
  Message,
} from '../types';

type VerificationStage = 'ready' | 'verifying' | 'verified';
type WorkspacePanelId = 'manager' | 'worker_a' | 'worker_b';

interface WorkerDefinition {
  id: WorkspacePanelId;
  label: string;
  model: string;
  accent: string;
  soft: string;
}

interface WorkerResult {
  id: WorkspacePanelId;
  summary: string;
  points: string[];
  uncertainty: string;
}

interface ManagerResult {
  overview: string;
  agreements: string[];
  differences: string[];
  finalSynthesis: string;
  nextStep: string;
}

interface ChosenWorkerAnswer {
  workerId: WorkspacePanelId;
  workerLabel: string;
  model: string;
  selectedAt: string;
  summary: string;
  points: string[];
  uncertainty: string;
}

interface ChooseAnswerDestinationState {
  answer: ChosenWorkerAnswer;
  result: WorkerResult;
  definition: WorkerDefinition;
}

interface CrossVerificationCaseOrigin {
  sourceAgentId: string;
  sourceAgentLabel: string;
  sourceAgentType: AuditAnswerPayload['sourceAgentType'];
  sourceTeamId: string;
  sourceTeamLabel: string;
}

interface CrossVerificationPersistedState {
  contextSignature: string;
  activePanel: WorkspacePanelId;
  verificationStage: VerificationStage;
  verificationRequest: string;
  caseOrigin: CrossVerificationCaseOrigin | null;
  caseReturnTargets: AuditAnswerRoutingTarget[];
  workerResults: Record<WorkspacePanelId, WorkerResult | null>;
  managerResult: ManagerResult | null;
  chosenWorkerAnswer: ChosenWorkerAnswer | null;
  lastVerifiedInput: string;
  lastVerifiedAt: string;
}

const WORKER_DEFINITIONS: WorkerDefinition[] = [
  {
    id: 'worker_a',
    label: 'Worker A',
    model: 'Claude',
    accent: 'var(--color-role-worker1-accent)',
    soft: 'var(--color-role-worker1-soft)',
  },
  {
    id: 'worker_b',
    label: 'Worker B',
    model: 'GPT-5',
    accent: 'var(--color-role-worker2-accent)',
    soft: 'var(--color-role-worker2-soft)',
  },
];

const DEMO_SEED_TEAM_ID = 'team_legal';
const DEMO_SEED_TEAM_LABEL = 'SM-Legal';
const DEMO_SEED_WORKER_ID = `${DEMO_SEED_TEAM_ID}_worker_1`;
const DEMO_SEED_BRIEF =
  'Should this client-facing legal summary be sent as-is, or does it require revision before forwarding?';
const DEMO_SEED_VERIFIED_AT = '09:14';

function getNowTime() {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function summarizeClaim(input: string) {
  const normalized = input.trim().replace(/\s+/g, ' ');
  if (normalized.length <= 118) {
    return normalized;
  }

  return `${normalized.slice(0, 115)}...`;
}

function getOriginWorkspaceLabel(payload: AuditAnswerPayload) {
  if (
    payload.sourceArea === 'main-workspace' &&
    payload.sourceAgentType === 'general-manager'
  ) {
    return 'Main Workspace';
  }

  if (payload.sourceArea === 'main-workspace' && payload.sourceAgentType === 'sub-manager') {
    return `Secondary Page | ${payload.sourceTeamLabel}`;
  }

  if (payload.sourceArea === 'main-workspace') {
    return 'Main Workspace | Worker Lane';
  }

  return payload.sourceWorkspace?.label
    ? `Team Workspace | ${payload.sourceWorkspace.label}`
    : `Team Workspace | ${payload.sourceTeamLabel}`;
}

function getOriginSectionLabel(payload: AuditAnswerPayload) {
  if (payload.sourcePage === 'F' && payload.sourceWorkspace?.label) {
    return `Secondary Workspace | ${payload.sourceWorkspace.label}`;
  }

  if (payload.sourceAgentType === 'sub-manager' && payload.sourcePage !== 'F') {
    return `Sub-Manager | ${getPageLabel(payload.sourcePage)}`;
  }

  if (payload.sourceAgentType === 'worker' && payload.sourcePage === 'A') {
    return 'Main Workspace | Worker Thread';
  }

  return getPageLabel(payload.sourcePage);
}

function getOriginContextSummary({
  originAgentLabel,
  originWorkspaceLabel,
  originSectionLabel,
  inputModeLabel,
}: {
  originAgentLabel: string;
  originWorkspaceLabel: string;
  originSectionLabel: string;
  inputModeLabel: string;
}) {
  return `Audit context loaded from ${originAgentLabel}. Workspace: ${originWorkspaceLabel}. Section: ${originSectionLabel}. Input mode: ${inputModeLabel}. Run Verify to compare both workers, then use the sub-manager thread for follow-up questions, review, forward, or backup.`;
}

function buildVerificationResults(input: string, payload: AuditAnswerPayload | null) {
  const claim = summarizeClaim(input);
  const originAgent = payload?.sourceAgentLabel ?? 'the current user brief';
  const originTeam = payload?.sourceTeamLabel ?? 'Cross Verification';

  const workerResults: WorkerResult[] = [
    {
      id: 'worker_a',
      summary: `Treats "${claim}" conservatively and checks whether the wording can be defended without overstating confidence.`,
      points: [
        `Preserve the source wording from ${originAgent} before drawing a final conclusion.`,
        'Separate direct observations from assumptions introduced during interpretation.',
        'Prefer the narrowest defensible reading before expanding scope.',
      ],
      uncertainty:
        'Still needs external confirmation for the factual edge cases and any unstated dependencies.',
    },
    {
      id: 'worker_b',
      summary: `Reads "${claim}" against adjacent assumptions and tests where the answer might shift if context or timeframe changes.`,
      points: [
        `Checks whether ${originTeam} context hides missing constraints or alternate interpretations.`,
        'Flags where agreement could be superficial rather than evidence-based.',
        'Surfaces edge cases that would require explicit follow-up before closure.',
      ],
      uncertainty:
        'Confidence remains conditional until the claim is checked against a source outside the current chat.',
    },
  ];

  const managerResult: ManagerResult = {
    overview:
      'Both workers treat the claim as reviewable, not final, and preserve uncertainty instead of forcing early consensus.',
    agreements: [
      'Both workers keep the source wording stable before synthesizing.',
      'Both workers require external verification before treating the answer as closed.',
      'Both workers agree that the final response should preserve visible uncertainty for human review.',
    ],
    differences: [
      'Worker A stays closer to the narrow claim as written, while Worker B widens the scope to adjacent assumptions.',
      'Worker A optimizes for defensibility, while Worker B optimizes for edge-case discovery.',
    ],
    finalSynthesis: `Current synthesis: "${claim}" should remain in review until the supporting evidence is checked externally. The safest final answer is a constrained summary that preserves divergence, documents uncertainty, and avoids treating consensus alone as proof.`,
    nextStep:
      'Human review should verify the key factual dependency externally, then confirm whether the narrower or broader reading is the correct one to close.',
  };

  return { workerResults, managerResult };
}

function createCrossVerificationMessage(
  role: Message['role'],
  senderLabel: string,
  content: string,
  variant: Message['variant'] = 'standard',
): Message {
  return {
    id: `cv_msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    timestamp: getNowTime(),
    agent: 'manager',
    senderLabel,
    ...(variant === 'standard' ? {} : { variant }),
  };
}

function buildEmptyWorkerResults(): Record<WorkspacePanelId, WorkerResult | null> {
  return {
    manager: null,
    worker_a: null,
    worker_b: null,
  };
}

function toWorkspaceMessages(messages: Message[]): RoutedWorkspaceMessage[] {
  return messages.map(({ id, role, content, timestamp, senderLabel, variant }) => ({
    id,
    role,
    content,
    timestamp,
    senderLabel,
    variant,
  }));
}

function toManagerMessages(messages: RoutedWorkspaceMessage[]): Message[] {
  return messages.map((message) => ({
    ...message,
    agent: 'manager' as const,
  }));
}

function buildManagerSeedMessages({
  hasPayload,
  brief,
  originWorkspaceLabel,
  originSectionLabel,
  originAgentLabel,
  inputModeLabel,
}: {
  hasPayload: boolean;
  brief: string;
  originWorkspaceLabel: string;
  originSectionLabel: string;
  originAgentLabel: string;
  inputModeLabel: string;
}) {
  const messages = [
    createCrossVerificationMessage(
      'system',
      'System',
      hasPayload
        ? getOriginContextSummary({
            originAgentLabel,
            originWorkspaceLabel,
            originSectionLabel,
            inputModeLabel,
          })
        : 'Cross Verification is ready. Enter a verification brief, run Verify to compare both workers, and use the sub-manager thread for follow-up questions or final routing.',
    ),
  ];

  if (brief.trim()) {
    messages.push(
      createCrossVerificationMessage(
        'user',
        hasPayload ? originAgentLabel : 'User',
        brief.trim(),
      ),
    );
  }

  return messages;
}

function buildSaveContent(messages: Message[]) {
  return messages
    .map((message) => `${message.senderLabel}: ${message.content}`)
    .join('\n\n');
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

function buildForwardedContent(messages: Message[], targetLabel: string) {
  const body = messages
    .map((message) => `${message.senderLabel}: ${message.content.trim()}`)
    .join('\n\n');

  return `REVIEWED & FORWARDED TO ${targetLabel.toUpperCase()}\n\n${body}`;
}

function buildSubManagerReply(
  input: string,
  managerResult: ManagerResult | null,
  chosenWorkerAnswer: ChosenWorkerAnswer | null,
) {
  const summarizedInput = summarizeClaim(input);

  if (managerResult && chosenWorkerAnswer) {
    return `Using the chosen ${chosenWorkerAnswer.workerLabel} answer plus the current synthesis, the safest response to "${summarizedInput}" is to keep the claim constrained, preserve uncertainty, and verify the key external dependency before closure.`;
  }

  if (managerResult) {
    return `Based on the current verification synthesis, "${summarizedInput}" should stay in review until the supporting evidence is checked externally. I can keep refining the final wording from here.`;
  }

  if (chosenWorkerAnswer) {
    return `The chosen ${chosenWorkerAnswer.workerLabel} answer is already loaded into the sub-manager. I can keep working from that reference, but run Verify if you need the full comparison refreshed.`;
  }

  return 'I can continue the Cross Verification thread, but run Verify first if you want both workers compared on the current brief.';
}

function getLatestUserBrief(messages: Message[]) {
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'user');

  return latestUserMessage?.content.trim() ?? '';
}

function buildDemoSeedScenario() {
  const workerResults: WorkerResult[] = [
    {
      id: 'worker_a',
      summary:
        'The legal summary is directionally useful, but it is not safe for direct client forwarding as-is. Key caveats are compressed too aggressively and the current wording could be misread as a final legal position rather than an internal draft.',
      points: [
        'The summary drops qualifying language around jurisdiction and exception handling.',
        'Several sentences read as settled advice instead of review-stage guidance.',
        'Client-facing use should wait until the review disclaimer and missing caveats are restored.',
      ],
      uncertainty:
        'Still depends on whether the underlying legal memo actually supports the stronger wording now shown in the draft.',
    },
    {
      id: 'worker_b',
      summary:
        'The draft is usable as a working base if it is explicitly treated as a reviewed draft, not as a final legal summary. Most issues look fixable through targeted edits rather than a full rewrite.',
      points: [
        'The structure and sequencing are already serviceable for a client-facing note.',
        'Absolute claims should be replaced with narrower, conditional phrasing before forwarding.',
        'A short review note plus two legal caveats would likely make the summary operationally usable.',
      ],
      uncertainty:
        'Operationally viable only if the recipient understands this as a reviewed draft and not a final legal sign-off.',
    },
  ];

  const managerResult: ManagerResult = {
    overview:
      'Both workers agree the legal summary has value, but neither treats it as ready for direct external forwarding without review.',
    agreements: [
      'The summary is usable as a draft rather than a discard-and-rewrite case.',
      'Forwarding should wait until the missing review language and caveats are restored.',
      'Human review remains necessary before the summary leaves the current operating circuit.',
    ],
    differences: [
      'Worker A is compliance-first and focuses on legal risk if the draft is read as final advice.',
      'Worker B is execution-first and argues the draft can move forward after targeted revisions.',
    ],
    finalSynthesis:
      'Current synthesis: the legal summary is usable as a draft, but it is not ready for direct forwarding without review. Recommended next action: revise the summary to restore legal caveats and review status, then route the reviewed version back through the originating legal circuit for confirmation.',
    nextStep:
      'Return the revised draft to SM-Legal for a final human review pass before any client-facing distribution.',
  };

  return {
    brief: DEMO_SEED_BRIEF,
    verifiedAt: DEMO_SEED_VERIFIED_AT,
    workerResults,
    managerResult,
    managerMessages: [
      createCrossVerificationMessage(
        'system',
        'System',
        'Demo case loaded from SM-Legal. Cross Verification is comparing whether a client-facing legal summary can be forwarded as-is or requires revision first.',
      ),
      createCrossVerificationMessage('user', 'SM-Legal', DEMO_SEED_BRIEF),
      createCrossVerificationMessage(
        'agent',
        'Sub-Manager',
        'Initial consolidation: the summary is usable as a draft, but it is not ready for direct forwarding without review. Worker A is stricter on legal exposure, while Worker B supports controlled reuse after targeted revision.',
      ),
    ],
  };
}

function dedupeRoutingTargets(targets: Array<AuditAnswerRoutingTarget | null | undefined>) {
  const seen = new Set<string>();

  return targets.filter((target): target is AuditAnswerRoutingTarget => {
    if (!target || seen.has(target.id)) {
      return false;
    }

    seen.add(target.id);
    return true;
  });
}

function buildInboundForwardMessage(messages: Message[]) {
  const body = messages
    .map((message) => `${message.senderLabel}: ${message.content.trim()}`)
    .join('\n\n');

  return `REVIEWED & FORWARDED FROM CROSS VERIFICATION SUB-MANAGER\n\n${body}`;
}

function buildChosenAnswerContent(answer: ChosenWorkerAnswer) {
  return `CHOSEN ANSWER FROM ${answer.workerLabel.toUpperCase()} | ${answer.model}\n\n${answer.summary}\n\nKey points:\n- ${answer.points.join('\n- ')}\n\nUncertainty: ${answer.uncertainty}`;
}

function createCrossVerificationRoutingMessage(
  content: string,
  variant: Message['variant'] = 'forwarded',
) {
  return createCrossVerificationMessage('system', 'System', content, variant);
}

function toRoutedWorkspaceMessage(message: Message): RoutedWorkspaceMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
    senderLabel: message.senderLabel,
    variant: message.variant,
  };
}

function getRoutingTargetOptionLabel(target: AuditAnswerRoutingTarget) {
  if (target.kind === 'worker') {
    return `Return to ${target.label}`;
  }

  if (target.kind === 'sub-manager') {
    return target.label;
  }

  if (target.kind === 'general-manager') {
    return target.label;
  }

  return target.label;
}

function buildCaseReturnTargets(targets: Array<AuditAnswerRoutingTarget | null | undefined>) {
  return dedupeRoutingTargets(targets);
}

function buildCaseOrigin(
  payload: AuditAnswerPayload | null,
  isSeedMode: boolean,
): CrossVerificationCaseOrigin | null {
  if (payload) {
    return {
      sourceAgentId: payload.sourceAgentId,
      sourceAgentLabel: payload.sourceAgentLabel,
      sourceAgentType: payload.sourceAgentType,
      sourceTeamId: payload.sourceTeamId,
      sourceTeamLabel: payload.sourceTeamLabel,
    };
  }

  if (isSeedMode) {
    return {
      sourceAgentId: DEMO_SEED_WORKER_ID,
      sourceAgentLabel: 'W-LC01',
      sourceAgentType: 'worker',
      sourceTeamId: DEMO_SEED_TEAM_ID,
      sourceTeamLabel: DEMO_SEED_TEAM_LABEL,
    };
  }

  return null;
}

function getChooseTargetButtonLabel(target: AuditAnswerRoutingTarget) {
  if (target.kind === 'sub-manager' && target.sourceArea === 'cross-verification') {
    return 'Send to Cross Verification Sub-Manager';
  }

  if (target.kind === 'worker') {
    return `Send to ${target.label}`;
  }

  if (target.kind === 'sub-manager') {
    return `Send to ${target.label}`;
  }

  return `Send to ${target.label}`;
}

function ManagerPanel({
  managerMessages,
  selectedMessageIds,
  chatDraft,
  onChatDraftChange,
  onSendMessage,
  forwardTarget,
  forwardOptions,
  onForwardTargetChange,
  onForward,
  onCreateHandoff,
  onToggleSelectMessage,
  onClearSelection,
  onOpenRefresh,
  onOpenSaveBackup,
  showSaveSelection,
  onVerify,
  canVerify,
  verificationStage,
  managerResult,
  lastVerifiedAt,
  hasPayload,
  hasStaleResult,
  isDetachedLaunch,
  originWorkspaceLabel,
  originSectionLabel,
  originAgentLabel,
  inputModeLabel,
  chosenWorkerAnswer,
  style,
}: {
  managerMessages: Message[];
  selectedMessageIds: string[];
  chatDraft: string;
  onChatDraftChange: (value: string) => void;
  onSendMessage: () => void;
  forwardTarget: string;
  forwardOptions: Array<{ id: string; label: string }>;
  onForwardTargetChange: (value: string) => void;
  onForward: () => void;
  onCreateHandoff: () => void;
  onToggleSelectMessage: (messageId: string) => void;
  onClearSelection: () => void;
  onOpenRefresh: () => void;
  onOpenSaveBackup: () => void;
  showSaveSelection: boolean;
  onVerify: () => void;
  canVerify: boolean;
  verificationStage: VerificationStage;
  managerResult: ManagerResult | null;
  lastVerifiedAt: string;
  hasPayload: boolean;
  hasStaleResult: boolean;
  isDetachedLaunch: boolean;
  originWorkspaceLabel: string;
  originSectionLabel: string;
  originAgentLabel: string;
  inputModeLabel: string;
  chosenWorkerAnswer: ChosenWorkerAnswer | null;
  style?: CSSProperties;
}) {
  const verifyLabel = verificationStage === 'verifying' ? 'Verifying...' : 'Verify';
  const hasSelection = selectedMessageIds.length > 0;
  const managerStatus =
    verificationStage === 'verifying'
      ? 'Cross Verification is dispatching the same brief to both workers.'
      : managerResult
        ? hasStaleResult
          ? 'The brief changed after the last run. Verify again to refresh the comparison.'
          : `Verified at ${lastVerifiedAt}. The sub-manager is holding the final synthesis.`
        : 'Sub-manager is the only final output channel for this workflow.';

  return (
    <div
      className="ui-role-panel ui-role-panel-manager flex min-h-0 min-w-0 flex-col overflow-hidden border-r last:border-r-0"
      style={style}
    >
      <div className="ui-chat-panel-header ui-manager-header px-3 py-2">
        <div className="ui-chat-panel-header-row flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span
              aria-hidden="true"
              className="ui-role-dot"
              style={{
                backgroundColor: 'var(--color-role-manager-accent)',
                boxShadow: '0 0 0 4px var(--color-role-manager-soft)',
              }}
            />
            <div className="min-w-0 text-left text-[11px] font-semibold tracking-[0.12em] text-neutral-900">
              CROSS VERIFICATION SUB-MANAGER | Gemini
            </div>
          </div>
          <span className="ui-pill border-transparent bg-neutral-900 text-white">Final Output</span>
        </div>
      </div>

      <div className="shrink-0 px-3 pb-2 pt-2">
        <div className="ui-chat-tools-row">
          <span className="ui-chat-prompt">Verification Lead</span>
          <span className="ui-chat-prompt">{hasPayload ? 'Audit Context Loaded' : 'Direct Input'}</span>
          <span className="ui-chat-prompt">{isDetachedLaunch ? 'New Window' : 'In-App'}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-neutral-600">
          <span className="ui-pill border-transparent bg-white text-neutral-700">
            Workspace | {originWorkspaceLabel}
          </span>
          <span className="ui-pill border-transparent bg-white text-neutral-700">
            Section | {originSectionLabel}
          </span>
          <span className="ui-pill border-transparent bg-white text-neutral-700">
            Origin | {originAgentLabel}
          </span>
          <span className="ui-pill border-transparent bg-white text-neutral-700">
            {inputModeLabel}
          </span>
        </div>
      </div>

      <div className="ui-chat-viewport scrollbar-thin flex-1 overflow-y-auto px-3 py-3" style={{ minHeight: 0 }}>
        <div className="grid gap-3">
          {chosenWorkerAnswer && (
            <div className="ui-surface-subtle px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  Chosen Worker Answer
                </div>
                <span className="ui-pill border-transparent bg-white text-neutral-700">
                  {chosenWorkerAnswer.workerLabel} | {chosenWorkerAnswer.model}
                </span>
              </div>
              <div className="mt-2 text-sm leading-6 text-neutral-800">
                {chosenWorkerAnswer.summary}
              </div>
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-neutral-800">
                {chosenWorkerAnswer.points.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
              <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                Why It Was Chosen
              </div>
              <div className="mt-2 text-sm leading-6 text-neutral-800">
                Selected at {chosenWorkerAnswer.selectedAt}. This worker output is now loaded in the
                sub-manager as the chosen answer reference for final synthesis and follow-up.
              </div>
            </div>
          )}

          <div className="ui-surface-subtle px-3 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
              Verification Status
            </div>
            <div className="mt-2 text-sm leading-6 text-neutral-800">{managerStatus}</div>
          </div>

          {managerResult && (
            <div className="ui-surface-subtle px-3 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                Final Synthesis
              </div>
              <div className="mt-2 text-sm leading-6 text-neutral-800">{managerResult.overview}</div>

              <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                Agreements
              </div>
              <ul className="mt-2 grid gap-2 text-sm leading-6 text-neutral-800">
                {managerResult.agreements.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>

              <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                Differences
              </div>
              <ul className="mt-2 grid gap-2 text-sm leading-6 text-neutral-800">
                {managerResult.differences.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>

              <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                User-Facing Answer
              </div>
              <div className="mt-2 text-sm leading-6 text-neutral-800">
                {managerResult.finalSynthesis}
              </div>

              <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                Human Review Note
              </div>
              <div className="mt-2 text-sm leading-6 text-neutral-800">{managerResult.nextStep}</div>
            </div>
          )}

          <div className="ui-surface-subtle px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                Sub-Manager Thread
              </div>
              <span className="ui-pill border-transparent bg-white text-neutral-700">
                {hasSelection ? `${selectedMessageIds.length} selected` : 'Chat + Follow-up'}
              </span>
            </div>

            <div className="mt-3 ui-chat-message-list flex flex-col gap-3">
              {managerMessages.length === 0 ? (
                <div className="rounded-lg border border-dashed border-neutral-200 bg-white px-3 py-4 text-sm text-neutral-500">
                  No sub-manager messages yet. Send a follow-up or run Verify to populate the thread.
                </div>
              ) : (
                managerMessages.map((message) => {
                  const isSelected = selectedMessageIds.includes(message.id);
                  const isUser = message.role === 'user';
                  const isForwarded = message.variant === 'forwarded';
                  const isAgent = message.role === 'agent';

                  return (
                    <div
                      key={message.id}
                      className={`ui-chat-message-row group flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isUser && (
                        <MessageSelectionToggle
                          selected={isSelected}
                          onClick={() => onToggleSelectMessage(message.id)}
                        />
                      )}

                      <button
                        className={`max-w-[88%] text-left ${isUser ? 'order-1' : ''}`}
                        onClick={() => onToggleSelectMessage(message.id)}
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
                                : isAgent
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
                          onClick={() => onToggleSelectMessage(message.id)}
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="ui-chat-composer-section shrink-0 px-3 pb-2 pt-1 ui-manager-section">
        <div className="ui-chat-composer">
          <input
            className="ui-chat-composer-input"
            placeholder="Message Sub-Manager or paste the brief to verify..."
            value={chatDraft}
            onChange={(event) => onChatDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                onSendMessage();
              }
            }}
          />
          <button
            className="ui-button ui-button-primary ui-chat-send ui-chat-action-button text-xs text-white"
            onClick={onSendMessage}
          >
            Send
          </button>
        </div>
        <div className="mt-2 text-[11px] text-neutral-500">
          {hasStaleResult
            ? 'The latest user brief changed after the last comparison.'
            : 'Verify runs on the latest user brief in this thread or on the current composer text.'}
        </div>
      </div>

      <div className="ui-chat-forward-section shrink-0 px-3 pb-2 pt-1 ui-manager-section">
        <div className="ui-forward-stack">
          <span className="ui-meta shrink-0 text-[11px]">Review selection</span>

          <div className="ui-forward-row">
            <div className="ui-forward-select-wrap">
              <select
                className="ui-forward-select"
                value={forwardTarget}
                onChange={(event) => onForwardTargetChange(event.target.value)}
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
              onClick={onForward}
              title="Review and forward selected messages"
              disabled={!hasSelection || forwardOptions.length === 0}
            >
              Review & Forward
            </button>
          </div>
          <button
            className="ui-button ui-button-primary ui-chat-action-button px-3 text-xs text-white disabled:cursor-not-allowed disabled:opacity-45"
            onClick={onCreateHandoff}
            title="Create a formal handoff package from the selected messages and destination above"
            disabled={!hasSelection || forwardOptions.length === 0}
          >
            Create Handoff Package
          </button>
        </div>

        {(showSaveSelection || hasSelection) && (
          <div className="mt-2 grid gap-2">
            {hasSelection && (
              <div className="ui-surface-subtle px-3 py-2 text-[11px] text-neutral-700">
                Handoff package uses the current selection and the destination set above:
                <span className="ml-1 font-medium text-neutral-900">
                  {selectedMessageIds.length} message{selectedMessageIds.length === 1 ? '' : 's'} {'->'}{' '}
                  {forwardOptions.find((option) => option.id === forwardTarget)?.label ?? 'No destination'}
                </span>
              </div>
            )}

            {showSaveSelection && (
              <div className="ui-surface-subtle flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[11px] text-neutral-700">
                <div>
                  Manual backup selection required. Choose the exact sub-manager messages to save before confirming the backup.
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="ui-pill border-transparent bg-white text-neutral-700">
                    {selectedMessageIds.length} selected
                  </span>
                  <button
                    className="ui-button min-h-7 px-3 text-[11px] text-neutral-700 disabled:cursor-not-allowed disabled:opacity-45"
                    onClick={onOpenSaveBackup}
                    disabled={!hasSelection}
                  >
                    Save Selected
                  </button>
                  <button
                    className="ui-button min-h-7 px-3 text-[11px] text-neutral-700"
                    onClick={onClearSelection}
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {hasSelection && !showSaveSelection && (
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

      <div className="ui-chat-actions-section shrink-0 px-3 pb-3 pt-1 ui-manager-section">
        <div className="ui-chat-actions-grid grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            className="ui-button px-3 text-xs text-neutral-700"
            onClick={onOpenRefresh}
          >
            Refresh Session
          </button>
          <button
            className={`ui-button px-3 text-xs ${
              hasSelection || showSaveSelection ? 'ui-button-primary text-white' : 'text-neutral-700'
            }`}
            onClick={onOpenSaveBackup}
            title="Save the selected messages"
          >
            {hasSelection ? `Save Selection${selectedMessageIds.length > 1 ? ` (${selectedMessageIds.length})` : ''}` : 'Save Selection'}
          </button>
          <button
            className="ui-button ui-button-primary px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-45"
            onClick={onVerify}
            disabled={!canVerify || verificationStage === 'verifying'}
            title="Run Cross Verification on the current brief"
          >
            {verifyLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function WorkerPanel({
  definition,
  theme,
  verificationStage,
  result,
  onChooseAnswer,
  style,
}: {
  definition: WorkerDefinition;
  theme: { ribbon: string; soft: string; border: string; accent: string };
  verificationStage: VerificationStage;
  result: WorkerResult | null;
  onChooseAnswer: (result: WorkerResult, definition: WorkerDefinition) => void;
  style?: CSSProperties;
}) {
  const helperText =
    verificationStage === 'verifying'
      ? 'Running an independent comparison lane for the current brief.'
      : result
        ? 'Automatic lane completed. Output is visible for comparison only.'
        : 'This lane stays automatic. The manager triggers verification and collects the result.';

  return (
    <div
      data-team-panel={definition.id}
      className="flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-neutral-200 bg-white last:border-r-0"
      style={{ ...style, borderTopColor: theme.ribbon, borderTopWidth: 2 }}
    >
      <div
        className="ui-chat-panel-header ui-team-panel-header px-3 py-2"
        style={{ backgroundColor: theme.soft, color: theme.accent }}
      >
        <div className="ui-chat-panel-header-row flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 text-left text-[11px] font-semibold tracking-[0.12em]">
            <div className="truncate uppercase tracking-[0.16em] text-[10px] opacity-70">
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="ui-role-dot"
                  style={{
                    backgroundColor: definition.accent,
                    boxShadow: `0 0 0 4px ${definition.soft}`,
                  }}
                />
                <span>Cross Verification</span>
              </span>
            </div>
            <div className="truncate text-[11px] font-semibold text-neutral-900">
              {definition.label} | {definition.model}
            </div>
          </div>
          <span
            className="ui-pill border-transparent text-white"
            style={{ backgroundColor: definition.accent }}
          >
            Auto
          </span>
        </div>
      </div>

      <div className="shrink-0 px-3 pb-2 pt-2">
        <div className="ui-chat-tools-row">
          <span className="ui-chat-prompt">Independent Lane</span>
          <span className="ui-chat-prompt">User Controls Disabled</span>
        </div>
      </div>

      <div className="ui-chat-viewport scrollbar-thin flex-1 overflow-y-auto px-3 py-3" style={{ minHeight: 0 }}>
        <div className="grid gap-3">
          <div className="ui-surface-subtle px-3 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
              Lane Status
            </div>
            <div className="mt-2 text-sm leading-6 text-neutral-800">{helperText}</div>
          </div>

          {result ? (
            <div className="ui-surface-subtle px-3 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                Independent Response
              </div>
              <div className="mt-2 text-sm leading-6 text-neutral-800">{result.summary}</div>

              <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                Key Points
              </div>
              <ul className="mt-2 grid gap-2 text-sm leading-6 text-neutral-800">
                {result.points.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>

              <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                Uncertainty
              </div>
              <div className="mt-2 text-sm leading-6 text-neutral-800">{result.uncertainty}</div>
            </div>
          ) : (
            <div className="ui-surface-subtle px-3 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                Waiting For Verify
              </div>
              <div className="mt-2 text-sm leading-6 text-neutral-800">
                The worker stays visible for transparency, but only updates when the manager runs
                the verification pass.
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 px-3 pb-3 pt-1">
        <button
          className="ui-button w-full px-3 text-[11px] font-semibold uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-45"
          style={{
            borderColor: definition.accent,
            color: definition.accent,
          }}
          onClick={() => result && onChooseAnswer(result, definition)}
          disabled={!result}
        >
          CHOOSE THIS ANSWER
        </button>
      </div>
    </div>
  );
}

export function PageG() {
  const { state, dispatch, saveSelection, createHandoff } = useApp();
  const payload = state.auditAnswerPayload;
  const draft = state.crossVerificationDraft;
  const theme = useMemo(() => getTeamTheme(CROSS_VERIFICATION_TEAM_ID), []);
  const launchId = useMemo(getCrossVerificationLaunchIdFromLocation, []);
  const isDetachedLaunch = Boolean(launchId);
  const [launchHydrated, setLaunchHydrated] = useState(false);
  const [activePanel, setActivePanel] = useState<WorkspacePanelId>('manager');
  const [verificationStage, setVerificationStage] = useState<VerificationStage>('ready');
  const [verificationRequest, setVerificationRequest] = useState('');
  const [workerResults, setWorkerResults] = useState<Record<WorkspacePanelId, WorkerResult | null>>(
    buildEmptyWorkerResults,
  );
  const [managerResult, setManagerResult] = useState<ManagerResult | null>(null);
  const [chosenWorkerAnswer, setChosenWorkerAnswer] = useState<ChosenWorkerAnswer | null>(null);
  const [caseReturnTargets, setCaseReturnTargets] = useState<AuditAnswerRoutingTarget[]>([]);
  const [lastVerifiedInput, setLastVerifiedInput] = useState('');
  const [lastVerifiedAt, setLastVerifiedAt] = useState('');
  const [managerMessages, setManagerMessages] = useState<Message[]>([]);
  const [selectedManagerIds, setSelectedManagerIds] = useState<string[]>([]);
  const [managerChatDraft, setManagerChatDraft] = useState('');
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);
  const [showSaveSelection, setShowSaveSelection] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [toast, setToast] = useState('');
  const [forwardTarget, setForwardTarget] = useState('');
  const [chooseDestinationState, setChooseDestinationState] = useState<ChooseAnswerDestinationState | null>(null);
  const [fileTitle, setFileTitle] = useState('');
  const [fileType] = useState<FileType>('Conversation');
  const [projectId, setProjectId] = useState(state.projects[0]?.id ?? '');
  const [saveTimestamp, setSaveTimestamp] = useState(new Date().toISOString());
  const [hydratedContextSignature, setHydratedContextSignature] = useState('');
  const demoSeed = useMemo(buildDemoSeedScenario, []);

  useEffect(() => {
    if (!launchId || launchHydrated) {
      return;
    }

    const launch = readCrossVerificationLaunch(launchId);
    if (launch?.payload) {
      dispatch({ type: 'OPEN_CROSS_VERIFICATION_ROUTE', payload: launch.payload });
    }

    setLaunchHydrated(true);
  }, [dispatch, launchHydrated, launchId]);

  const hasPayload = Boolean(payload);
  const isSeedMode = !hasPayload && (!isDetachedLaunch || launchHydrated);
  const demoWorkspaceTarget = useMemo(
    () => ({
      teamId: DEMO_SEED_TEAM_ID,
      label: DEMO_SEED_TEAM_LABEL,
      color: getTeamTheme(DEMO_SEED_TEAM_ID).ribbon,
      nodeId: `${DEMO_SEED_TEAM_ID}_sm`,
      nodeType: 'senior_manager' as const,
      rootNodeId: `${DEMO_SEED_TEAM_ID}_sm`,
      focusNodeId: `${DEMO_SEED_TEAM_ID}_sm`,
    }),
    [],
  );
  const demoOriginTargets = useMemo(
    () =>
      ({
        sourceReturnTarget: buildTeamWorkerRoutingTarget({
          page: 'F',
          teamId: DEMO_SEED_TEAM_ID,
          teamLabel: DEMO_SEED_TEAM_LABEL,
          workspace: demoWorkspaceTarget,
          workerId: DEMO_SEED_WORKER_ID,
          workerLabel: 'W-LC01',
        }),
        sourcePrimarySubManagerTarget: buildTeamSubManagerRoutingTarget({
          page: 'F',
          teamId: DEMO_SEED_TEAM_ID,
          teamLabel: DEMO_SEED_TEAM_LABEL,
          workspace: demoWorkspaceTarget,
          label: 'SM-Legal Sub-Manager',
        }),
        sourceGeneralManagerTarget: buildGeneralManagerRoutingTarget('A'),
      }),
    [demoWorkspaceTarget],
  );
  const initialCaseReturnTargets = useMemo(
    () =>
      buildCaseReturnTargets([
        payload?.sourceReturnTarget ?? (isSeedMode ? demoOriginTargets.sourceReturnTarget : null),
        payload?.sourcePrimarySubManagerTarget ??
          (isSeedMode ? demoOriginTargets.sourcePrimarySubManagerTarget : null),
      ]),
    [demoOriginTargets, isSeedMode, payload],
  );
  const initialCaseOrigin = useMemo(
    () => buildCaseOrigin(payload, isSeedMode),
    [isSeedMode, payload],
  );
  const originWorkspaceLabel = payload
    ? getOriginWorkspaceLabel(payload)
    : isSeedMode
      ? `Team Workspace | ${DEMO_SEED_TEAM_LABEL}`
      : 'Direct navigation';
  const originSectionLabel = payload
    ? getOriginSectionLabel(payload)
    : isSeedMode
      ? `Secondary Workspace | ${DEMO_SEED_TEAM_LABEL}`
      : 'Cross Verification';
  const originAgentLabel = payload?.sourceAgentLabel ?? (isSeedMode ? 'W-LC01' : 'Direct launch');
  const inputModeLabel = payload
    ? `${payload.selectedCount} selected item(s)`
    : isSeedMode
      ? 'Demo seed'
      : 'Manual brief';
  const seedBrief = payload?.content ?? (isSeedMode ? demoSeed.brief : '');
  const hasStaleResult =
    Boolean(managerResult) && lastVerifiedInput.trim() !== draft.trim();
  const panelWidth = 'calc((100% - 32px) / 3)';
  const workspaceTabs: Array<{ id: WorkspacePanelId; label: string; mobileLabel: string }> = [
    { id: 'manager', label: 'Sub-Manager', mobileLabel: 'SM' },
    { id: 'worker_a', label: 'Worker A', mobileLabel: 'A' },
    { id: 'worker_b', label: 'Worker B', mobileLabel: 'B' },
  ];

  const managerForwardTargets = useMemo(
    () => getCrossVerificationForwardTargets(payload, caseReturnTargets),
    [caseReturnTargets, payload],
  );

  const chooseAnswerTargets = useMemo(
    () =>
      dedupeRoutingTargets([
        buildCrossVerificationSubManagerRoutingTarget(),
        ...caseReturnTargets,
      ]),
    [caseReturnTargets],
  );

  const managerSeedMessages = useMemo(
    () =>
      buildManagerSeedMessages({
        hasPayload,
        brief: seedBrief,
        originWorkspaceLabel,
        originSectionLabel,
        originAgentLabel,
        inputModeLabel,
      }),
    [hasPayload, inputModeLabel, originAgentLabel, originSectionLabel, originWorkspaceLabel, seedBrief],
  );

  const selectedManagerMessages = useMemo(
    () => managerMessages.filter((message) => selectedManagerIds.includes(message.id)),
    [managerMessages, selectedManagerIds],
  );
  const verificationSourceText = useMemo(
    () => managerChatDraft.trim() || getLatestUserBrief(managerMessages) || draft.trim(),
    [draft, managerChatDraft, managerMessages],
  );

  const contextSignature = useMemo(
    () =>
      payload
        ? JSON.stringify({
            sourceAgentId: payload.sourceAgentId,
            sourceTeamId: payload.sourceTeamId,
            messageIds: payload.messageIds,
            content: payload.content,
          })
        : isSeedMode
          ? 'demo-seed'
          : isDetachedLaunch
            ? 'detached-manual'
            : 'manual',
    [isDetachedLaunch, isSeedMode, payload],
  );

  useEffect(() => {
    if (launchId && !launchHydrated) {
      return;
    }

    const persistedState = getCrossVerificationSessionState<CrossVerificationPersistedState | null>(null);
    const persistedThread = getWorkspaceThreadState(CROSS_VERIFICATION_TEAM_ID, TEAM_MANAGER_THREAD_ID);
    const persistedMatchesContext = persistedState?.contextSignature === contextSignature;

    if (persistedMatchesContext) {
      const hydratedMessages =
        persistedThread.messages.length > 0
          ? toManagerMessages(persistedThread.messages)
          : isSeedMode
            ? demoSeed.managerMessages
            : managerSeedMessages;
      const nextDraft =
        persistedState?.lastVerifiedInput ||
        getLatestUserBrief(hydratedMessages) ||
        seedBrief;

      setActivePanel(persistedState?.activePanel ?? 'manager');
      setVerificationStage(persistedState?.verificationStage ?? 'ready');
      setVerificationRequest(persistedState?.verificationRequest ?? '');
      setCaseReturnTargets(persistedState?.caseReturnTargets ?? initialCaseReturnTargets);
      setWorkerResults(persistedState?.workerResults ?? buildEmptyWorkerResults());
      setManagerResult(persistedState?.managerResult ?? null);
      setChosenWorkerAnswer(persistedState?.chosenWorkerAnswer ?? null);
      setLastVerifiedInput(persistedState?.lastVerifiedInput ?? '');
      setLastVerifiedAt(persistedState?.lastVerifiedAt ?? '');
      setManagerMessages(hydratedMessages);
      setSelectedManagerIds(persistedThread.selectedIds);
      setManagerChatDraft(persistedThread.draft);
      setShowSaveSelection(false);
      setShowSaveModal(false);
      setChooseDestinationState(null);

      if (nextDraft !== draft) {
        dispatch({ type: 'SET_CROSS_VERIFICATION_DRAFT', value: nextDraft });
      }

      setHydratedContextSignature(contextSignature);
      return;
    }

    const initialMessages = isSeedMode ? demoSeed.managerMessages : managerSeedMessages;
    const initialWorkerResults = isSeedMode
      ? {
          manager: null,
          worker_a: demoSeed.workerResults.find((result) => result.id === 'worker_a') ?? null,
          worker_b: demoSeed.workerResults.find((result) => result.id === 'worker_b') ?? null,
        }
      : buildEmptyWorkerResults();
    const initialManagerResult = isSeedMode ? demoSeed.managerResult : null;
    const initialVerificationStage = isSeedMode ? 'verified' : 'ready';
    const initialVerificationRequest = isSeedMode ? demoSeed.brief : '';
    const initialLastVerifiedInput = isSeedMode ? demoSeed.brief : '';
    const initialLastVerifiedAt = isSeedMode ? demoSeed.verifiedAt : '';
    const initialDraft = isSeedMode ? demoSeed.brief : seedBrief;

    setActivePanel('manager');
    setVerificationStage(initialVerificationStage);
    setVerificationRequest(initialVerificationRequest);
    setCaseReturnTargets(initialCaseReturnTargets);
    setWorkerResults(initialWorkerResults);
    setManagerResult(initialManagerResult);
    setChosenWorkerAnswer(null);
    setLastVerifiedInput(initialLastVerifiedInput);
    setLastVerifiedAt(initialLastVerifiedAt);
    setManagerMessages(initialMessages);
    setSelectedManagerIds([]);
    setManagerChatDraft('');
    setShowSaveSelection(false);
    setShowSaveModal(false);
    setChooseDestinationState(null);
    setWorkspaceThreadState(CROSS_VERIFICATION_TEAM_ID, TEAM_MANAGER_THREAD_ID, {
      ...persistedThread,
      messages: toWorkspaceMessages(initialMessages),
      selectedIds: [],
      draft: '',
    });
    saveCrossVerificationSessionState<CrossVerificationPersistedState>({
      contextSignature,
      activePanel: 'manager',
      verificationStage: initialVerificationStage,
      verificationRequest: initialVerificationRequest,
      caseOrigin: initialCaseOrigin,
      caseReturnTargets: initialCaseReturnTargets,
      workerResults: initialWorkerResults,
      managerResult: initialManagerResult,
      chosenWorkerAnswer: null,
      lastVerifiedInput: initialLastVerifiedInput,
      lastVerifiedAt: initialLastVerifiedAt,
    });
    dispatch({ type: 'SET_CROSS_VERIFICATION_DRAFT', value: initialDraft });
    setHydratedContextSignature(contextSignature);
  }, [
    contextSignature,
    demoSeed,
    dispatch,
    isSeedMode,
    launchHydrated,
    launchId,
    initialCaseOrigin,
    initialCaseReturnTargets,
    managerSeedMessages,
    seedBrief,
  ]);

  useEffect(() => {
    if (showSaveModal) {
      setProjectId((current) => current || state.projects[0]?.id || '');
      setSaveTimestamp(new Date().toISOString());
      setFileTitle(`CrossVerification_SubManager_${new Date().toISOString().slice(0, 10)}`);
    }
  }, [showSaveModal, state.projects]);

  useEffect(() => {
    if (showSaveModal && selectedManagerMessages.length === 0) {
      setShowSaveModal(false);
    }
  }, [selectedManagerMessages.length, showSaveModal]);

  useEffect(() => {
    if (!managerForwardTargets.some((target) => target.id === forwardTarget)) {
      setForwardTarget(managerForwardTargets[0]?.id ?? '');
    }
  }, [forwardTarget, managerForwardTargets]);

  useEffect(() => {
    if (hydratedContextSignature !== contextSignature) {
      return;
    }

    const currentThread = getWorkspaceThreadState(CROSS_VERIFICATION_TEAM_ID, TEAM_MANAGER_THREAD_ID);
    setWorkspaceThreadState(CROSS_VERIFICATION_TEAM_ID, TEAM_MANAGER_THREAD_ID, {
      ...currentThread,
      messages: toWorkspaceMessages(managerMessages),
      selectedIds: selectedManagerIds,
      draft: managerChatDraft,
    });
    saveCrossVerificationSessionState<CrossVerificationPersistedState>({
      contextSignature,
      activePanel,
      verificationStage,
      verificationRequest,
      caseOrigin: initialCaseOrigin,
      caseReturnTargets,
      workerResults,
      managerResult,
      chosenWorkerAnswer,
      lastVerifiedInput,
      lastVerifiedAt,
    });
  }, [
    activePanel,
    caseReturnTargets,
    chosenWorkerAnswer,
    contextSignature,
    initialCaseOrigin,
    lastVerifiedAt,
    lastVerifiedInput,
    managerChatDraft,
    managerMessages,
    managerResult,
    selectedManagerIds,
    hydratedContextSignature,
    verificationRequest,
    verificationStage,
    workerResults,
  ]);

  useEffect(() => {
    if (verificationStage !== 'verifying' || !verificationRequest.trim()) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const nextResults = buildVerificationResults(verificationRequest, payload);

      setWorkerResults({
        manager: null,
        worker_a: nextResults.workerResults.find((result) => result.id === 'worker_a') ?? null,
        worker_b: nextResults.workerResults.find((result) => result.id === 'worker_b') ?? null,
      });
      setManagerResult(nextResults.managerResult);
      setLastVerifiedInput(verificationRequest);
      setLastVerifiedAt(getNowTime());
      setManagerMessages((current) => [
        ...current,
        createCrossVerificationMessage(
          'agent',
          'Sub-Manager',
          `Verification synthesis ready.\n\n${nextResults.managerResult.finalSynthesis}\n\nHuman review note: ${nextResults.managerResult.nextStep}`,
        ),
      ]);
      setVerificationStage('verified');
      setActivePanel('manager');
    }, 780);

    return () => window.clearTimeout(timeoutId);
  }, [payload, verificationRequest, verificationStage]);

  const handleVerify = () => {
    const normalizedDraft = verificationSourceText.trim();
    if (!normalizedDraft) {
      return;
    }

    if (managerChatDraft.trim()) {
      setManagerMessages((current) => [
        ...current,
        createCrossVerificationMessage('user', 'User', normalizedDraft),
      ]);
      setManagerChatDraft('');
    }

    dispatch({ type: 'SET_CROSS_VERIFICATION_DRAFT', value: normalizedDraft });
    setChosenWorkerAnswer(null);
    setChooseDestinationState(null);
    setShowSaveSelection(false);
    setVerificationRequest(normalizedDraft);
    setVerificationStage('verifying');
  };

  const resetWorkspace = () => {
    dispatch(
      hasPayload
        ? { type: 'CLEAR_CROSS_VERIFICATION_CONTEXT' }
        : { type: 'SET_CROSS_VERIFICATION_DRAFT', value: '' },
    );
    setShowRefreshConfirm(false);
    setShowSaveSelection(false);
    setShowSaveModal(false);
    setChooseDestinationState(null);
    setActivePanel('manager');

    if (!hasPayload) {
      clearCrossVerificationSessionState();
      setWorkspaceThreadState(CROSS_VERIFICATION_TEAM_ID, TEAM_MANAGER_THREAD_ID, {
        messages: [],
        selectedIds: [],
        draft: '',
      });
    }
  };

  const returnToSource = () => {
    if (!payload) {
      dispatch({ type: 'SET_PAGE', page: 'A' });
      return;
    }

    if (payload.sourceWorkspace) {
      dispatch({
        type: 'SET_SECONDARY_WORKSPACE',
        workspace: payload.sourceWorkspace,
      });
    }

    dispatch({ type: 'SET_PAGE', page: payload.sourcePage });
  };

  const handleSecondaryAction = () => {
    if (isDetachedLaunch) {
      window.close();
      return;
    }

    returnToSource();
  };

  const handleToggleManagerSelection = (messageId: string) => {
    setSelectedManagerIds((current) =>
      current.includes(messageId)
        ? current.filter((id) => id !== messageId)
        : [...current, messageId],
    );
  };

  const handleClearManagerSelection = () => {
    setSelectedManagerIds([]);
    setShowSaveSelection(false);
  };

  const handleSendMessage = () => {
    const normalizedDraft = managerChatDraft.trim();
    if (!normalizedDraft) {
      return;
    }

    dispatch({ type: 'SET_CROSS_VERIFICATION_DRAFT', value: normalizedDraft });
    setManagerMessages((current) => [
      ...current,
      createCrossVerificationMessage('user', 'User', normalizedDraft),
    ]);
    setManagerChatDraft('');

    window.setTimeout(() => {
      setManagerMessages((current) => [
        ...current,
        createCrossVerificationMessage(
          'agent',
          'Sub-Manager',
          buildSubManagerReply(normalizedDraft, managerResult, chosenWorkerAnswer),
        ),
      ]);
    }, 620);
  };

  const routeMessageToTarget = (
    target: AuditAnswerRoutingTarget,
    message: Message,
    mode: 'review-forward' | 'choose-answer' = 'choose-answer',
  ) => {
    if (
      mode === 'review-forward' &&
      !isValidAuditRoutingTargetForReviewForward('cross-verification-sub-manager', target)
    ) {
      return false;
    }

    if (target.kind === 'sub-manager' && target.sourceArea === 'cross-verification') {
      setManagerMessages((current) => [...current, message]);
      setActivePanel('manager');
      return true;
    }

    if (
      target.kind === 'general-manager' &&
      target.sourceArea === 'main-workspace' &&
      target.agentRole
    ) {
      dispatch({
        type: 'ADD_MESSAGE',
        agent: target.agentRole,
        message: {
          ...message,
          agent: target.agentRole,
        },
      });
      return true;
    }

    if (target.kind === 'worker' && target.sourceArea === 'main-workspace' && target.agentRole) {
      dispatch({
        type: 'ADD_MESSAGE',
        agent: target.agentRole,
        message: {
          ...message,
          agent: target.agentRole,
        },
      });
      return true;
    }

    if (target.kind === 'worker' && target.sourceArea === 'team-workspace' && target.teamId && target.workerId) {
      appendMessageToTeamWorker(target.teamId, target.workerId, toRoutedWorkspaceMessage(message));
      setSecondaryWorkspaceFocusThread(target.teamId, target.workerId);
      return true;
    }

    if (target.kind === 'sub-manager' && target.sourceArea === 'team-workspace' && target.teamId) {
      appendMessageToTeamManagerThread(target.teamId, toRoutedWorkspaceMessage(message));
      setSecondaryWorkspaceFocusThread(target.teamId, TEAM_MANAGER_THREAD_ID);
      return true;
    }

    return false;
  };

  const handleForward = () => {
    if (selectedManagerMessages.length === 0) {
      setToast('Select sub-manager messages to review and forward first.');
      return;
    }

    const target =
      managerForwardTargets.find((candidate) => candidate.id === forwardTarget) ?? null;
    if (!target) {
      setToast('No contextual forward target is available for this verification.');
      return;
    }

    const didRoute = routeMessageToTarget(
      target,
      createCrossVerificationRoutingMessage(buildInboundForwardMessage(selectedManagerMessages)),
      'review-forward',
    );
    if (!didRoute) {
      setToast('That destination is blocked by the current review hierarchy.');
      return;
    }

    setManagerMessages((current) => [
      ...current,
      createCrossVerificationMessage(
        'system',
        'System',
        buildForwardedContent(selectedManagerMessages, getRoutingTargetOptionLabel(target)),
        'forwarded',
      ),
    ]);
    setSelectedManagerIds([]);
    setShowSaveSelection(false);
    dispatch({
      type: 'ADD_ACTIVITY_EVENT',
      event: {
        id: `activity_${Date.now()}`,
        eventType: 'review-forward',
        createdAt: new Date().toISOString(),
        actor: state.userName,
        sourceWorkspace: 'cross-verification',
        sourceTeamId: CROSS_VERIFICATION_TEAM_ID,
        sourceTeamLabel: 'Cross Verification',
        sourcePanelId: 'cross-verification-sub-manager',
        sourcePanelLabel: 'Cross Verification Sub-Manager',
        projectId: state.projects[0]?.id ?? 'project_1',
        relatedObjectId: null,
        detail: `Reviewed and forwarded ${selectedManagerMessages.length} message(s) to ${getRoutingTargetOptionLabel(target)}`,
        metadata: {
          destinationLabel: getRoutingTargetOptionLabel(target),
          selectedCount: selectedManagerMessages.length,
        },
      },
    });
    setToast(
      `Reviewed & forwarded ${selectedManagerMessages.length} message(s) to ${getRoutingTargetOptionLabel(target)}.`,
    );
  };

  const handleCreateHandoff = () => {
    if (selectedManagerMessages.length === 0) {
      setToast('Select sub-manager messages first to create a handoff package.');
      return;
    }

    const target =
      managerForwardTargets.find((candidate) => candidate.id === forwardTarget) ?? null;
    if (!target) {
      setToast('No contextual handoff destination is available for this verification.');
      return;
    }

    const project = state.projects.find((item) => item.id === projectId) ?? state.projects[0];
    const destination =
      target.kind === 'general-manager' && target.agentRole
        ? {
            workspace: 'main-workspace' as const,
            teamId: 'global',
            teamLabel: 'Main Workspace',
            panelId: `main-${target.agentRole}`,
            panelLabel: target.label,
          }
        : target.kind === 'worker' && target.sourceArea === 'main-workspace' && target.agentRole
          ? {
              workspace: 'main-workspace' as const,
              teamId: 'global',
              teamLabel: 'Main Workspace',
              panelId: `main-${target.agentRole}`,
              panelLabel: target.label,
            }
          : target.kind === 'worker' && target.sourceArea === 'team-workspace'
            ? {
                workspace: 'team-workspace' as const,
                teamId: target.teamId ?? null,
                teamLabel: target.teamLabel ?? target.label,
                panelId: target.workerId ?? target.id,
                panelLabel: target.label,
              }
            : target.kind === 'sub-manager' && target.sourceArea === 'team-workspace'
              ? {
                  workspace: 'team-workspace' as const,
                  teamId: target.teamId ?? null,
                  teamLabel: target.teamLabel ?? target.label,
                  panelId: target.teamId ? `${target.teamId}-sub-manager` : target.id,
                  panelLabel: target.label,
                }
              : {
                  workspace: 'cross-verification' as const,
                  teamId: CROSS_VERIFICATION_TEAM_ID,
                  teamLabel: 'Cross Verification',
                  panelId: 'cross-verification-sub-manager',
                  panelLabel: 'Cross Verification Sub-Manager',
                };

    createHandoff({
      title: `Handoff | Cross Verification Sub-Manager -> ${getRoutingTargetOptionLabel(target)}`,
      projectId: project?.id ?? projectId,
      sourceWorkspace: 'cross-verification',
      sourceTeamId: CROSS_VERIFICATION_TEAM_ID,
      sourceTeamLabel: 'Cross Verification',
      sourcePanelId: 'cross-verification-sub-manager',
      sourcePanelLabel: 'Cross Verification Sub-Manager',
      destinationWorkspace: destination.workspace,
      destinationTeamId: destination.teamId,
      destinationTeamLabel: destination.teamLabel,
      destinationPanelId: destination.panelId,
      destinationPanelLabel: destination.panelLabel,
      transferredMessages: selectedManagerMessages.map((message) => ({
        id: message.id,
        senderLabel: message.senderLabel,
        timestamp: message.timestamp,
        content: message.content,
      })),
      transferredContent: buildSaveContent(selectedManagerMessages),
      objective: `Transfer verified context from Cross Verification to ${getRoutingTargetOptionLabel(target)}.`,
      minimumContext: buildHandoffMinimumContext(selectedManagerMessages),
      riskNotes: managerResult
        ? ['Cross Verification synthesis should be reviewed before operational closure.']
        : [],
    });
    setSelectedManagerIds([]);
    setShowSaveSelection(false);
    setToast(`Handoff package created for ${getRoutingTargetOptionLabel(target)}.`);
  };

  const handleSave = () => {
    if (selectedManagerMessages.length === 0) {
      setToast('Select the sub-manager messages you want to back up first.');
      return;
    }

    saveSelection({
      agent: 'manager',
      content: buildSaveContent(selectedManagerMessages),
      title:
        fileTitle.trim() ||
        `CrossVerification_SubManager_${new Date().toISOString().slice(0, 10)}`,
      type: fileType,
      projectId,
      selectedMessages: selectedManagerMessages.map((message) => ({
        id: message.id,
        senderLabel: message.senderLabel,
        timestamp: message.timestamp,
        content: message.content,
      })),
      date: saveTimestamp.slice(0, 10),
      sourceLabel: 'Cross Verification | Sub-Manager',
      sourcePanelId: 'cross-verification-sub-manager',
      sourcePanelLabel: 'Cross Verification Sub-Manager',
    });
    setSelectedManagerIds([]);
    setShowSaveModal(false);
    setShowSaveSelection(false);
    setToast('Saved to Documentation Mode.');
  };

  const openSaveBackup = () => {
    setShowSaveSelection(true);

    if (selectedManagerMessages.length === 0) {
      setToast('Manual backup requires selecting sub-manager messages first.');
      return;
    }

    setSaveTimestamp(new Date().toISOString());
    setShowSaveModal(true);
  };

  const resetManagerSession = (mode: 'seed' | 'clear') => {
    setVerificationStage('ready');
    setVerificationRequest('');
    setWorkerResults(buildEmptyWorkerResults());
    setManagerResult(null);
    setChosenWorkerAnswer(null);
    setLastVerifiedInput('');
    setLastVerifiedAt('');
    setSelectedManagerIds([]);
    setManagerChatDraft('');
    setShowRefreshConfirm(false);
    setShowSaveSelection(false);
    setShowSaveModal(false);
    setChooseDestinationState(null);
    setActivePanel('manager');

    dispatch({
      type: 'SET_CROSS_VERIFICATION_DRAFT',
      value: hasPayload ? payload?.content ?? '' : '',
    });

    if (mode === 'seed') {
      setManagerMessages(managerSeedMessages);
      setSelectedManagerIds([]);
      setManagerChatDraft('');
      setToast('Sub-manager session restored.');
      return;
    }

    setManagerMessages([]);
    setToast('Sub-manager conversation cleared.');
  };

  const handleChooseAnswer = (result: WorkerResult, definition: WorkerDefinition) => {
    setChooseDestinationState({
      answer: {
        workerId: definition.id,
        workerLabel: definition.label,
        model: definition.model,
        selectedAt: getNowTime(),
        summary: result.summary,
        points: result.points,
        uncertainty: result.uncertainty,
      },
      result,
      definition,
    });
  };

  const handleChooseAnswerDestination = (target: AuditAnswerRoutingTarget) => {
    if (!chooseDestinationState) {
      return;
    }

    const chosenAnswer = {
      ...chooseDestinationState.answer,
      selectedAt: getNowTime(),
    };
    const answerContent = buildChosenAnswerContent(chosenAnswer);

    if (target.kind === 'sub-manager' && target.sourceArea === 'cross-verification') {
      setChosenWorkerAnswer(chosenAnswer);
      setManagerMessages((current) => [
        ...current,
        createCrossVerificationRoutingMessage(answerContent, 'standard'),
      ]);
      setActivePanel('manager');
      setToast(`${chosenAnswer.workerLabel} answer loaded into the Cross Verification Sub-Manager.`);
      setChooseDestinationState(null);
      return;
    }

    const didRoute = routeMessageToTarget(
      target,
      createCrossVerificationRoutingMessage(answerContent, 'standard'),
    );
    if (!didRoute) {
      setToast('That destination is currently unavailable.');
      return;
    }
    setToast(`${chosenAnswer.workerLabel} answer sent to ${getRoutingTargetOptionLabel(target)}.`);
    setChooseDestinationState(null);
  };

  const handleCancelChooseAnswer = () => {
    setChooseDestinationState(null);
  };

  const renderPanel = (panelId: WorkspacePanelId, style?: CSSProperties) => {
    if (panelId === 'manager') {
      return (
        <ManagerPanel
          managerMessages={managerMessages}
          selectedMessageIds={selectedManagerIds}
          chatDraft={managerChatDraft}
          onChatDraftChange={setManagerChatDraft}
          onSendMessage={handleSendMessage}
          forwardTarget={forwardTarget}
          forwardOptions={managerForwardTargets.map((target) => ({
            id: target.id,
            label: getRoutingTargetOptionLabel(target),
          }))}
          onForwardTargetChange={setForwardTarget}
          onForward={handleForward}
          onCreateHandoff={handleCreateHandoff}
          onToggleSelectMessage={handleToggleManagerSelection}
          onClearSelection={handleClearManagerSelection}
          onOpenRefresh={() => setShowRefreshConfirm(true)}
          onOpenSaveBackup={openSaveBackup}
          showSaveSelection={showSaveSelection}
          onVerify={handleVerify}
          canVerify={Boolean(verificationSourceText.trim())}
          verificationStage={verificationStage}
          managerResult={managerResult}
          lastVerifiedAt={lastVerifiedAt}
          hasPayload={hasPayload}
          hasStaleResult={hasStaleResult}
          isDetachedLaunch={isDetachedLaunch}
          originWorkspaceLabel={originWorkspaceLabel}
          originSectionLabel={originSectionLabel}
          originAgentLabel={originAgentLabel}
          inputModeLabel={inputModeLabel}
          chosenWorkerAnswer={chosenWorkerAnswer}
          style={style}
        />
      );
    }

    const definition = WORKER_DEFINITIONS.find((worker) => worker.id === panelId);
    if (!definition) {
      return null;
    }

    return (
      <WorkerPanel
        definition={definition}
        theme={theme}
        verificationStage={verificationStage}
        result={workerResults[panelId]}
        onChooseAnswer={handleChooseAnswer}
        style={style}
      />
    );
  };

  return (
    <div className="app-page-shell h-full min-h-0 min-w-0 overflow-hidden px-2 py-2 sm:px-3 sm:py-3">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col gap-2">
        <div className="ui-surface ui-workspace-tabs grid grid-cols-3 gap-1 p-1 lg:hidden">
          {workspaceTabs.map((tab) => (
            <button
              key={tab.id}
              className={`ui-workspace-tab min-h-10 min-w-0 rounded-[10px] px-2 text-xs font-medium ${
                activePanel === tab.id
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
              onClick={() => setActivePanel(tab.id)}
            >
              <span className="sm:hidden">{tab.mobileLabel}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="app-frame flex min-h-0 flex-1 overflow-hidden lg:hidden">
          {renderPanel(activePanel)}
        </div>

        <div className="app-frame hidden min-h-0 flex-1 overflow-hidden lg:flex">
          {renderPanel('manager', { width: panelWidth })}
          <DividerRail />
          {renderPanel('worker_a', { width: panelWidth })}
          <DividerRail />
          {renderPanel('worker_b', { width: panelWidth })}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="ui-button text-neutral-700"
            onClick={handleSecondaryAction}
          >
            {isDetachedLaunch ? 'Close Window' : hasPayload ? 'Return to Source' : 'Go to Main Workspace'}
          </button>
          <button
            className="ui-button text-neutral-700"
            onClick={resetWorkspace}
          >
            {hasPayload ? 'Clear Verification Context' : 'Reset Verification'}
          </button>
        </div>

        {showRefreshConfirm && (
          <Modal title="Refresh session" onClose={() => setShowRefreshConfirm(false)}>
            <p className="mb-4 text-sm text-neutral-600">
              Reset the sub-manager thread to its verification seed or clear the conversation entirely.
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
                onClick={() => resetManagerSession('seed')}
              >
                Reset to seed
              </button>
              <button
                className="ui-button ui-button-primary text-white"
                onClick={() => resetManagerSession('clear')}
              >
                Clear all
              </button>
            </div>
          </Modal>
        )}

        <SaveBackupModal
          open={showSaveModal}
          onClose={() => setShowSaveModal(false)}
          selectedMessages={selectedManagerMessages}
          fileTitle={fileTitle}
          onFileTitleChange={setFileTitle}
          projectLabel={state.projects.find((project) => project.id === projectId)?.name ?? projectId}
          sourceLabel="Cross Verification | Sub-Manager"
          saveTimestamp={saveTimestamp}
          onSave={handleSave}
        />

        {chooseDestinationState && (
          <Modal
            title="Choose answer destination"
            onClose={handleCancelChooseAnswer}
            width="max-w-md"
          >
            <div className="grid gap-3">
              <div className="ui-surface-subtle px-3 py-3 text-sm leading-6 text-neutral-700">
                Decide where this worker answer should go next. The current worker lanes stay automatic; only the destination changes.
              </div>

              <div className="grid gap-2">
                {chooseAnswerTargets.map((target) => (
                  <button
                    key={target.id}
                    className="ui-button justify-start px-3 py-3 text-left text-sm text-neutral-700"
                    onClick={() => handleChooseAnswerDestination(target)}
                  >
                    {getChooseTargetButtonLabel(target)}
                  </button>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button className="ui-button text-neutral-700" onClick={handleCancelChooseAnswer}>
                  Cancel
                </button>
              </div>
            </div>
          </Modal>
        )}

        {toast && <Toast message={toast} onClose={() => setToast('')} />}
      </div>
    </div>
  );
}
