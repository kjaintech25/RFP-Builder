import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { generateEmbedding } from '@/lib/embeddings'

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { answer_ids } = await request.json()

    if (!Array.isArray(answer_ids)) {
      return NextResponse.json({ error: 'answer_ids must be an array' }, { status: 400 })
    }

    // Get answers that need embeddings
    let query = supabase
      .from('answers')
      .select('id, answer_text, question_text')

    if (answer_ids.length > 0) {
      query = query.in('id', answer_ids)
    } else {
      // If no specific IDs provided, get all answers without embeddings
      query = query.is('embedding', null)
    }

    const { data: answers, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!answers || answers.length === 0) {
      return NextResponse.json({
        message: answer_ids.length > 0
          ? 'No answers found with provided IDs'
          : 'No answers found without embeddings',
        processed: 0
      })
    }

    let processed = 0
    const results = []

    // Process answers in batches to avoid rate limits
    const batchSize = 5
    for (let i = 0; i < answers.length; i += batchSize) {
      const batch = answers.slice(i, i + batchSize)

      for (const answer of batch) {
        try {
          // Combine question and answer text for better semantic search
          const fullText = `${answer.question_text} ${answer.answer_text}`

          // Generate embedding
          const embedding = await generateEmbedding(fullText)

          // Update answer with embedding
          const { error: updateError } = await supabase
            .from('answers')
            .update({
              embedding: embedding,
              updated_at: new Date().toISOString()
            })
            .eq('id', answer.id)

          if (updateError) {
            console.error(`Failed to update embedding for answer ${answer.id}:`, updateError)
            results.push({
              id: answer.id,
              success: false,
              error: updateError.message
            })
          } else {
            processed++
            results.push({ id: answer.id, success: true })
          }

          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (err) {
          console.error(`Failed to generate embedding for answer ${answer.id}:`, err)
          results.push({
            id: answer.id,
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error'
          })
        }
      }
    }

    // Log the embedding generation
    await supabase.from('approval_events').insert({
      entity_type: 'answer',
      entity_id: answers[0]?.id || null,
      action: 'batch_embedding_generation',
      actor_id: session.user.id,
      note: `Generated embeddings for ${processed}/${answers.length} answers`,
    })

    return NextResponse.json({
      message: `Completed embedding generation for ${processed}/${answers.length} answers`,
      processed,
      total: answers.length,
      results
    })

  } catch (error) {
    console.error('Embed generation error:', error)
    return NextResponse.json({
      error: 'Failed to generate embeddings',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
