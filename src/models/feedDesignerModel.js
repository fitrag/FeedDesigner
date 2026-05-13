export const formats = ['square 1:1', 'portrait 4:5', 'story 9:16']

/** Languages the AI can render on-canvas text in. Label is what users see,
 * the value is the bare English name fed to the prompt. Adding a new entry
 * is a one-liner — no other code changes needed. */
export const languages = [
  { value: 'Indonesian', label: 'Bahasa Indonesia' },
  { value: 'English',    label: 'English' },
  { value: 'Malay',      label: 'Bahasa Melayu' },
  { value: 'Javanese',   label: 'Bahasa Jawa' },
  { value: 'Sundanese',  label: 'Bahasa Sunda' },
  { value: 'Arabic',     label: 'العربية' },
  { value: 'Chinese',    label: '中文' },
  { value: 'Japanese',   label: '日本語' },
  { value: 'Korean',     label: '한국어' },
  { value: 'Spanish',    label: 'Español' },
  { value: 'French',     label: 'Français' },
  { value: 'German',     label: 'Deutsch' },
  { value: 'Portuguese', label: 'Português' },
  { value: 'Thai',       label: 'ภาษาไทย' },
  { value: 'Vietnamese', label: 'Tiếng Việt' },
]

export const defaultStudioForm = {
  brandName: '',
  topic: '',
  audience: 'umum',
  colorPalette: '',
  format: 'square 1:1',
  captionTone: 'professional, concise, persuasive',
  extraNotes: '',
  mode: 'single',
  totalSlides: 3,
  language: 'Indonesian',
}

export const modeOptions = ['single', 'carousel']
export const slideCountOptions = ['2', '3', '4', '5', '6', '7', '8', '9', '10']
