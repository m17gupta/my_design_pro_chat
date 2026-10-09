"use client"
import { useEffect, useRef } from 'react'
import { RootState } from '../../store'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { DEFAULT_WATERMARK, DEFAULT_WORK_TYPE } from '../../lib/apiBrief'
import { isPersistenceConfigured } from '../../lib/persistenceConfig'
import { saveProject } from '../../store/persistence/persistenceThunk'

const PERSIST_DEBOUNCE_MS = 1000

const UpdateProjectData = () => {

    const dispatch = useAppDispatch()
    const chat = useAppSelector((state: RootState) => state.chat)
    const entries = useAppSelector((state: RootState) => state.enterprise.entries)
    const { id, original, revision_comment } = chat

    const chatRef = useRef(chat)
    const entriesRef = useRef(entries)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        chatRef.current = chat
    }, [chat])

    useEffect(() => {
        entriesRef.current = entries
    }, [entries])

    useEffect(() => {
        const targetId = chat.projectId || (chat.id != null ? String(chat.id) : "")
        if (!targetId || !isPersistenceConfigured) return
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
            timerRef.current = null
            const { id, projectId, watermark, work_type, image_url, value, original, revision_comment, user_type, dc_name, role, custom_engage_designer, question_sets, project_address } = chatRef.current
            const currentProjectId = projectId || (id != null ? String(id) : "")
            if (original == null || Object.keys(original).length === 0 || !currentProjectId) return
            void dispatch(
                saveProject({
                    projectId: currentProjectId,
                    chats: {
                        projectId: currentProjectId,
                        user_type: user_type ?? "",
                        dc_name: dc_name ?? "",
                        role: role ?? null,
                        // custom_engage_designer: custom_engage_designer ?? undefined,
                        watermark: watermark ?? DEFAULT_WATERMARK,
                        work_type: work_type ?? DEFAULT_WORK_TYPE,
                        image_url: image_url ?? "",
                        value: value ?? "",
                        original,
                        revision_comment,
                        question_sets: question_sets ?? undefined,
                        project_address: project_address ?? undefined,
                    },
                    designData: entriesRef.current,
                })
            )
        }, PERSIST_DEBOUNCE_MS)
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [dispatch, id, original, revision_comment, entries])

    return (
        null
    )
}

export default UpdateProjectData