/**
 * String similarity and spelling correction utilities
 */

/**
 * Calculate Levenshtein edit distance between two strings
 * @param a First string
 * @param b Second string
 * @returns Edit distance (lower is more similar)
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate normalized similarity between two strings (0-1)
 * @param a First string
 * @param b Second string
 * @returns Similarity score (1 = identical, 0 = completely different)
 */
export function stringSimilarity(str1: string, str2: string): number {
  if (!str1 && !str2) return 1.0; // Both empty strings
  if (!str1 || !str2) return 0.0; // One empty string
  
  // Use shorter/longer assignment for optimization
  let shorter = str1;
  let longer = str2;
  if (str1.length > str2.length) {
    longer = str1;
    shorter = str2;
  }
  
  const longerLength = longer.length;
  // If the longer string is empty, both are ""
  if (longerLength === 0) {
    return 1.0;
  }
  
  // Calculate Levenshtein distance
  return (longerLength - levenshteinDistance(shorter, longer)) / longerLength;
}

/**
 * Find the most similar string from a list of candidates
 * @param query String to find matches for
 * @param candidates Array of potential matches
 * @param threshold Minimum similarity threshold (0-1)
 * @returns Best match or null if none meets the threshold
 */
export function findClosestMatch(
  query: string,
  candidates: string[],
  threshold = 0.7
): string | null {
  let bestMatch = null;
  let bestScore = threshold - 0.001; // Just below threshold
  
  for (const candidate of candidates) {
    const score = stringSimilarity(query, candidate);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }
  
  return bestMatch;
}

/**
 * Common word dictionary for specific applications
 */
export const commonWords: Record<string, string[]> = {
  // Norwegian real estate terminology
  'bolig': ['bolih', 'bolg', 'boliig', 'bolik', 'bollig'],
  'eiendom': ['eiendomm', 'eindom', 'eeindom', 'eiemdom'],
  'kontrakt': ['kontract', 'kontakt', 'kontraktt', 'contrakt'],
  'leie': ['leei', 'lie', 'leeie', 'liee'],
  'utleie': ['utlie', 'utleei', 'utlei', 'uutleie'],
  'leilighet': ['leiligheet', 'leilghet', 'leilighe', 'leilihet'],
  'hus': ['huus', 'huss', 'jus'],
  
  // English real estate terminology
  'apartment': ['apartmen', 'appartment', 'aparment', 'appartement'],
  'house': ['hous', 'housse', 'hoose', 'huose', 'hause'],
  'rental': ['renta', 'rentall', 'rentel', 'rentle', 'rentl'],
  'property': ['propety', 'proprety', 'properti', 'propertty', 'propporty'],
  'contract': ['contrct', 'contrat', 'contrac', 'kontrakt'],
  'agreement': ['agreemen', 'aggreement', 'agrement', 'agreemnt'],
  'lease': ['leas', 'leese', 'leeese', 'lese', 'leasse'],
  'tenant': ['tenent', 'tenaant', 'tennat', 'tennant'],
  'landlord': ['landord', 'landlordd', 'landlod', 'lanldord'],
  
  // Norwegian document/content search terms
  'dokument': ['dokumentt', 'dokumnet', 'dokoment', 'documnet', 'dokiment'],
  'fil': ['fli', 'fiil', 'fill', 'fyl'],
  'søk': ['sok', 'soek', 'søkk', 'søg', 'sok'],
  'tittel': ['titel', 'tittl', 'titell', 'tittel', 'titttel'],
  'innhold': ['inhold', 'inhold', 'inhold', 'inhold', 'inhold'],
  'tekst': ['text', 'tekts', 'texst', 'tektst', 'tekst'],
  'bilde': ['bildet', 'billd', 'bild', 'bilde', 'billde'],
  'vedlegg': ['vedleg', 'vedleggg', 'vedleg', 'vedlegg', 'vedlegget'],
  'forfatter': ['forfater', 'forfatter', 'forffater', 'författer', 'forfatr'],
  'dato': ['date', 'datto', 'daato', 'dato', 'datoo'],
  'kategorier': ['kategorier', 'kategories', 'kategorir', 'katagorier', 'katagorier'],
  'emne': ['emner', 'emmet', 'emmne', 'æmne', 'emmnet'],
  'epost': ['epost', 'email', 'eppost', 'e-post', 'eposst'],
  'melding': ['meldding', 'meling', 'meldnig', 'meldig', 'meldning'],
  'mappe': ['map', 'mapper', 'maape', 'mape', 'mapp'],
  'prosjekt': ['prosjct', 'projekkt', 'prosjket', 'projekt', 'prosject']
};

/**
 * Suggest a spelling correction for a query
 * @param query The query string to check
 * @returns Suggested correction or null if none needed
 */
export function suggestSpellingCorrection(query: string): string | null {
  // Don't suggest corrections for very short queries
  if (query.length < 3) return null;
  
  const lowerQuery = query.toLowerCase();
  
  // First check if the query is a known typo
  for (const [correctWord, typos] of Object.entries(commonWords)) {
    if (typos.includes(lowerQuery)) {
      return correctWord;
    }
  }
  
  // Then try to find a close match
  const allCorrectWords = Object.keys(commonWords);
  return findClosestMatch(lowerQuery, allCorrectWords, 0.8);
}

/**
 * Performs a fuzzy search to find matches for a query in a list of strings
 * 
 * @param query The search query
 * @param items Array of strings to search within
 * @param threshold Minimum similarity score (0-1) to consider a match
 * @returns Array of matches with their similarity scores, sorted by score
 */
export function fuzzySearch(query: string, items: string[], threshold = 0.6): Array<{item: string, score: number}> {
  if (!query) return [];
  
  const normalizedQuery = query.toLowerCase().trim();
  
  return items
    .map(item => ({
      item,
      score: stringSimilarity(normalizedQuery, item.toLowerCase().trim())
    }))
    .filter(result => result.score >= threshold)
    .sort((a, b) => b.score - a.score);
} 