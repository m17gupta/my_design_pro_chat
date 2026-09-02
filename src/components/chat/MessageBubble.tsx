'use client'

import { memo, useEffect, useRef, useState, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

import { renderInline } from './formatText'

import LunaAvatar from './LunaAvatar'
import OptionButtons from './OptionButtons'
import QuestionCard, { type CardResult } from './QuestionCard'
import AdditionalImagesUploadCard from './AdditionalImagesUploadCard'
import UserAnswerBubble from './UserAnswerBubble'
import { CHECKLIST, type ChecklistItem, type Message, type AnswerValue } from './types'
import RevisionDesign from '../revisionDesign/RevisionDesign'
import type { SubmitAction } from '../revisionDesign/RevisionResultCard'
import { useSelector } from 'react-redux'
import { RootState } from '@/store'
import { selectTypingConfig, type TypingConfig } from '@/store/settings/settingsSlice'
import DesignSummaryCard from './MainDesign/DesignSummaryCard'
import DesignGeneratingCard from './MainDesign/DesignGeneratingCard'
import DesignResultCard from './MainDesign/DesignResultCard'
import { useLineByLineTypewriter } from './useLineByLineTypewriter'

interface MessageBubbleProps {
  message: Message
  workType?: string
  /** Uploads per field index for question-card messages. */
  filesByField?: Record<number, File[]>
  disabled?: boolean
  initialAnswer?: AnswerValue
  selectedValue?: string
  onOption?: (value: string) => void
  onCardSubmit?: (result: CardResult) => void
  onCardCancel?: () => void
  /** Recorded answers for the design-summary rows. */
  answers?: Record<string, string>
  /** Checklist rows shown in the design summary — work-type aware (default landscape). */
  checklist?: ChecklistItem[] | null
  /** True while the brief POST to the design API is in flight. */
  generating?: boolean
  uploadTotal?: number
  onSummaryGenerate?: () => void
  onSummaryChanges?: () => void
  /** True for the post-revision summary message — renders the Revision Summary card. */
  isRevisionSummary?: boolean
  /** Backend task lifecycle (queued | processing) for the loader status text. */
  designStatus?: string
  onDesignAllINeed?: () => void
  onDesignRegenerate?: () => void
  onDesignEngage?: () => void
  /** Revision loop — per-round wiring for `ep-revision-summary[-N]` messages. */
  isCurrentRevision?: boolean
  /** Fallback comments (notes + files) until this round's entry exists. */
  revisionNotes?: string
  revisionFiles?: string[]
  /** Satisfaction rating for this round's entry (0 = unrated). */
  revisionRating?: number
  onRevisionRate?: (value: number) => void
  /** Set once a terminal action was submitted — locks every result card. */
  submittedAction?: SubmitAction | null
  /** True while the engage designer host action is pending */
  isEngagingDesigner?: boolean
  /** True while this round's generate POST is in flight (entry not appended yet). */
  revisionPendingGenerate?: boolean
  /** True when the round cap is reached — disables Regenerate on the result card. */
  revisionRegenerateDisabled?: boolean
  onRevisionGenerate?: () => void
  onRevisionMakeChanges?: () => void
  onRevisionAllINeed?: (rating: number) => void
  onRevisionRegenerate?: () => void
  onRevisionEngage?: (rating: number) => void
  /** User-message inline editing. */
  editing?: boolean
  onEditStart?: () => void
  onEditSave?: (text: string) => void
  onEditCancel?: () => void
  /** Yes/No options for option-question episodes (photos/files) — renders buttons instead of a textarea while editing. */
  editOptions?: string[]

  answerImageUrls?: string[]
  apiKey?: string
  editingNextMessage?: boolean
  onOptionEditSave?: (text: string) => void
}

/**
 * Character-level human-like typewriter.
 *
 * Speed model per character:
 *  • Whitespace / punctuation chars → 12–18 ms (burst)
 *  • Normal character               → 18–30 ms
 *  • After sentence end (. ! ?)     → extra 150–350 ms pause
 *  • After comma / semicolon        → extra 60–120 ms pause
 *  • 5% random "thinking" burst     → extra 80–200 ms anywhere
 *  • ±30% jitter on every interval
 *
 * Returns { typed: string, isTyping: boolean }
 */
function useCharTypewriter(
  text: string,
  enabled: boolean,
  reduceMotion: boolean,
  typingConfig: TypingConfig
): { typed: string; isTyping: boolean } {
  // Track whether this instance already completed a typewriter pass for `text`.
  // If it did, we never replay — even if the component re-mounts due to key change.
  const alreadyTypedRef = useRef(false)

  // Initialise to full text if animation is disabled OR if the text is empty.
  const initialTyped = reduceMotion || !enabled ? text : ''
  const [typed, setTyped] = useState(initialTyped)
  const [isTyping, setIsTyping] = useState(enabled && !reduceMotion && text.length > 0)
  const timeoutRef = useRef<number | null>(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false

    if (!enabled || reduceMotion) {
      setTyped(text)
      setIsTyping(false)
      alreadyTypedRef.current = true
      return
    }

    // If we already finished typing this exact text, show it immediately
    // without re-animating (handles re-renders / StrictMode double-invoke).
    if (alreadyTypedRef.current) {
      setTyped(text)
      setIsTyping(false)
      return
    }

    setTyped('')
    setIsTyping(text.length > 0)

    let charIdx = 0
    let acc = ''

    function computeDelay(char: string, prevChar: string): number {
      const isBurst = /[\s!?,.:;—–•*]/.test(char)
      let delay = isBurst
        ? typingConfig.charBurstMin + Math.random() * (typingConfig.charBurstMax - typingConfig.charBurstMin)
        : typingConfig.charNormalMin + Math.random() * (typingConfig.charNormalMax - typingConfig.charNormalMin)

      // Sentence-ending punctuation on the PREVIOUS character
      if (/[.!?]/.test(prevChar)) {
        delay += typingConfig.sentencePauseMin + Math.random() * (typingConfig.sentencePauseMax - typingConfig.sentencePauseMin)
      } else if (/[,;]/.test(prevChar)) {
        delay += typingConfig.commaPauseMin + Math.random() * (typingConfig.commaPauseMax - typingConfig.commaPauseMin)
      }

      // Thinking micro-pause
      if (Math.random() < typingConfig.thinkPauseChance) {
        delay += 120 + Math.random() * 150
      }

      // Jitter
      delay *= 0.8 + Math.random() * 0.4

      return Math.max(typingConfig.minDelay, delay)
    }

    function tick() {
      if (cancelledRef.current) return
      if (charIdx >= text.length) {
        setIsTyping(false)
        alreadyTypedRef.current = true
        return
      }

      const char = text[charIdx]
      const prevChar = charIdx > 0 ? text[charIdx - 1] : ''
      charIdx++
      acc += char
      const snapshot = acc

      setTyped(snapshot)

      const delay = computeDelay(char, prevChar)
      timeoutRef.current = window.setTimeout(tick, delay)
    }

    // Brief initial pause before Luna starts typing
    const initDelay =
      typingConfig.initialDelayMin +
      Math.random() * (typingConfig.initialDelayMax - typingConfig.initialDelayMin)
    timeoutRef.current = window.setTimeout(tick, initDelay)

    return () => {
      cancelledRef.current = true
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [text, enabled, reduceMotion, typingConfig])

  return { typed, isTyping }
}


export const MessageBubble = ({
  message,
  filesByField = {},
  disabled = false,
  initialAnswer,
  selectedValue,
  onOption,
  onCardSubmit,
  onCardCancel,
  answers = {},
  checklist = null,
  generating = false,
  uploadTotal = 0,
  onSummaryGenerate,
  onSummaryChanges,
  isRevisionSummary = false,
  designStatus = '',
  onDesignAllINeed,
  onDesignRegenerate,
  onDesignEngage,
  isCurrentRevision = false,
  revisionNotes = '',
  revisionFiles = [],
  revisionRating = 0,
  onRevisionRate,
  submittedAction = null,
  isEngagingDesigner = false,
  revisionPendingGenerate = false,
  revisionRegenerateDisabled = false,
  onRevisionGenerate,
  onRevisionMakeChanges,
  onRevisionAllINeed,
  onRevisionRegenerate,
  onRevisionEngage,
  editing = false,
  onEditStart,
  onEditSave,
  onEditCancel,
  editOptions,
  answerImageUrls = [],
  apiKey,
  editingNextMessage = false,
  onOptionEditSave,
  workType,
}: MessageBubbleProps) => {
  const isUser = message.role === 'user'
  const reduceMotion = useReducedMotion() ?? false
  const typingConfig = useSelector(selectTypingConfig)
  const { entries } = useSelector((state: RootState) => state.enterprise)
  const originalEntry = entries.find((entry) => entry.type === "original")
  const originalPending = Boolean(
    originalEntry &&
      (originalEntry.status === "queued" ||
        originalEntry.status === "processing" ||
        originalEntry.status === "pending")
  )
  const summaryActionsHidden =
    originalEntry !== undefined && originalEntry.status !== "failed"

  const summaryDisabled =
    originalEntry !== undefined && originalEntry.status !== "failed"

  const cardDescText = message.card?.description ?? ""
  const displayText =
    message.kind === "card" && message.card
      ? cardDescText
      : message.content

  // The revision summary renders as a card instead of a typed bubble, so the
  // typewriter is skipped entirely and the card appears immediately.
  // Restored messages (from sessionStorage on refresh) also skip the typewriter
  // so the chat snaps back to its previous state without replaying animations.
  const { typed, isTyping } = useCharTypewriter(
    displayText,
    !isUser && !isRevisionSummary && !message.isRestored,
    reduceMotion,
    typingConfig
  )
  const done = isUser || typed === displayText
  const checklistAnimated = done && message.showChecklist && !message.isRestored
  const { visibleItems: bubbleVisibleChecklist, isFinished: checklistFinished } = useLineByLineTypewriter(
    checklist,
    {
      enabled: checklistAnimated,
      speedMs: typingConfig.checklistBubbleSpeedMs,
      lineDelayMs: typingConfig.checklistBubbleLineDelayMs,
    }
  )

  const cardContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (done && message.kind === 'card' && !message.isRestored) {
      const timer = setTimeout(() => {
        cardContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [done, message.kind, message.isRestored])

  const optionsVisible =
    done &&
    (!message.showChecklist || (checklist && checklist.length > 0 && checklistFinished))

  const checklistItem = useMemo(() => {
    if (!checklist || checklist.length === 0) return null
    const targetId = message.checklistId || apiKey
    if (targetId === 'overview' || targetId === 'summary') return null

    const messageApiKey = message.id.replace(/^ep-/, '').replace(/-\d+$/, '')

    return (
      checklist.find(
        (item) =>
          item.id === targetId ||
          (message.checklistId && item.id === message.checklistId) ||
          (apiKey && item.id === apiKey) ||
          item.id === messageApiKey ||
          (message.checklistId && item.id.includes(message.checklistId)) ||
          item.id.includes(messageApiKey)
      ) ?? null
    )
  }, [checklist, message.checklistId, message.id, apiKey])

  // Hide "N of 8" only on the upload-card bubbles (kind === 'card') for these
  // optional questions in standard flows — in custom flows, the upload card itself represents the step.
  const UNNUMBERED_CARD_IDS = ['additional_images_upload', 'supporting_files_upload']

  const isCustomWorkType = (workType ?? '').trim().toLowerCase().replace(/-/g, '_') === 'custom'

  const isSuppressedUploadCard =
    !isCustomWorkType &&
    message.kind === 'card' &&
    UNNUMBERED_CARD_IDS.some((id) => (message.checklistId || apiKey || '').includes(id))

  const sequenceLabel =
    checklistItem && checklist?.length && !isSuppressedUploadCard
      ? `${checklistItem.number} of ${checklist.length}`
      : null


      console.log('sequenceLabel', sequenceLabel, isSuppressedUploadCard, checklistItem, checklist?.length);
  return (
    <div className='w-full'>
      {!isRevisionSummary && (
        <>
          {/* ── User message: delegate to UserAnswerBubble ── */}
          {isUser ? (
            <UserAnswerBubble
              apiKey={apiKey}
              content={message.content}
              imageUrls={answerImageUrls}
              editing={editing}
              editOptions={editOptions}
              onEditStart={onEditStart}
              onEditSave={onEditSave}
              onEditCancel={onEditCancel}
              isRestored={message.isRestored}
            />
          ) : (
            /* ── Assistant message ── */
            <motion.div
              initial={
                message.isRestored
                  ? { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }
                  : reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 16, scale: 0.97, filter: 'blur(4px)' }
              }
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
              transition={
                message.isRestored
                  ? { duration: 0 }
                  : {
                      type: 'spring',
                      stiffness: 420,
                      damping: 28,
                      mass: 0.85
                    }
              }
              className='flex w-full items-start justify-start'
            >
              <div className='mr-3 mt-0.5'>
                <LunaAvatar size='sm' />
              </div>

              <div
                className={`flex flex-col ${
                  message.kind === 'card'
                    ? 'w-full sm:max-w-[85%] items-start'
                    : 'max-w-[85%] sm:max-w-[75%] items-start'
                }`}
              >
                <div
                  className={`rounded-2xl rounded-bl-md border border-zinc-200/80 bg-white px-4 py-2.5 text-[15px] leading-relaxed text-zinc-800 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 ${
                    message.kind === 'card' ? 'w-full' : ''
                  }`}
                >
                  <p className='whitespace-pre-wrap break-words'>
                    {renderInline(typed)}
                  </p>

                  {sequenceLabel && (
                    <div className='mt-1 flex justify-end'>
                      <span className='text-[11.5px] font-medium text-zinc-400 dark:text-zinc-500 select-none'>
                        {sequenceLabel}
                      </span>
                    </div>
                  )}

                  {done && message.showChecklist && (
                    checklist && checklist.length > 0 ? (
                      <ol className='mt-3 space-y-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-800'>
                        {bubbleVisibleChecklist.map(({ item, displayText, isTyping: itemTyping }) => (
                          <li
                            key={item.id}
                            className='flex items-baseline gap-2 text-[13.5px] text-zinc-600 dark:text-zinc-300'
                          >
                            <span className='font-semibold text-emerald-600 dark:text-emerald-400'>
                              {item.number}.
                            </span>
                            <span>
                              {displayText}
                              {itemTyping && (
                                <span
                                  aria-hidden='true'
                                  className='caret-blink ml-px inline-block h-[1.1em] w-[2px] rounded-[1px] bg-zinc-400 align-middle dark:bg-zinc-500'
                                />
                              )}
                            </span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <div className='mt-3 flex items-center gap-2 border-t border-zinc-100 pt-3 text-[13px] text-zinc-400 dark:border-zinc-800 dark:text-zinc-500 animate-pulse'>
                        <div className='h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent' />
                        <span>Loading checklist items...</span>
                      </div>
                    )
                  )}
                </div>

                {/* ── OptionButtons: hidden until checklist finishes typing; hidden once answered ── */}
                {optionsVisible && message.options && (!selectedValue || editingNextMessage) && (
                  <OptionButtons
                    options={message.options}
                    disabled={editingNextMessage ? false : disabled}
                    selectedValue={editingNextMessage ? undefined : selectedValue}
                    onSelect={editingNextMessage
                      ? (onOptionEditSave ?? (() => {}))
                      : (onOption ?? (() => {}))}
                  />
                )}

                {/* ── QuestionCard: hidden once answered (disabled=true) unless being re-edited ── */}
                {done && message.kind === 'card' && message.card && (!disabled || onCardCancel) && (
                  <motion.div
                    ref={cardContainerRef}
                    initial={
                      message.isRestored
                        ? { opacity: 1, y: 0 }
                        : reduceMotion
                        ? { opacity: 0 }
                        : { opacity: 0, y: 12 }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    transition={
                      message.isRestored
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 380, damping: 30 }
                    }
                    className='mt-3 w-full'
                  >
                    {message.id === 'ep-additional_images_upload' || message.id.startsWith('ep-additional_images_upload-') ? (
                      <AdditionalImagesUploadCard
                        key={`${message.id}-${disabled ? 'disabled' : 'editing'}`}
                        spec={message.card}
                        filesByField={filesByField}
                        initialAnswer={initialAnswer ?? message.initialAnswer}
                        disabled={disabled}
                        onSubmit={onCardSubmit ?? (() => {})}
                        onCancel={onCardCancel}
                      />
                    ) : (
                      <QuestionCard
                        key={`${message.id}-${disabled ? 'disabled' : 'editing'}`}
                        spec={message.card}
                        filesByField={filesByField}
                        initialAnswer={initialAnswer ?? message.initialAnswer}
                        disabled={disabled}
                        showHeader={false}
                        onSubmit={onCardSubmit ?? (() => {})}
                        onCancel={onCardCancel}
                      />
                    )}
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </>
      )}

      {done && message.kind === 'summary' && (
        <motion.div
          initial={
            message.isRestored
              ? { opacity: 1, y: 0 }
              : reduceMotion
              ? { opacity: 0 }
              : { opacity: 0, y: 12 }
          }
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          transition={
            message.isRestored
              ? { duration: 0 }
              : { type: 'spring', stiffness: 380, damping: 30 }
          }
          className='mt-3 w-full'
        >
          {isRevisionSummary ? (
            <RevisionDesign
              messageId={message.id}
              entries={entries}
              fallbackNotes={revisionNotes}
              fallbackFiles={revisionFiles}
              isCurrent={isCurrentRevision}
              rating={revisionRating}
              onRate={onRevisionRate ?? (() => {})}
              submittedAction={submittedAction}
              isEngagingDesigner={isEngagingDesigner}
              pendingGenerate={revisionPendingGenerate}
              regenerateDisabled={revisionRegenerateDisabled}
              onGenerate={onRevisionGenerate ?? (() => {})}
              onMakeChanges={onRevisionMakeChanges ?? (() => {})}
              onAllINeed={onRevisionAllINeed ?? (() => {})}
              onRegenerate={onRevisionRegenerate ?? (() => {})}
              onEngageDesigner={onRevisionEngage ?? (() => {})}
            />
          ) : (
            <>
              <DesignSummaryCard
                answers={answers}
                uploadTotal={uploadTotal}
                generating={generating}
                disabled={summaryDisabled}
                showActions={!summaryActionsHidden}
                summaryTitle={message.title}
                summaryText={message.content}
                onGenerate={onSummaryGenerate ?? (() => {})}
                onChanges={onSummaryChanges ?? (() => {})}
              />
              <DesignGeneratingCard status={designStatus} />
              {originalEntry?.url && (
                <div className='mt-3'>
                  <DesignResultCard
                    imageUrl={originalEntry.url}
                    disabled={originalPending}
                    submittedAction={submittedAction}
                    isEngagingDesigner={isEngagingDesigner}
                    onAllINeed={onDesignAllINeed ?? (() => {})}
                    onRegenerate={onDesignRegenerate ?? (() => {})}
                    onEngageDesigner={onDesignEngage ?? (() => {})}
                  />
                </div>
              )}
            </>
          )}
        </motion.div>
      )}
    </div>
  )
}

export default memo(MessageBubble)
