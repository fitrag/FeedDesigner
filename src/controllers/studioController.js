import { useCallback, useMemo, useRef, useState } from 'react'
import { defaultStudioForm } from '../models/feedDesignerModel.js'
import { authedFetch } from '../views/auth.jsx'
import { resolveApiUrl } from '../config.js'

async function postJson(url, body, signal) {
  const res = await authedFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.error || `Request gagal (${res.status})`)
    err.status = res.status
    throw err
  }
  return data
}

/**
 * Studio controller.
 *
 * Generation flow for carousels is index-based: every slot in `images` maps
 * 1:1 to a slide index, `null` means "not rendered yet". A sibling array
 * `slideStatus` tracks pending / ok / failed so the UI can show progress
 * and offer a "retry this slide" action without re-running the whole batch.
 *
 * We keep the planner output (`carouselSlides`, `designBrief`,
 * `generationId`) on refs so a later retry call reuses the same plan and
 * adds slides to the same DB row — critical for carousel identity.
 */
export function useStudioController() {
  const [form, setForm] = useState(defaultStudioForm)
  const [images, setImages] = useState([])
  const [slideStatus, setSlideStatus] = useState([]) // 'pending' | 'ok' | 'failed'
  const [activeSlide, setActiveSlide] = useState(0)
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [generatingSlide, setGeneratingSlide] = useState(0)
  const [error, setError] = useState('')
  const [productUpload, setProductUpload] = useState(null)
  const [referenceUploads, setReferenceUploads] = useState([])
  const [logoUpload, setLogoUpload] = useState(null)

  // Refs shared between the main generate loop and the per-slide retry path.
  const abortRef = useRef(null)
  const planRef = useRef(null)          // { carouselSlides, designBrief }
  const generationIdRef = useRef(null)  // stable across all slides + retries
  const promptsRef = useRef({})         // { [slideIndex]: prompt text }

  const isCarousel = form.mode === 'carousel'
  const canGenerate = useMemo(() => Boolean(form.topic.trim()) && !loading, [form.topic, loading])

  const failedSlides = useMemo(
    () => slideStatus
      .map((s, i) => (s === 'failed' ? i + 1 : null))
      .filter((v) => v != null),
    [slideStatus],
  )

  const update = useCallback((key, value) => {
    setForm((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }))
  }, [])

  const clearUploads = useCallback(() => {
    setProductUpload(null)
    setReferenceUploads([])
    setLogoUpload(null)
  }, [])

  /** Set a single slot in the images array without losing sibling state. */
  const setImageAt = useCallback((index, value) => {
    setImages((prev) => {
      const next = prev.slice()
      next[index] = value
      return next
    })
  }, [])

  const setStatusAt = useCallback((index, value) => {
    setSlideStatus((prev) => {
      const next = prev.slice()
      next[index] = value
      return next
    })
  }, [])

  /** Low-level primitive: render ONE slide. Used by both the initial batch
   *  generation and the per-slide retry flow. */
  const renderSlide = useCallback(async (index, total, signal) => {
    const plan = planRef.current || {}
    const data = await postJson(
      '/api/generate-feed',
      {
        ...form,
        totalSlides: total,
        slideIndex: index,
        slideContent: plan.carouselSlides?.[index - 1],
        carouselSlides: plan.carouselSlides || [],
        designBrief: plan.designBrief || null,
        generationId: generationIdRef.current || undefined,
        // Uploaded images are inline data URLs — server does not keep any
        // per-user upload state. See `processUploadedImage` on the server.
        productImage: productUpload?.dataUrl || null,
        referenceImages: referenceUploads.map((r) => r.dataUrl).filter(Boolean),
        logoImage: logoUpload?.dataUrl || null,
      },
      signal,
    )
    if (data.generationId) generationIdRef.current = data.generationId
    promptsRef.current[index] = data.prompt
    return { ...data, image: resolveApiUrl(data.image) }
  }, [form, productUpload, referenceUploads, logoUpload])

  /** Rebuild the `prompt` string from the slide→prompt dictionary so the
   *  Prompt Log inspector always reflects what was actually rendered. */
  const syncPromptFromRefs = useCallback(() => {
    const entries = Object.keys(promptsRef.current)
      .map(Number)
      .sort((a, b) => a - b)
      .map((i) => `--- Slide ${i} ---\n${promptsRef.current[i]}`)
    setPrompt(entries.join('\n\n'))
  }, [])

  const generate = useCallback(async (event) => {
    event?.preventDefault?.()
    // Cancel any in-flight generation before starting a new one.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const total = form.mode === 'carousel' ? Number(form.totalSlides) : 1

    setError('')
    setLoading(true)
    setImages(new Array(total).fill(null))
    setSlideStatus(new Array(total).fill('pending'))
    setActiveSlide(0)
    setPrompt('')
    planRef.current = null
    generationIdRef.current = null
    promptsRef.current = {}

    try {
      let carouselSlides = []
      let designBrief = null
      if (form.mode === 'carousel') {
        setGeneratingSlide(0)
        const planData = await postJson('/api/create-carousel-plan', form, controller.signal)
        carouselSlides = planData.slides || []
        designBrief = planData.designBrief || null
      }
      planRef.current = { carouselSlides, designBrief }

      // Render slides sequentially. Failures don't abort the whole batch —
      // we mark the slide as failed and keep going so the user gets partial
      // results they can retry individually.
      let lastError = null
      for (let index = 1; index <= total; index += 1) {
        if (controller.signal.aborted) return
        setGeneratingSlide(index)
        try {
          const data = await renderSlide(index, total, controller.signal)
          setImageAt(index - 1, data.image)
          setStatusAt(index - 1, 'ok')
          setActiveSlide(index - 1)
        } catch (err) {
          if (err.name === 'AbortError') return
          setStatusAt(index - 1, 'failed')
          lastError = err
          // Keep going to the next slide instead of aborting the batch.
        }
      }

      syncPromptFromRefs()
      if (lastError) {
        // Surface the last failure so the toast system picks it up, but UI
        // still has partial images.
        setError(lastError.message)
      }
    } catch (err) {
      // Errors here are from the planner call (before per-slide loop); the
      // whole batch is compromised.
      if (err.name === 'AbortError') return
      setError(err.message)
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setLoading(false)
      setGeneratingSlide(0)
    }
  }, [form, renderSlide, setImageAt, setStatusAt, syncPromptFromRefs])

  /** Retry a single slide that previously failed. Reuses the existing plan
   *  + generationId so the slide joins the same DB row and obeys the same
   *  design brief as its siblings. */
  const retrySlide = useCallback(async (slideIndex) => {
    if (loading) return
    if (!planRef.current) {
      // No plan cached (e.g. user refreshed the page before retry). Fall
      // back to a full regenerate — shows a toast via `error` when the
      // planner eventually succeeds.
      return generate()
    }
    const total = form.mode === 'carousel' ? Number(form.totalSlides) : 1

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setError('')
    setLoading(true)
    setGeneratingSlide(slideIndex)
    setStatusAt(slideIndex - 1, 'pending')
    setImageAt(slideIndex - 1, null)

    try {
      const data = await renderSlide(slideIndex, total, controller.signal)
      setImageAt(slideIndex - 1, data.image)
      setStatusAt(slideIndex - 1, 'ok')
      setActiveSlide(slideIndex - 1)
      syncPromptFromRefs()
    } catch (err) {
      if (err.name === 'AbortError') return
      setStatusAt(slideIndex - 1, 'failed')
      setError(err.message)
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setLoading(false)
      setGeneratingSlide(0)
    }
  }, [loading, form.mode, form.totalSlides, generate, renderSlide, setImageAt, setStatusAt, syncPromptFromRefs])

  /** Retry every slide that's currently in "failed" state, sequentially. */
  const retryFailed = useCallback(async () => {
    if (loading || failedSlides.length === 0) return
    for (const idx of failedSlides) {
      // eslint-disable-next-line no-await-in-loop
      await retrySlide(idx)
    }
  }, [loading, failedSlides, retrySlide])

  return {
    form,
    images,
    slideStatus,
    failedSlides,
    activeSlide,
    prompt,
    loading,
    generatingSlide,
    error,
    canGenerate,
    isCarousel,
    update,
    generate,
    retrySlide,
    retryFailed,
    setActiveSlide,
    productUpload,
    referenceUploads,
    logoUpload,
    setProductUpload,
    setReferenceUploads,
    setLogoUpload,
    clearUploads,
  }
}
