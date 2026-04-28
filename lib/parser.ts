import OpenAI from 'openai'
import { AI_PARSE_PROMPT } from './parse-prompt'

export type ParsedQuestion = {
  question_text: string
  section_context: string
  order_index: number
  parent_id?: string | null
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

function parseQuestionLine(line: string): { isQuestion: boolean; isSubQuestion: boolean; subQuestionText?: string } {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length < 10) return { isQuestion: false, isSubQuestion: false }

  // Check for sub-questions (a., b., c., i., ii., iii.)
  const subQuestionMatch = trimmed.match(/^([a-z][.)]|[ivx]+\.|[IVX]+\.)\s+(.*)$/i)
  if (subQuestionMatch) {
    return {
      isQuestion: true,
      isSubQuestion: true,
      subQuestionText: subQuestionMatch[2].trim(),
    }
  }

  // Check for main questions
  if (trimmed.endsWith('?')) return { isQuestion: true, isSubQuestion: false }

  const lower = trimmed.toLowerCase()
  if (QUESTION_TRIGGERS.some((t) => lower.startsWith(t))) return { isQuestion: true, isSubQuestion: false }

  // Numbered patterns: "1.", "1)", "Q1:", "Q1."
  if (/^(?:[0-9]{1,3}[.)]\s|Q[0-9]+[:.]\s)/i.test(trimmed)) return { isQuestion: true, isSubQuestion: false }

  return { isQuestion: false, isSubQuestion: false }
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
  let currentParentQuestion: { text: string; orderIndex: number } | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (isSectionHeader(trimmed)) {
      currentSection = trimmed
      currentParentQuestion = null
      continue
    }

    const question = parseQuestionLine(trimmed)
    if (question.isQuestion) {
      if (question.isSubQuestion && currentParentQuestion) {
        // This is a sub-question
        results.push({
          question_text: question.subQuestionText!,
          section_context: currentSection,
          order_index: orderIndex++,
          parent_id: currentParentQuestion.orderIndex.toString(),
        })
      } else {
        // This is a main question
        results.push({
          question_text: trimmed,
          section_context: currentSection,
          order_index: orderIndex++,
          parent_id: null,
        })
        currentParentQuestion = {
          text: trimmed,
          orderIndex: orderIndex - 1,
        }
      }
    } else {
      // Reset parent if we encounter a non-question line
      currentParentQuestion = null
    }
  }

  return results
}


async function parseWithAI(text: string): Promise<ParsedQuestion[]> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    console.warn('OPENROUTER_API_KEY not set, falling back to heuristic parsing')
    return extractFromText(text)
  }

  try {
    const client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
    })

    const completion = await client.chat.completions.create({
      model: process.env.OPENROUTER_MODEL ?? 'mistralai/mixtral-8x7b-instruct',
      messages: [
        { role: 'system', content: AI_PARSE_PROMPT },
        { role: 'user', content: text.slice(0, 24000) },
      ],
      temperature: 0,
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    // Strip any markdown code fences the model might add
    const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    const parsed = JSON.parse(cleaned) as {
      sections?: { section_title: string; questions: Array<{ text: string; sub_questions?: string[] }> }[]
    }

    if (!parsed.sections || parsed.sections.length === 0) {
      return extractFromText(text)
    }

    let orderIndex = 0
    const results: ParsedQuestion[] = []
    for (const section of parsed.sections) {
      const sectionTitle = section.section_title === 'Uncategorized' ? '' : (section.section_title ?? '')

      for (const q of section.questions ?? []) {
        const trimmed = q.text.trim()
        if (!trimmed) continue

        // Add parent question
        const parentOrderIndex = orderIndex++
        results.push({
          question_text: trimmed,
          section_context: sectionTitle,
          order_index: parentOrderIndex,
          parent_id: null,
        })

        // Add sub-questions if they exist
        if (q.sub_questions && q.sub_questions.length > 0) {
          for (const subQ of q.sub_questions) {
            const subTrimmed = subQ.trim()
            if (!subTrimmed) continue

            results.push({
              question_text: subTrimmed,
              section_context: sectionTitle,
              order_index: orderIndex++,
              parent_id: parentOrderIndex.toString(),
            })
          }
        }
      }
    }

    return results.length > 0 ? results : extractFromText(text)
  } catch (err) {
    console.warn('AI parsing failed, falling back to heuristic', err)
    return extractFromText(text)
  }
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

  // html used only to detect document structure; raw text sent to AI for full extraction
  void html

  return parseWithAI(text)
}

async function parsePdf(buffer: Buffer): Promise<ParsedQuestion[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse')
  const data = await pdfParse(buffer)
  return parseWithAI(data.text)
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

  return parseWithAI(lines.join('\n'))
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
  return parseWithAI(buffer.toString('utf-8'))
}
