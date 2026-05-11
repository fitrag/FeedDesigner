/* Re-export from the split `dashboard/` folder. Keeps the import path used
 * by AppView (`./DashboardView.jsx`) stable while the real implementation
 * lives inside `dashboard/` split by responsibility:
 *   - index.jsx         orchestrator (data + routing between sub-pages)
 *   - DashboardPage.jsx overview page (hero + stats + recent)
 *   - DesignsPage.jsx   full gallery page
 *   - DetailModal.jsx   generation detail lightbox
 *   - shared.jsx        sidebar + cards + skeletons + formatters
 */
export { default } from './dashboard/index.jsx'
