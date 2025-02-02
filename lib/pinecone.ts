import { Pinecone } from '@pinecone-database/pinecone'

if (!process.env.PINECONE_API_KEY) {
  throw new Error('PINECONE_API_KEY is not set')
}

if (!process.env.PINECONE_ENVIRONMENT) {
  throw new Error('PINECONE_ENVIRONMENT is not set')
}

if (!process.env.PINECONE_INDEX_NAME) {
  throw new Error('PINECONE_INDEX_NAME is not set')
}

// Initialize the Pinecone client
const pc = new Pinecone()

// Get a reference to the index
const index = pc.index(process.env.PINECONE_INDEX_NAME!)

export { pc as pinecone, index }

export interface SearchParams {
  vector: number[];
  topK?: number;
  filter?: object;
}

export async function search({
  vector,
  topK = 10,
  filter = {}
}: SearchParams) {
  console.log('Executing Pinecone search with params:', {
    topK,
    filter,
    vectorLength: vector.length
  })

  // Perform semantic search using dense vectors
  const results = await index.query({
    vector,
    topK,
    filter,
    includeMetadata: true,
    includeValues: false
  });

  console.log(`Found ${results.matches?.length || 0} matches`)
  if (results.matches?.length) {
    console.log('First match metadata:', results.matches[0].metadata)
  }

  return results.matches || [];
}

export async function deleteAllVectors() {
  console.log('Deleting all vectors from Pinecone...')
  await index.deleteAll()
  console.log('Successfully deleted all vectors')
} 