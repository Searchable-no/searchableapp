-- Enable the vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the IndexedContent table
CREATE TABLE "IndexedContent" (
    id TEXT PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    url TEXT,
    type TEXT NOT NULL,
    source TEXT NOT NULL,
    "lastModified" TIMESTAMP(3) NOT NULL,
    embedding vector(1536),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT fk_user FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE,
    UNIQUE ("userId", "sourceId")
);

-- Create indexes
CREATE INDEX idx_indexed_content_user_id ON "IndexedContent"("userId");
CREATE INDEX idx_indexed_content_source_id ON "IndexedContent"("sourceId");

-- Create a function to calculate cosine similarity
CREATE OR REPLACE FUNCTION cosine_similarity(a vector, b vector)
RETURNS float
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN 1 - (a <=> b);
END;
$$; 