import { createContext, memo, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { API_BASE_URL } from '../config.js'

/**
 * Public settings provider.
 *
 * Fetches `/api/settings` once at boot and exposes the resulting feature
 * flags to the rest of the app. All admin-only settings are excluded by
 * the server; we only see the subset marked `public: true` in the schema.
 *
 * A small `reload()` method is returned too so pages that mutate settings
 * (e.g. the admin settings form) can refresh the snapshot without waiting
 * for a full page reload.
 */

const DEFAULTS = {
  registrationEnabled: true,
  uploadsEnabled: true,
  showcasePublicDefault: false,
  generateDailyLimit: 0,
  maintenanceMode: false,
  maintenanceMessage: '',
}

const SettingsContext = createContext({ settings: DEFAULTS, loading: true, reload: () => {} })

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/settings`, { credentials: 'include' })
      if (!res.ok) throw new Error('fail')
      const data = await res.json()
      if (data?.settings && typeof data.settings === 'object') {
        setSettings({ ...DEFAULTS, ...data.settings })
      }
    } catch { /* keep defaults so UI stays functional */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { reload() }, [reload])

  const api = useMemo(() => ({ settings, loading, reload }), [settings, loading, reload])
  return <SettingsContext.Provider value={api}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  return useContext(SettingsContext)
}

/** Banner shown at the top of the app when the admin has flipped on
 *  maintenance mode. Harmless when the flag is off. */
export const MaintenanceBanner = memo(function MaintenanceBanner() {
  const { settings } = useSettings()
  if (!settings.maintenanceMode) return null
  const msg = settings.maintenanceMessage || 'Aplikasi sedang dalam mode maintenance. Beberapa fitur mungkin tidak tersedia.'
  return (
    <div
      role="status"
      className="sticky top-0 z-[55] flex items-center gap-2 border-b border-amber-300 bg-amber-100 px-4 py-2 text-[12.5px] text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-200"
    >
      <AlertTriangle size={14} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{msg}</span>
    </div>
  )
})
