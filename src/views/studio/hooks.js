import { useEffect, useState } from 'react'

/**
 * Count-up hook used by the loader and status bars. Resets whenever
 * `resetKey` changes — consumers pass `generatingSlide` so each slide
 * restarts at 0. Returns seconds as an integer for easy formatting.
 */
export function useElapsedSeconds(running, resetKey) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!running) { setElapsed(0); return undefined }
    setElapsed(0)
    const startedAt = Date.now()
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    }, 250)
    return () => clearInterval(id)
  }, [running, resetKey])
  return elapsed
}

/** Media query hook — true when viewport is below lg (1024px). */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 1023px)').matches
  })
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const onChange = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return isMobile
}
