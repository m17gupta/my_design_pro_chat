'use client'

import { memo, useEffect, useRef, useState, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

import { renderInline } from './formatText'

import LunaAvatar from './LunaAvatar'
import OptionButtons from './OptionButtons'
import QuestionCard, { type CardResult } from './QuestionCard'
import UserAnswerBubble from './UserAnswerBubble'
import { CHECKLIST, type ChecklistItem, type Message, type AnswerValue } from './types'
import RevisionDesign from '../revisionDesign/RevisionDesign'
import type { SubmitAction } from '../revisionDesign/RevisionResultCard'
import { useSelector } from 'react-redux'
import { RootState } from '@/store'
import DesignSummaryCard from './MainDesign/DesignSummaryCard'
import DesignGeneratingCard from './MainDesign/DesignGeneratingCard'
import DesignResultCard from './MainDesign/DesignResultCard'
import { useLineByLineTypewriter } from './useLineByLineTypewriter'

interface MessageBubbleProps {
  message: Message
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
  reduceMotion: boolean
): { typed: string; isTyping: boolean } {
  const [typed, setTyped] = useState(reduceMotion || !enabled ? text : '')
  const [isTyping, setIsTyping] = useState(enabled && !reduceMotion && text.length > 0)
  const timeoutRef = useRef<number | null>(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false

    if (!enabled || reduceMotion) {
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
        ? 40 + Math.random() * 25     // burst chars (space/punct): 40–65 ms
        : 60 + Math.random() * 40     // normal chars: 60–100 ms

      // Sentence-ending punctuation on the PREVIOUS character
      if (/[.!?]/.test(prevChar)) delay += 370 + Math.random() * 310  // 370–680 ms pause
      // Comma / semicolon pause
      else if (/[,;]/.test(prevChar)) delay += 155 + Math.random() * 115  // 155–270 ms pause

      // 5% chance of a "thinking" micro-pause
      if (Math.random() < 0.05) delay += 200 + Math.random() * 220   // 200–420 ms

      // ±25% jitter
      delay *= 0.75 + Math.random() * 0.5

      return Math.max(30, delay)
    }

    function tick() {
      if (cancelledRef.current) return
      if (charIdx >= text.length) {
        setIsTyping(false)
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

    // Brief initial pause before Luna starts typing (feels more natural)
    timeoutRef.current = window.setTimeout(tick, 120 + Math.random() * 80)

    return () => {
      cancelledRef.current = true
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [text, enabled, reduceMotion])

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
}: MessageBubbleProps) => {
  const isUser = message.role === 'user'
  const reduceMotion = useReducedMotion() ?? false
  const { entries } = useSelector((state: RootState) => state.enterprise)
  // The intake (original) entry drives the summary + result card below it.
  const originalEntry = entries.find((entry) => entry.type === "original")
  const originalPending = Boolean(
    originalEntry &&
      (originalEntry.status === "queued" ||
        originalEntry.status === "processing" ||
        originalEntry.status === "pending")
  )
  // console.log("MessageBubbleProps")
  const summaryActionsHidden =
    originalEntry !== undefined && originalEntry.status !== "failed"

  const summaryDisabled =
    originalEntry !== undefined && originalEntry.status !== "failed"
 
  const cardDescText = message.card?.description ?? ""
  const displayText =
    message.kind === 'card' && message.card
      ? cardDescText
      : message.content
   
   
  // The revision summary renders as a card instead of a typed bubble, so the
  // typewriter is skipped entirely and the card appears immediately.
  // Restored messages (from sessionStorage on refresh) also skip the typewriter
  // so the chat snaps back to its previous state without replaying animations.
  const { typed, isTyping } = useCharTypewriter(
    displayText,
    !isUser && !isRevisionSummary && !message.isRestored,
    reduceMotion
  )
  const done = isUser || typed === displayText
  const checklistAnimated = done && message.showChecklist && !message.isRestored
  const { visibleItems: bubbleVisibleChecklist, isFinished: checklistFinished } = useLineByLineTypewriter(
    checklist,
    { enabled: checklistAnimated, speedMs: 100, lineDelayMs: 900 }
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
                    {isTyping && (
                      <span
                        aria-hidden='true'
                        className='caret-blink ml-px inline-block h-[1.1em] w-[2px] rounded-[1px] bg-zinc-500 align-middle dark:bg-zinc-400'
                      />
                    )}
                  </p>

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
