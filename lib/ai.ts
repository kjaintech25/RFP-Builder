import OpenAI from 'openai'

export type RetrievedChunk = {
  answer_id: string
  question_text: string
  answer_text: string
  similarity: number
}

export type DraftResult = {
  draft: string
  source_answer_ids: string[]
}

function buildClient(): OpenAI {
  const provider = process.env.AI_PROVIDER ?? 'ollama'

  if (provider === 'openrouter') {
    return new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY ?? '',
    })
  }

  return new OpenAI({
    baseURL: (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434') + '/v1',
    apiKey: 'ollama',
  })
}

function getModel(): string {
  const provider = process.env.AI_PROVIDER ?? 'ollama'
  if (provider === 'openrouter') {
    return process.env.OPENROUTER_MODEL ?? 'mistralai/mixtral-8x7b-instruct'
  }
  return process.env.OLLAMA_MODEL ?? 'llama3'
}

function buildSystemPrompt(chunks: RetrievedChunk[]): string {
  const chunkText = chunks
    .map((c) => `[ID: ${c.answer_id}]\nQ: ${c.question_text}\nA: ${c.answer_text}`)
    .join('\n\n')

  return `You are an RFP response assistant for an OCIO financial services firm.

STRICT RULES — you MUST follow these without exception:
1. You may ONLY use the approved answer excerpts provided below to draft your response.
2. Do NOT use any knowledge from your training data, general knowledge, or the internet.
3. Do NOT invent, extrapolate, or add any information not present in the excerpts.
4. Every sentence you write must cite the source answer ID in brackets, e.g. [ID: <uuid>].
5. If the provided excerpts do not contain sufficient information, respond with exactly:
   INSUFFICIENT_CONTEXT: <brief reason why the excerpts do not cover this question>
6. Never fabricate statistics, names, certifications, dates, or financial figures.

APPROVED ANSWER EXCERPTS:
${chunkText}`
}

function extractSourceIds(text: string): string[] {
  const pattern = /\[ID:\s*([a-f0-9-]{36})\]/gi
  const ids = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    ids.add(match[1])
  }
  return Array.from(ids)
}

export async function generateDraft(
  question: string,
  retrievedChunks: RetrievedChunk[]
): Promise<DraftResult> {
  if (retrievedChunks.length === 0) {
    return {
      draft: 'INSUFFICIENT_CONTEXT: No approved answers were found in the library for this question.',
      source_answer_ids: [],
    }
  }

  const client = buildClient()
  const model = getModel()

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: buildSystemPrompt(retrievedChunks) },
      { role: 'user', content: `Draft a response to this RFP question:\n\n${question}` },
    ],
    temperature: 0,
  })

  const draft = completion.choices[0]?.message?.content ?? 'INSUFFICIENT_CONTEXT: No response generated.'
  const source_answer_ids = extractSourceIds(draft)

  return { draft, source_answer_ids }
}
