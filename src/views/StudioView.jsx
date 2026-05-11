// Barrel re-export — keeps the existing lazy import path in AppView stable
// while the actual implementation lives in src/views/studio/ for maintainability.
export { default } from './studio/index.jsx'
