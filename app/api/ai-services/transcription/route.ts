import { NextResponse } from 'next/server';
import { Segment, TranscriptionResult, setTranscriptionResult, MinuteSegment, hasTranscriptionResult, getAllTranscriptionIds } from './store';

// Define types for ElevenLabs word structure
interface ElevenLabsWord {
  text: string;
  type: 'word' | 'spacing' | 'audio_event';
  start: number;
  end: number;
  speaker_id?: string;
  characters?: Array<{
    text: string;
    start: number;
    end: number;
  }>;
}

// Merge segments into 1-minute intervals
function mergeSegmentsIntoMinuteIntervals(segments: Segment[]): MinuteSegment[] {
  if (!segments || !segments.length) return [];
  
  // Sort segments by start time
  const sortedSegments = [...segments].sort((a, b) => a.start - b.start);
  
  // Group segments by minute
  const minuteGroups = sortedSegments.reduce<Record<number, Segment[]>>((groups, segment) => {
    // Round down to nearest minute (in seconds)
    const minuteMark = Math.floor(segment.start / 60) * 60;
    
    // Create or add to group
    if (!groups[minuteMark]) {
      groups[minuteMark] = [];
    }
    groups[minuteMark].push(segment);
    
    return groups;
  }, {});
  
  // Helper function to clean up text by adding proper spacing
  const cleanText = (text: string): string => {
    // Add space after punctuation if missing
    return text
      .replace(/\.(\S)/g, '. $1')
      .replace(/\,(\S)/g, ', $1')
      .replace(/\?(\S)/g, '? $1')
      .replace(/\!(\S)/g, '! $1')
      .replace(/  +/g, ' ')
      .trim();
  };
  
  // Helper function to join text with improved sentence flow
  const joinSpeakerText = (segments: Segment[]): string => {
    if (!segments.length) return '';
    
    // If there's just one segment, return its text
    if (segments.length === 1) return cleanText(segments[0].text);
    
    // Join segments with better sentence structure
    let result = '';
    let previousEndsWithPunctuation = false;
    
    segments.forEach((segment, index) => {
      const text = segment.text.trim();
      const isAudioEvent = segment.type === 'audio_event';
      
      if (index === 0) {
        result = text;
        previousEndsWithPunctuation = /[.!?]$/.test(text);
      } else {
        // If it's an audio event, add it with parentheses
        if (isAudioEvent) {
          result += ` (${text})`;
        }
        // If previous segment ends with punctuation, or current starts with uppercase, add space
        else if (previousEndsWithPunctuation || /^[A-Z]/.test(text)) {
          result += ' ' + text;
        } else {
          // Otherwise, try to join more naturally
          result += (result.endsWith(' ') ? '' : ' ') + text;
        }
        previousEndsWithPunctuation = /[.!?]$/.test(text);
      }
    });
    
    return cleanText(result);
  };
  
  // Convert groups to merged segments
  const mergedSegments = Object.entries(minuteGroups).map(([minuteStr, groupSegments]) => {
    const minute = parseInt(minuteStr);
    const nextMinute = minute + 60;
    
    // Group segments by speaker within this minute
    const segments = groupSegments;
    const speakerSegments: Record<string, Segment[]> = {};
    
    // Group text by speakers
    segments.forEach(segment => {
      const speakerKey = `speaker_${segment.speaker}`;
      
      if (!speakerSegments[speakerKey]) {
        speakerSegments[speakerKey] = [];
      }
      speakerSegments[speakerKey].push(segment);
    });
    
    // Create an array of speaker contributions within this minute
    const speakerContributions = Object.entries(speakerSegments).map(([speakerKey, speakerSegmentGroup]) => {
      const speakerName = speakerKey.replace('speaker_', '');
      
      // Combine all text from this speaker with better sentence structure
      const combinedText = joinSpeakerText(speakerSegmentGroup);
        
      return {
        speaker: speakerName,
        text: combinedText,
        segments: speakerSegmentGroup
      };
    });
    
    // Create a new segment that spans the minute
    return {
      text: joinSpeakerText(segments),
      start: minute,
      end: nextMinute,
      speaker: segments[0].speaker, // Use speaker from first segment
      speakerContributions: speakerContributions
    };
  });
  
  return mergedSegments;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Create a new FormData for ElevenLabs
    const elevenLabsFormData = new FormData();
    elevenLabsFormData.append('file', file);
    elevenLabsFormData.append('model_id', process.env.ELEVENLABS_MODEL_ID || 'scribe_v1');
    // Optionally set language_code for Norwegian
    elevenLabsFormData.append('language_code', 'no');
    // Enable speaker diarization
    elevenLabsFormData.append('diarize', 'true');
    // Set word-level timestamps
    elevenLabsFormData.append('timestamps_granularity', 'word');
    // Enable audio event tagging
    elevenLabsFormData.append('tag_audio_events', 'true');

    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY || '',
        'Accept': 'application/json'
      },
      body: elevenLabsFormData,
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('ElevenLabs API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        apiKey: process.env.ELEVENLABS_API_KEY ? 'Present' : 'Missing',
      });
      throw new Error(`Failed to initiate transcription: ${response.status} ${response.statusText} - ${errorData}`);
    }

    const transcriptionResult = await response.json();
    console.log('ElevenLabs Response:', transcriptionResult);

    // Process the direct response from ElevenLabs
    // Since it returns the result directly rather than a job ID, we'll generate our own ID
    const transcriptionId = `el_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Process the words from ElevenLabs into segments
    const processedSegments: Segment[] = [];
    let currentSegment: Segment | null = null;
    let currentSpeaker: string | undefined = undefined;
    
    if (transcriptionResult.words) {
      // Filter out non-word items (like spacing)
      const words = transcriptionResult.words.filter((word: ElevenLabsWord) => 
        word.type === 'word' || word.type === 'audio_event'
      );
      
      // Process each word
      for (const word of words as ElevenLabsWord[]) {
        // If speaker changed or if this is the first word, create a new segment
        if (word.speaker_id !== currentSpeaker || !currentSegment) {
          // Save previous segment if exists
          if (currentSegment) {
            processedSegments.push(currentSegment);
          }
          
          // Create new segment
          currentSegment = {
            text: word.text,
            start: word.start,
            end: word.end,
            speaker: word.speaker_id || 'unknown',
            type: word.type
          };
          currentSpeaker = word.speaker_id;
        } else {
          // Add to existing segment
          if (word.type === 'audio_event') {
            // For audio events, add them with special formatting
            currentSegment.text += ` (${word.text})`;
          } else {
            // For regular words, add with space
            currentSegment.text += ' ' + word.text;
          }
          currentSegment.end = word.end;
        }
      }
      
      // Add the last segment
      if (currentSegment) {
        processedSegments.push(currentSegment);
      }
    }
    
    // Create a structure similar to the one expected by the frontend
    const result: TranscriptionResult = {
      text: transcriptionResult.text || '',
      status: 'completed',
      language: transcriptionResult.language_code || 'no',
      segments: processedSegments,
      minuteSegments: mergeSegmentsIntoMinuteIntervals(processedSegments)
    };

    // Store the result directly
    setTranscriptionResult(transcriptionId, result);
    
    // Debug log for storage
    console.log('Stored transcription with ID:', transcriptionId);
    console.log('Verification - hasTranscriptionResult:', hasTranscriptionResult(transcriptionId));
    const allIds = getAllTranscriptionIds();
    console.log('All stored transcription IDs:', allIds);
    console.log('Total stored transcriptions:', allIds.length);

    return NextResponse.json({ 
      message: 'Transcription completed',
      transcriptionId: transcriptionId,
      status: 'completed'
    });

  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process transcription' },
      { status: 500 }
    );
  }
} 