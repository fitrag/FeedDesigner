import { useCallback, useMemo, useRef, useState } from 'react'
import { defaultStudioForm } from '../models/feedDesignerModel.js'
import { authedFetch } from '../views/auth.jsx'

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

export function useStudioController() {
  const [form, setForm] = useState(defaultStudioForm)
  const [images, setImages] = useState([])
  const [activeSlide, setActiveSlide] = useState(0)
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [generatingSlide, setGeneratingSlide] = useState(0)
  const [error, setError] = useState('')
  const [productUpload, setProductUpload] = useState(null)
  const [referenceUploads, setReferenceUploads] = useState([])
  const [logoUpload, setLogoUpload] = useState(null)
  const abortRef = useRef(null)

  const isCarousel = form.mode === 'carousel'
  const canGenerate = useMemo(() => Boolean(form.topic.trim()) && !loading, [form.topic, loading])

  const update = useCallback((key, value) => {
    setForm((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }))
  }, [])

  const clearUploads = useCallback(() => {
    setProductUpload(null)
    setReferenceUploads([])
    setLogoUpload(null)
  }, [])

  const generate = useCallback(async (event) => {
    event?.preventDefault?.()
    // Cancel any in-flight generation before starting a new one.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setError('')
    setLoading(true)
    setImages([])
    setActiveSlide(0)
    setPrompt('')

    const total = form.mode === 'carousel' ? Number(form.totalSlides) : 1
    const collectedPrompts = []
    let generationId
    let designBrief

    try {
      let carouselSlides = []
      if (form.mode === 'carousel') {
        setGeneratingSlide(0)
        const planData = await postJson('/api/create-carousel-plan', form, controller.signal)
        carouselSlides = planData.slides || []
        designBrief = planData.designBrief || null
      }

      for (let index = 1; index <= total; index += 1) {
        if (controller.signal.aborted) return
        setGeneratingSlide(index)
        const data = await postJson(
          '/api/generate-feed',
          {
            ...form,
            totalSlides: total,
            slideIndex: index,
            slideContent: carouselSlides[index - 1],
            carouselSlides,
            designBrief,
            generationId,
            productUploadId: productUpload?.id || null,
            referenceUploadIds: referenceUploads.map((r) => r.id).filter(Boolean),
            logoUploadId: logoUpload?.id || null,
          },
          controller.signal,
        )

        // Share generation id across the rest of the slides so they all attach
        // to the same row in the database.
        if (data.generationId) generationId = data.generationId

        setImages((prev) => [...prev, data.image])
        setActiveSlide(index - 1)
        collectedPrompts.push(`--- Slide ${index} ---\n${data.prompt}`)
      }

      setPrompt(collectedPrompts.join('\n\n'))
    } catch (err) {
      if (err.name === 'AbortError') return
      setError(err.message)
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setLoading(false)
      setGeneratingSlide(0)
    }
  }, [form, productUpload, referenceUploads, logoUpload])

  return {
    form,
    images,
    activeSlide,
    prompt,
    loading,
    generatingSlide,
    error,
    canGenerate,
    isCarousel,
    update,
    generate,
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
