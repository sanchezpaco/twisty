// Caption text to markup: "lead|main" puts a quieter first sentence on its own line, *words* take the accent.
const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const accent = (s) => escape(s).replace(/\*([^*]+)\*/g, '<em class="accent">$1</em>')

export function captionHtml(text) {
  const parts = text.split('|')
  const main = accent(parts.at(-1))
  return parts.length > 1 ? `<span class="lead">${accent(parts[0])}</span>${main}` : main
}

/** The caption as a reader sees it, for the report. */
export const captionPlain = (text) => text.replace(/\|/g, ' ').replace(/\*/g, '')
