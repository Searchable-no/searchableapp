import OpenAI from 'openai'
import { prisma } from './prisma'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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
    const combinedText = `${title}\n${content}`.slice(0, 8000) // Limit text length
    const embedding = await generateEmbedding(combinedText)

    // Try to find existing record
    const existingRecord = await prisma.indexedContent.findFirst({
      where: {
        userId,
        sourceId
      }
    })

    if (existingRecord) {
      // Update existing record
      await prisma.$executeRaw`
        UPDATE "IndexedContent"
        SET 
          title = ${title},
          content = ${content},
          url = ${url},
          type = ${type},
          source = ${source},
          "lastModified" = ${lastModified},
          embedding = ${embedding}::vector,
          "updatedAt" = NOW()
        WHERE id = ${existingRecord.id}
      `
      console.log(`Successfully updated content: ${title}`)
      return existingRecord
    } else {
      // Create new record using raw SQL to handle the vector field
      const id = await prisma.$queryRaw`
        INSERT INTO "IndexedContent" (
          id,
          "userId",
          "sourceId",
          title,
          content,
          url,
          type,
          source,
          "lastModified",
          embedding,
          "createdAt",
          "updatedAt"
        ) VALUES (
          gen_random_uuid(),
          ${userId},
          ${sourceId},
          ${title},
          ${content},
          ${url},
          ${type},
          ${source},
          ${lastModified},
          ${embedding}::vector,
          NOW(),
          NOW()
        )
        RETURNING id
      `
      console.log(`Successfully created content: ${title}`)
      return { id: id[0].id }
    }
  } catch (error: any) {
    console.error(`Error indexing content: ${title}`, error)
    if (error.code) {
      console.error(`Error code: ${error.code}`)
    }
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

  // Perform vector similarity search using dot product
  const results = await prisma.$queryRaw<SearchResult[]>`
    SELECT 
      id,
      title,
      content,
      url,
      type,
      source,
      "lastModified",
      1 - (embedding <=> ${queryEmbedding}::vector) as similarity
    FROM "IndexedContent"
    WHERE "userId" = ${userId}
    ORDER BY similarity DESC
    LIMIT ${limit};
  `

  return results
} 