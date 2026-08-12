'use client'

import { memo, useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import DesignGeneratingCard from './DesignGeneratingCard'
import DesignResultCard from './DesignResultCard'
import DesignSummaryCard from './DesignSummaryCard'
import { renderInline } from './formatText'
import LunaAvatar from './LunaAvatar'
import OptionButtons from './OptionButtons'
import QuestionCard, { type CardResult } from './QuestionCard'
import { CHECKLIST, type Message } from './types'
import RevisionDesign from '../revisionDesign/RevisionDesign'
import { useSelector } from 'react-redux'
import { RootState } from '@/store'

interface MessageBubbleProps {
  message: Message
  /** Uploads per field index for question-card messages. */
  filesByField?: Record<number, File[]>
  disabled?: boolean
  onOption?: (value: string) => void
  onCardSubmit?: (result: CardResult) => void
  /** Recorded answers for the design-summary rows. */
  answers?: Record<string, string>
  /** True while the brief POST to the design API is in flight. */
  generating?: boolean
  uploadTotal?: number
  onSummaryGenerate?: () => void
  onSummaryChanges?: () => void
  /** True for the post-revision summary message — renders the Revision Summary card. */
  isRevisionSummary?: boolean
  /** Generated design preview URL — when present the result card renders below the summary card. */
  designImageUrl?: string
  /** True between brief submission and image-ready — shows the generating loader. */
  designPending?: boolean
  /** Backend task lifecycle (queued | processing) for the loader status text. */
  designStatus?: string
  onDesignAllINeed?: () => void
  onDesignRegenerate?: () => void
  onDesignEngage?: () => void
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
  onOption,
  onCardSubmit,
  answers = {},
  generating = false,
  uploadTotal = 0,
  onSummaryGenerate,
  onSummaryChanges,
  isRevisionSummary = false,
  designImageUrl,
  designPending = false,
  designStatus = '',
  onDesignAllINeed,
  onDesignRegenerate,
  onDesignEngage,
  editing = false,
  onEditStart,
  onEditSave,
  onEditCancel
}: MessageBubbleProps) => {
  const isUser = message.role === 'user'
  const reduceMotion = useReducedMotion() ?? false
  const editRef = useRef<HTMLTextAreaElement>(null)
  // Once a generation is in flight (or the image is ready), the summary's two
  // action buttons are hidden — the generating/result card takes over.
  const summaryActionsHidden = Boolean(designPending || designImageUrl)
  const { entries } = useSelector((state: RootState) => state.enterprise)
  // Cards type out their title + description in the bubble; the card below
  // then shows only the answer fields.
  const displayText =
    message.kind === 'card' && message.card
      ? `${message.card.title}\n\n${message.card.description}`
      : message.content

  // The revision summary renders as a card instead of a typed bubble, so the
  // typewriter is skipped entirely and the card appears immediately.
  const typed = useTypewriter(
    displayText,
    !isUser && !isRevisionSummary,
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
            reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96 }
          }
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
          transition={{
            type: 'spring',
            stiffness: 380,
            damping: 30,
            mass: 0.9
          }}
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
            className={`flex max-w-[85%] flex-col sm:max-w-[75%] ${
              isUser ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed shadow-sm ${
                isUser
                  ? 'rounded-br-md bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20'
                  : 'rounded-bl-md border border-zinc-200/80 bg-white text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100'
              } ${editing ? 'w-full ring-2 ring-emerald-400/70' : ''} ${
                isUser && !editing ? 'hidden' : ''
              }`}
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
                ) : (
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
                )}
              </div>
            )}
          </div>

          {/* {isUser && (
            <div className="ml-3 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              You
            </div>
          )} */}
        </motion.div>
      )}

      {done && message.kind === 'card' && message.card && (
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className='mt-3 w-full'
        >
          <QuestionCard
            spec={message.card}
            filesByField={filesByField}
            initialAnswer={message.initialAnswer}
            disabled={disabled}
            showHeader={false}
            onSubmit={onCardSubmit ?? (() => {})}
          />
        </motion.div>
      )}

      {done && message.kind === 'summary' && (
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.15 } }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className='mt-3 w-full'
        >
          <>
            {
              <DesignSummaryCard
                answers={answers}
                uploadTotal={uploadTotal}
                generating={generating}
                // disabled={disabled}
                showActions={!summaryActionsHidden}
                onGenerate={onSummaryGenerate ?? (() => {})}
                onChanges={onSummaryChanges ?? (() => {})}
              />
            }
            {designPending && (
              <div className='mt-3'>
                <DesignGeneratingCard status={designStatus} />
              </div>
            )}
            {
              <div className='mt-3'>
                {entries && 
                entries?.length > 0 && 
                entries[0]?.url && (
                  <DesignResultCard
                    // imageUrl={designImageUrl}
                    onAllINeed={onDesignAllINeed ?? (() => {})}
                    onRegenerate={onDesignRegenerate ?? (() => {})}
                    onEngageDesigner={onDesignEngage ?? (() => {})}
                  />
                )}
              </div>
            }

            <RevisionDesign />
          </>
        </motion.div>
      )}
    </div>
  )
}

export default memo(MessageBubble)
