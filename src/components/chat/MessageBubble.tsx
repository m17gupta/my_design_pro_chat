'use client'

import { memo, useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

import { renderInline } from './formatText'
import LunaAvatar from './LunaAvatar'
import OptionButtons from './OptionButtons'
import QuestionCard, { type CardResult } from './QuestionCard'
import { CHECKLIST, type Message, type AnswerValue } from './types'
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
  onOption?: (value: string) => void
  onCardSubmit?: (result: CardResult) => void
  onCardCancel?: () => void
  /** Recorded answers for the design-summary rows. */
  answers?: Record<string, string>
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
      }, 40)
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
  onOption,
  onCardSubmit,
  onCardCancel,
  answers = {},
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
  onEditCancel
}: MessageBubbleProps) => {
  const isUser = message.role === 'user'
  const reduceMotion = useReducedMotion() ?? false
  const editRef = useRef<HTMLTextAreaElement>(null)
  const { entries } = useSelector((state: RootState) => state.enterprise)
  // The intake (original) entry drives the summary + result card below it.
  const originalEntry = entries.find((entry) => entry.type === "original")
  const originalPending = Boolean(
    originalEntry &&
      (originalEntry.status === "queued" ||
        originalEntry.status === "processing" ||
        originalEntry.status === "pending")
  )
  // Once the original entry exists and isn't failed, the intake summary's two
  // action buttons are hidden — the generating/result card takes over. A
  // failed entry keeps them visible so the generate can be retried.
  const summaryActionsHidden =
    originalEntry !== undefined && originalEntry.status !== "failed"
  // The intake summary's actions stay disabled while the original entry is
  // pending or done; a failed entry stays enabled so it can be retried.
  const summaryDisabled =
    originalEntry !== undefined && originalEntry.status !== "failed"
  // Cards type out their title + description in the bubble; the card below
  // then shows only the answer fields.
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

  // Focus the edit textarea (cursor at the end) when edit mode opens.
  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus()
      const len = editRef.current.value.length
      editRef.current.setSelectionRange(len, len)
    }
  }, [editing])

  const saveEdit = () => {
    if (editRef.current && onEditSave) onEditSave(editRef.current.value)
  }

  const cancelEdit = () => {
    if (onEditCancel) onEditCancel()
  }

  return (
    <div className='w-full'>
      {!isRevisionSummary && (
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
          className={`flex w-full items-start ${
            isUser ? 'justify-end' : 'justify-start'
          }`}
        >
          {!isUser && (
            <div className='mr-3 mt-0.5'>
              <LunaAvatar size='sm' />
            </div>
          )}

          <div
            className={`flex flex-col ${
              isUser
                ? 'max-w-[85%] sm:max-w-[75%] items-end'
                : message.kind === 'card'
                ? 'w-full sm:max-w-[85%] items-start'
                : 'max-w-[85%] sm:max-w-[75%] items-start'
            }`}
          >
            <div
              className={`rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed shadow-sm ${
                isUser
                  ? 'rounded-br-md bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20'
                  : 'rounded-bl-md border border-zinc-200/80 bg-white text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100'
              } ${editing ? 'w-full ring-2 ring-emerald-400/70' : ''} ${
                isUser && !editing ? 'hidden' : ''
              } ${message.kind === 'card' ? 'w-full' : ''}`}
            >
              {isUser && editing ? (
                <textarea
                  ref={editRef}
                  defaultValue={message.content}
                  aria-label='Edit your answer'
                  rows={Math.max(
                    2,
                    Math.min(6, message.content.split('\n').length + 1)
                  )}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      saveEdit()
                    } else if (e.key === 'Escape') {
                      cancelEdit()
                    }
                  }}
                  className='w-full resize-none rounded-xl bg-white/15 px-3 py-2 text-[15px] leading-relaxed text-white outline-none ring-1 ring-white/30 placeholder:text-white/60 focus:bg-white/20 focus:ring-2 focus:ring-white/60'
                />
              ) : (
                <p className='whitespace-pre-wrap break-words'>
                  {renderInline(typed)}
                  {!done && (
                    <span
                      aria-hidden='true'
                      className='ml-0.5 inline-block h-[1em] w-[2px] animate-pulse rounded-sm bg-emerald-500 align-middle dark:bg-emerald-400'
                    />
                  )}
                </p>
              )}

              {done && message.showChecklist && (
                <ol className='mt-3 space-y-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-800'>
                  {CHECKLIST.map(item => (
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

            {done && message.options && (
              <OptionButtons
                options={message.options}
                disabled={disabled}
                onSelect={onOption ?? (() => {})}
              />
            )}

            {isUser && (
              <div className='mt-1 flex items-center gap-1.5'>
                {editing ? (
                  <>
                    <button
                      type='button'
                      onClick={saveEdit}
                      className='rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-3.5 py-1 text-xs font-semibold text-white shadow-sm transition-colors hover:brightness-110'
                    >
                      Save
                    </button>
                    <button
                      type='button'
                      onClick={cancelEdit}
                      className='rounded-full border border-zinc-300 px-3.5 py-1 text-xs font-medium text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-200'
                    >
                      Cancel
                    </button>
                  </>
                ) : onEditStart ? (
                  <button
                    type='button'
                    onClick={onEditStart}
                    aria-label={`Edit answer: ${message.content}`}
                    title='Edit answer'
                    className='flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400'
                  >
                    <svg
                      width='12'
                      height='12'
                      viewBox='0 0 24 24'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth='2'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      aria-hidden='true'
                    >
                      <path d='M12 20h9' />
                      <path d='M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z' />
                    </svg>
                  </button>
                ) : null}
              </div>
            )}
            {done && message.kind === 'card' && message.card && (
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

          {/* {isUser && (
            <div className="ml-3 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              You
            </div>
          )} */}
        </motion.div>
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
