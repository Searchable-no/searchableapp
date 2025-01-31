import OpenAI from 'openai'
import { index as pineconeIndex } from './pinecone'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Define types for our metadata that will be stored in Pinecone
type PineconeMetadata = {
  [key: string]: string | number | boolean // Base type required by Pinecone
} & {
  userId: string
  sourceId: string
  title: string
  content: string
  url: string // Store null as empty string for Pinecone compatibility
  type: 'email' | 'document'
  source: 'microsoft' | 'google'
  lastModified: string
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    encoding_format: "float",
  })
  
  return response.data[0].embedding
}

export async function indexContent(
  userId: string,
  sourceId: string,
  title: string,
  content: string,
  url: string | null,
  type: 'email' | 'document',
  source: 'microsoft' | 'google',
  lastModified: Date
) {
  console.log(`Indexing content: ${title} (${sourceId})`)
  
  try {
    // Generate embedding for the content
    console.log('Generating embedding...')
    const combinedText = `${title}\n${content}`.slice(0, 8000) // Limit text length
    const embedding = await generateEmbedding(combinedText)
    console.log('Generated embedding of length:', embedding.length)

    // Store in Pinecone with all metadata
    console.log('Storing in Pinecone...')
    const metadata: PineconeMetadata = {
      userId,
      sourceId,
      title,
      content,
      url: url || '', // Convert null to empty string for Pinecone
      type,
      source,
      lastModified: lastModified.toISOString()
    }

    const upsertRequest = {
      id: `${userId}_${sourceId}`, // Create a unique ID combining userId and sourceId
      values: embedding,
      metadata
    }
    
    await pineconeIndex.upsert([upsertRequest])
    console.log('Successfully stored in Pinecone')

    console.log(`Successfully indexed content: ${title}`)
    return {
      id: upsertRequest.id,
      userId,
      sourceId,
      title,
      content,
      url,
      type,
      source,
      lastModified
    }
  } catch (error: unknown) {
    console.error(`Error indexing content: ${title}`, error)
    throw error
  }
}

interface SearchResult {
  id: string
  title: string
  content: string
  url: string | null
  type: 'email' | 'document'
  source: 'microsoft' | 'google'
  lastModified: Date
  similarity: number
}

export async function semanticSearch(userId: string, query: string, limit = 10): Promise<SearchResult[]> {
  // Generate embedding for the search query
  const queryEmbedding = await generateEmbedding(query)

  // Search vectors in Pinecone
  const searchResponse = await pineconeIndex.query({
    vector: queryEmbedding,
    filter: { userId },
    topK: limit,
    includeMetadata: true
  })

  // Return results directly from Pinecone metadata
  return searchResponse.matches.map(match => {
    // Cast to unknown first to satisfy TypeScript
    const metadata = match.metadata as unknown as PineconeMetadata
    return {
      id: match.id,
      title: metadata.title,
      content: metadata.content,
      url: metadata.url || null, // Convert empty string back to null
      type: metadata.type,
      source: metadata.source,
      lastModified: new Date(metadata.lastModified),
      similarity: match.score || 0
    }
  })
} 