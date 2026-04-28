import OpenAI from 'openai'

export interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>
}

export class OpenAIEmbedding implements EmbeddingProvider {
  private client: OpenAI

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
      input: text,
    })

    return response.data[0].embedding
  }
}

export class OpenRouterEmbedding implements EmbeddingProvider {
  private client: OpenAI

  constructor() {
    this.client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
    })
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: process.env.OPENROUTER_EMBEDDING_MODEL || 'integrations/openai/text-embedding-3-small',
      input: text,
    })

    return response.data[0].embedding
  }
}

export function createEmbeddingProvider(): EmbeddingProvider {
  const provider = process.env.EMBEDDING_PROVIDER ||
    (process.env.OPENROUTER_API_KEY ? 'openrouter' : 'openai')

  switch (provider) {
    case 'openai':
      return new OpenAIEmbedding()
    case 'openrouter':
      return new OpenRouterEmbedding()
    default:
      throw new Error(`Unsupported embedding provider: ${provider}`)
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const provider = createEmbeddingProvider()
  return provider.generateEmbedding(text)
}