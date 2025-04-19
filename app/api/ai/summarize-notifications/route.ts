import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Function to improve formatting of the AI response
function improveFormatting(text: string): string {
  // Ensure proper line breaks after headings
  let formatted = text.replace(/(###\s+.*?)(\s*)(\w)/g, '$1\n\n$3');
  
  // Ensure there are line breaks before lists
  formatted = formatted.replace(/([^\n])(\s*)(- \*\*)/g, '$1\n\n$3');
  
  // Ensure consistent spacing between list items
  formatted = formatted.replace(/(- .*?)(\s*)(\s*- )/g, '$1\n$3');
  
  // Ensure double line breaks between major sections
  formatted = formatted.replace(/(### .*?)(\s*)(### )/g, '$1\n\n\n$3');
  
  // Remove any triple or more consecutive line breaks
  formatted = formatted.replace(/\n{3,}/g, '\n\n');
  
  // Ensure proper spacing around bullet points
  formatted = formatted.replace(/(\n- )(.*?)(\n[^\-])/g, '\n- $2\n\n$3');

  return formatted;
}

export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json();
    const { notifications } = body;

    if (!notifications || !Array.isArray(notifications) || notifications.length === 0) {
      return NextResponse.json(
        { error: 'Invalid input: notifications must be a non-empty array' },
        { status: 400 }
      );
    }

    // Group notifications by sender or source for better organization
    const groupedNotifications = notifications.reduce((acc: Record<string, any[]>, curr) => {
      const key = curr.sender;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(curr);
      return acc;
    }, {});

    // Prepare the prompt with the notifications data
    const prompt = `
Du er en assisterende AI som lager strukturerte, nyttige sammendrag av brukerens uleste varsler.
Nedenfor er en liste med uleste varsler fra e-post, Teams-meldinger og Teams-kanaler.

Lag et velorganisert sammendrag av disse varslene som følger disse retningslinjene:
1. Start med en kort oppsummering/oversikt over alle varslene
2. Organiser deretter detaljerte varsler etter avsender/kilde
3. Bruk Markdown-formatering for å strukturere innholdet
4. Bruk overskrifter for hver kategori (f.eks. "### E-poster fra [Avsender]:")
5. Bruk punktlister med kulepunkter for hver melding
6. Inkluder datoen for hver melding i parentes (DD.MM.YYYY)
7. Svar på norsk
8. Sørg for riktige linjeskift mellom seksjoner og mellom overskrifter og innhold

Sammendraget skal bruke følgende struktur i Markdown MED LINJESKIFT mellom seksjoner:

### Oversikt

[Kort oppsummering av alle varslene - dette bør være en kortfattet oversikt]

### E-poster fra [Avsender]:

- **[Emne]** (DD.MM.YYYY) - [Kort beskrivelse av innhold]
- **[Emne]** (DD.MM.YYYY) - [Kort beskrivelse av innhold]

### [Andre typer varsler]:

- [Detaljert liste]

### Oppsummering

[En kortfattet oppsummering som trekker frem det viktigste]

VIKTIG: 
- Inkluder linjeskift etter overskrifter
- Legg til linjeskift mellom hvert hovedavsnitt
- Sørg for at punktlister kommer etter linjeskift
- Bruk dobbelt linjeskift mellom hovedseksjoner for tydeligere separasjon

VARSLER (gruppert etter avsender):
${Object.entries(groupedNotifications).map(([sender, items]) => `
${sender.toUpperCase()}:
${items.map((notification: any, index: number) => `
- Type: ${notification.type === 'email' ? 'E-post' : notification.type === 'teams_message' ? 'Teams-melding' : 'Teams-kanalmelding'}
  Emne/Tittel: ${notification.title}
  Innhold: ${notification.content}
  Tidspunkt: ${new Date(notification.timestamp).toLocaleString('no-NO')}
`).join('\n')}
`).join('\n')}

Brukeren har ${notifications.length} uleste varsler totalt.

VIKTIG: Start ALLTID med den korte oversikten som nevnt i instruksjonene.
Sørg for at output er velformatert Markdown med TYDELIGE linjeskift mellom seksjoner.
`;

    // Call the OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        { 
          role: 'system', 
          content: 'Du er en hjelpsom assistent som lager strukturerte, lett lesbare sammendrag av varsler. Du bruker korrekt Markdown-formatering med tydelige linjeskift og god struktur. Pass på å inkludere linjeskift mellom overskrifter og innhold for bedre lesbarhet.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 700
    });

    // Extract the generated summary and improve its formatting
    const rawSummary = response.choices[0]?.message?.content || 'Kunne ikke generere sammendrag.';
    const formattedSummary = improveFormatting(rawSummary);

    return NextResponse.json({ summary: formattedSummary });
  } catch (error) {
    console.error('Error in summarize-notifications API:', error);
    return NextResponse.json(
      { error: 'Failed to summarize notifications' },
      { status: 500 }
    );
  }
} 