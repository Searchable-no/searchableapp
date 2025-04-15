// In-memory storage for transcriptions
// In a production app, this would be replaced with a database or another persistence mechanism

interface Segment {
  text: string;
  start: number;
  end: number;
  speaker: string;
  type?: string;
}

interface SpeakerContribution {
  speaker: string;
  text: string;
  segments: Segment[];
}

interface MinuteSegment {
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

// In-memory storage
const transcriptionResults: Map<string, TranscriptionResult> = new Map();

/**
 * Store a transcription result
 */
export function setTranscriptionResult(id: string, result: TranscriptionResult): void {
  transcriptionResults.set(id, result);
  console.log(`Stored result for ${id}, status: ${result.status}`);
}

/**
 * Retrieve a transcription result
 */
export function getTranscriptionResult(id: string): TranscriptionResult | null {
  const result = transcriptionResults.get(id);
  return result || null;
}

/**
 * Check if a transcription result exists
 */
export function hasTranscriptionResult(id: string): boolean {
  return transcriptionResults.has(id);
}

/**
 * Delete a transcription result
 */
export function deleteTranscriptionResult(id: string): boolean {
  return transcriptionResults.delete(id);
}

/**
 * Get all transcription IDs
 */
export function getAllTranscriptionIds(): string[] {
  return Array.from(transcriptionResults.keys());
}

/**
 * Clear all transcription results (for testing)
 */
export function clearAllTranscriptionResults(): void {
  transcriptionResults.clear();
} 