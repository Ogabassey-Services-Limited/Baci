function isSpecValue(value: string): boolean {
  const trimmed = value.replace(/[.!?]+$/, '').trim();
  const words = trimmed.split(/\s+/).filter(Boolean);

  // Short values (<= 3 words) without prose grammatical connectors are specs (e.g. "Platinum", "Open Box", "128GB")
  const hasProseConnectors =
    /\b(the|a|an|your|our|its|this|these|every|each|all|with|for|in|on|at|from|to|into|through|across|without|and|or|so|than|as|you|we|it)\b/i.test(
      trimmed
    );

  if (words.length <= 3 && !hasProseConnectors) {
    return true;
  }

  // Values with spec list delimiters (e.g. "48MP Main | 12MP Ultra Wide" or "12MP + 12MP")
  if (/[|/+]/.test(trimmed) && /\d+\s*(?:mp|gb|tb|hz|w|mah|v)/i.test(trimmed)) {
    return true;
  }

  // Hardware measurement / technical token detection
  const hasHardwareTokens =
    /\b(?:\d+\s*(?:gb|tb|mb|ghz|mhz|mah|wh|w|v|mp|fps|hz|inch|inches|"|'|nm|core|cores|bit)|nvme|pcie|ssd|hdd|ddr\d*|lpddr\d*|amoled|oled|retina|ips|lcd|esim|nano-?sim|snapdragon|bionic|geforce|radeon|intel|ryzen|upgradable|onboard)\b/i.test(
      trimmed
    );

  if (hasHardwareTokens) {
    // Pure spec listing or short technical spec phrase
    if (!hasProseConnectors || words.length <= 6) {
      return true;
    }
  }

  // If it has prose connectors and sufficient length, it is marketing prose
  if (hasProseConnectors && words.length >= 4) {
    return false;
  }

  return !hasProseConnectors;
}

function isSpecSentence(sentence: string): boolean {
  const trimmed = sentence.trim();

  // Pure metadata notice / disclaimer lines are always informational
  if (
    /^(?:availability\s*note|note|notes|disclaimer|disclaimers|notice|warranty\s*note):\s*/i.test(
      trimmed
    )
  ) {
    return true;
  }

  // Feature lines like "Storage: 2TB SSD" vs "Display: See every detail..."
  const match = trimmed.match(
    /^(?:storage|ram|color|colour|condition|platform|display|battery|camera|processor|gpu|sim\s*type|connectivity|warranty):\s*(.+)$/i
  );
  if (!match) {
    return false;
  }

  const value = match[1].trim();
  if (!value) return true;

  return isSpecValue(value);
}

function isProductTitleSentence(sentence: string): boolean {
  const trimmed = sentence.replace(/[.!?]+$/, '').trim();
  const words = trimmed.split(/\s+/).filter(Boolean);

  // Product titles and model fragments are short noun phrases without prose verbs,
  // prepositions, determiners, or descriptive narrative words.
  if (words.length > 8) {
    return false;
  }

  const hasProseGrammarOrVerbs =
    /\b(for|with|in|and|to|from|by|at|the|a|an|your|our|its|this|these|is|are|has|have|built|crafted|designed|engineered|delivers|features|provides|offers|experience|enjoy|capture|lasts|see|gives|lets|premium|perfect|sleek|durable|portable|compact|fast|powerful|great|reliable|quality|everyday|use|official|genuine|performance|battery|speed|life|system|power|action|button|groundbreaking|incredible)\b/i.test(
      trimmed
    );

  return !hasProseGrammarOrVerbs;
}

function filterProseText(text: string): string {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !isSpecSentence(s));
  return sentences.join(' ');
}

export function buildDescriptionExcerpt(description: string) {
  if (!description) return '';

  const worthMatch = description.match(
    /<h2[^>]*>Why[^<]*Worth[^<]*<\/h2>\s*<p>([^<]+)/i
  );

  if (worthMatch?.[1]) {
    const benefitText = filterProseText(worthMatch[1].trim());
    if (benefitText) {
      return benefitText.length > 200
        ? `${benefitText.substring(0, 200)}...`
        : benefitText;
    }
  }

  const secondParagraph = description.match(/<\/p>\s*<p>([^<]+)/);
  if (secondParagraph?.[1]) {
    const text = filterProseText(secondParagraph[1].trim());
    if (text) {
      return text.length > 200 ? `${text.substring(0, 200)}...` : text;
    }
  }

  const plainText = description
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const allSentences = plainText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const nonSpecSentences = allSentences.filter((s) => !isSpecSentence(s));
  if (nonSpecSentences.length === 0) {
    return '';
  }

  const proseSentences = nonSpecSentences.filter(
    (s) => !isProductTitleSentence(s)
  );
  if (proseSentences.length === 0) {
    return '';
  }

  // When 3+ sentences exist in plain text, sentences 1-2 are typically product title/header lines.
  // Prefer taking sentences 3-5 (index 2-4) filtered of specs and bare titles.
  if (allSentences.length >= 3) {
    const candidateSlice = allSentences
      .slice(2, 5)
      .filter((s) => !isSpecSentence(s) && !isProductTitleSentence(s));
    const excerpt = candidateSlice.join(' ');
    if (excerpt) {
      return excerpt.length > 200 ? `${excerpt.substring(0, 200)}...` : excerpt;
    }
  }

  const joined = proseSentences.join(' ');
  return joined.length > 200 ? `${joined.substring(0, 200)}...` : joined;
}
