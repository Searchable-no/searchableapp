// In-memory storage for transcriptions that works across API routes
// In a production app, this would be replaced with a database

export interface Segment {
  text: string;
  start: number;
  end: number;
  speaker: string;
  type?: string;
}

export interface SpeakerContribution {
  speaker: string;
  text: string;
  segments: Segment[];
}

export interface MinuteSegment {
  text: string;
  start: number;
  end: number;
  speaker: string;
  speakerContributions: SpeakerContribution[];
}

export interface TranscriptionResult {
  text: string;
  status: 'completed' | 'processing' | 'failed' | 'unknown';
  language?: string;
  segments?: Segment[];
  minuteSegments?: MinuteSegment[];
  error?: string;
  message?: string;
  event?: string;
  content?: Record<string, unknown>;
}

// Define our own global namespace to avoid conflicts
declare global {
  var transcriptionStore: {
    results: Map<string, TranscriptionResult>;
  };
}

// Initialize the global store if it doesn't exist
if (!global.transcriptionStore) {
  global.transcriptionStore = {
    results: new Map<string, TranscriptionResult>()
  };
}

/**
 * Store a transcription result
 */
export function setTranscriptionResult(id: string, result: TranscriptionResult): void {
  global.transcriptionStore.results.set(id, result);
  console.log(`Stored result for ${id}, status: ${result.status}`);
}

/**
 * Retrieve a transcription result
 */
export function getTranscriptionResult(id: string): TranscriptionResult | null {
  const result = global.transcriptionStore.results.get(id);
  return result || null;
}

/**
 * Check if a transcription result exists
 */
export function hasTranscriptionResult(id: string): boolean {
  return global.transcriptionStore.results.has(id);
}

/**
 * Delete a transcription result
 */
export function deleteTranscriptionResult(id: string): boolean {
  return global.transcriptionStore.results.delete(id);
}

/**
 * Get all transcription IDs
 */
export function getAllTranscriptionIds(): string[] {
  return Array.from(global.transcriptionStore.results.keys());
}

/**
 * Clear all transcription results (for testing)
 */
export function clearAllTranscriptionResults(): void {
  global.transcriptionStore.results.clear();
} 