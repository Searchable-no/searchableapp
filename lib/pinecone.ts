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