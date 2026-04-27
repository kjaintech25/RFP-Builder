export type ParsedQuestion = {
  question_text: string
  section_context: string
  order_index: number
}

const QUESTION_TRIGGERS = [
  'please describe',
  'please explain',
  'please provide',
  'please detail',
  'explain how',
  'describe how',
  'describe your',
  'provide details',
  'provide an overview',
  'how does',
  'what is',
  'what are',
  'have you',
  'do you',
  'can you',
]

function isQuestion(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length < 10) return false
  if (trimmed.endsWith('?')) return true

  const lower = trimmed.toLowerCase()
  if (QUESTION_TRIGGERS.some((t) => lower.startsWith(t))) return true

  // Numbered patterns: "1.", "1)", "a.", "a)", "Q1:", "Q1."
  if (/^(?:[0-9]{1,3}[.)]\s|[a-z][.)]\s|Q[0-9]+[:.]\s)/i.test(trimmed)) return true

  return false
}

function isSectionHeader(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length < 3) return false
  // Exclude placeholder text — never treat "e.g." lines as headings
  if (/^e\.g\b/i.test(trimmed) || /^\(e\.g\./i.test(trimmed)) return false
  // ALL CAPS line
  if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed) && trimmed.length < 120) return true
  // Roman numeral or lettered section: "I.", "II.", "A.", "Section 1"
  if (/^(?:[IVX]+\.|[A-Z]\.|Section\s+[0-9]+)/i.test(trimmed)) return true
  return false
}

function extractFromText(text: string): ParsedQuestion[] {
  const lines = text.split('\n')
  const results: ParsedQuestion[] = []
  let currentSection = ''
  let orderIndex = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (isSectionHeader(trimmed)) {
      currentSection = trimmed
      continue
    }

    if (isQuestion(trimmed)) {
      results.push({
        question_text: trimmed,
        section_context: currentSection,
        order_index: orderIndex++,
      })
    }
  }

  return results
}

async function parseDocx(buffer: Buffer): Promise<ParsedQuestion[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require('mammoth')

  // Extract headings via HTML pass for section context
  const htmlResult = await mammoth.convertToHtml({ buffer })
  const html: string = htmlResult.value

  // Extract plain text
  const textResult = await mammoth.extractRawText({ buffer })
  const text: string = textResult.value

  // Parse headings from HTML to build section map
  const headingMatches = html.matchAll(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/gi)
  const headings: string[] = []
  for (const match of headingMatches) {
    // Strip inner HTML tags
    headings.push(match[1].replace(/<[^>]+>/g, '').trim())
  }

  return extractFromText(text)
}

async function parsePdf(buffer: Buffer): Promise<ParsedQuestion[]> {
  // Must use legacy build for Node.js (no browser worker)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf')
  pdfjsLib.GlobalWorkerOptions.workerSrc = ''

  const data = new Uint8Array(buffer)
  const doc = await pdfjsLib.getDocument({ data }).promise
  const textParts: string[] = []

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item: { str?: string }) => item.str ?? '')
      .join(' ')
    textParts.push(pageText)
  }

  return extractFromText(textParts.join('\n'))
}

async function parseXlsx(buffer: Buffer): Promise<ParsedQuestion[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx')
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const lines: string[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
    for (const row of rows) {
      for (const cell of row) {
        const val = String(cell ?? '').trim()
        if (val.length > 10) lines.push(val)
      }
    }
  }

  return extractFromText(lines.join('\n'))
}

export async function parseDocument(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<ParsedQuestion[]> {
  const lower = filename.toLowerCase()

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lower.endsWith('.docx')
  ) {
    return parseDocx(buffer)
  }

  if (mimeType === 'application/pdf' || lower.endsWith('.pdf')) {
    return parsePdf(buffer)
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    lower.endsWith('.xlsx')
  ) {
    return parseXlsx(buffer)
  }

  // Plain text fallback
  return extractFromText(buffer.toString('utf-8'))
}
