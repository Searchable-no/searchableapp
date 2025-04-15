# AI Tjenester

Dette er en samling av AI-tjenester for Searchable-plattformen. Tjenestene er bygget for å utnytte ulike AI-modeller for å løse spesifikke oppgaver.

## Transkribering

Transkribering av lydfiler til tekst med Elevenlabs.

### Funksjoner

- Last opp lydfiler (.mp3, .wav, .m4a)
- Transkribering med talerseparasjon (diarization)
- Oppsummering av transkripsjonen med OpenAI GPT-4o

### API-endepunkter

- `POST /api/ai-services/transcription` - Last opp og transkriber en lydfil
- `GET /api/ai-services/transcription/[id]/status` - Sjekk status på en transkribering
- `POST /api/ai-services/transcription/summarize` - Generer sammendrag av en transkripsjon

### Miljøvariabler

Tjenestene krever følgende miljøvariabler:

```
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_MODEL_ID=scribe_v1
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o
```

### Implementasjonsdetaljer

- Transkripsjonsresultater lagres i minnet. I produksjon bør dette erstattes med database-lagring.
- Elevenlabs API brukes for transkribering med talerseparasjon.
- OpenAI GPT-4o brukes for oppsummering av transkripsjoner.

### Utvidelsesmuligheter

- Lagre transkripsjoner i database
- Legge til flere språk for transkribering
- Legge til flere AI-tjenester (f.eks. oversettelse, text-to-speech)
