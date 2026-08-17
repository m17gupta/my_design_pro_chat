'use client'

import { memo, useEffect, useRef, useState } from 'react'
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
  checklist?: ChecklistItem[]
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

  editingNextMessage?: boolean
 
  onOptionEditSave?: (text: string) => void
}

/**
 * Reveal text word-by-word so Luna appears to be writing it live.
 * Skipped entirely when reduced motion is preferred.
 */
function useTypewriter (
  text: string,
  enabled: boolean,
  reduceMotion: boolean
): string {
  const [out, setOut] = useState(reduceMotion || !enabled ? text : '')
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    // Defer to a timeout so every state update happens asynchronously
    // (keeps the typewriter's interval cleanup safe on dependency changes).
    const id = window.setTimeout(() => {
      if (!enabled || reduceMotion) {
        setOut(text)
        return
      }
      setOut('')
      const tokens = text.split(/(\s+)/)
      let i = 0
      let acc = ''
      intervalRef.current = window.setInterval(() => {
        acc += tokens[i] ?? ''
        i += 1
        setOut(acc)
        if (i >= tokens.length && intervalRef.current !== null) {
          window.clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }, 80)
    }, 0)
    return () => {
      window.clearTimeout(id)
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [text, enabled, reduceMotion])

  return out
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
  checklist = CHECKLIST,
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
 
  const summaryActionsHidden =
    originalEntry !== undefined && originalEntry.status !== "failed"

  const summaryDisabled =
    originalEntry !== undefined && originalEntry.status !== "failed"
 
  const displayText =
    message.kind === 'card' && message.card
      ? `${message.card.title}\n\n${message.card.description}`
      : message.content

  // The revision summary renders as a card instead of a typed bubble, so the
  // typewriter is skipped entirely and the card appears immediately.
  // Restored messages (from sessionStorage on refresh) also skip the typewriter
  // so the chat snaps back to its previous state without replaying animations.
  const typed = useTypewriter(
    displayText,
    !isUser && !isRevisionSummary && !message.isRestored,
    reduceMotion
  )
  const done = isUser || typed === displayText

  if (message.kind === 'card') {
    // console.log("Card render check:", {
    //   id: message.id,
    //   done,
    //   disabled,
    //   hasCardCancel: !!onCardCancel,
    // });
  }

  return (
    <div className='w-full'>
      {!isRevisionSummary && (
        <>
          {/* ── User message: delegate to UserAnswerBubble ── */}
          {isUser ? (
            <UserAnswerBubble
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
                  ? { opacity: 1, y: 0, scale: 1 }
                  : reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 12, scale: 0.96 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
              transition={
                message.isRestored
                  ? { duration: 0 }
                  : {
                      type: 'spring',
                      stiffness: 380,
                      damping: 30,
                      mass: 0.9
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
                    {!done && (
                      <span
                        aria-hidden='true'
                        className='ml-0.5 inline-block h-[1em] w-[2px] animate-pulse rounded-sm bg-emerald-500 align-middle dark:bg-emerald-400'
                      />
                    )}
                  </p>

                  {done && message.showChecklist && (
                    <ol className='mt-3 space-y-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-800'>
                      {checklist.map(item => (
                        <li
                          key={item.id}
                          className='flex items-baseline gap-2 text-[13.5px] text-zinc-600 dark:text-zinc-300'
                        >
                          <span className='font-semibold text-emerald-600 dark:text-emerald-400'>
                            {item.number}.
                          </span>
                          <span>{item.label}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                {/* ── OptionButtons: hidden once answered; reappear during edit ── */}
                {done && message.options && (!selectedValue || editingNextMessage) && (
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
                checklist={checklist}
                uploadTotal={uploadTotal}
                generating={generating}
                disabled={summaryDisabled}
                showActions={!summaryActionsHidden}
                onGenerate={onSummaryGenerate ?? (() => {})}
                onChanges={onSummaryChanges ?? (() => {})}
              />
              {(
                <div className='mt-3'>
                  <DesignGeneratingCard status={designStatus} />
                </div>
              )}
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
