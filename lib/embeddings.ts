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
  normalizedContent: string
  url: string // Store null as empty string for Pinecone compatibility
  type: 'email' | 'document'
  source: 'microsoft' | 'google'
  lastModified: string
}

export async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    encoding_format: "float",
    dimensions: 1536,
  })
  
  return response.data[0].embedding
}

// Helper function to normalize Norwegian text
export function normalizeNorwegianText(text: string): string {
  // Convert common Norwegian characters to their base form for better matching
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[æ]/g, 'ae')
    .replace(/[ø]/g, 'o')
    .replace(/[å]/g, 'a')
    .replace(/\s+/g, ' ')
    .trim();
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
  console.log('Starting indexing with params:', {
    userId,
    sourceId,
    title,
    type,
    source,
    lastModified: lastModified.toISOString()
  })
  
  try {
    // Generate embedding for the content
    console.log('Generating embedding...')
    const combinedText = `${title}\n${content}`.slice(0, 8000) // Limit text length
    
    // Store both original and normalized versions
    const normalizedText = normalizeNorwegianText(combinedText)
    const embedding = await getEmbedding(normalizedText)
    
    console.log('Generated embedding of length:', embedding.length)

    // Store in Pinecone with truncated metadata
    const metadata: PineconeMetadata = {
      userId,
      sourceId,
      title: title.slice(0, 1000), // Limit title length
      content: content.slice(0, 20000), // Limit content length to stay under 40KB
      normalizedContent: normalizedText.slice(0, 8000), // Limit normalized content
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
    
    console.log('Upserting to Pinecone with ID:', upsertRequest.id)
    console.log('Metadata:', metadata)
    
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
  const queryEmbedding = await getEmbedding(query)

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