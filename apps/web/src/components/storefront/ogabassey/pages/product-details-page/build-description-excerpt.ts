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
  const knownLabelMatch = trimmed.match(
    /^(?:storage|ram|color|colour|condition|platform|display|battery|camera|processor|gpu|sim\s*type|connectivity|warranty):\s*(.+)$/i
  );
  if (knownLabelMatch) {
    const value = knownLabelMatch[1].trim();
    if (!value) return true;

    return isSpecValue(value);
  }

  // Unmatched catalog labels such as Brand: Apple route through isSpecValue.
  const catalogLabelMatch = trimmed.match(/^([A-Za-z][\w\s-]*):\s*(.+)$/);
  if (catalogLabelMatch) {
    const value = catalogLabelMatch[2].trim();
    if (!value) return true;

    return isSpecValue(value);
  }

  return false;
}

function isProductTitleSentence(sentence: string): boolean {
  const trimmed = sentence.replace(/[.!?]+$/, '').trim();
  if (!trimmed) {
    return false;
  }

  const words = trimmed.split(/\s+/).filter(Boolean);

  // Longer sentences are narrative prose, not bare catalog titles.
  if (words.length > 12) {
    return false;
  }

  // Sentence grammar or common narrative words — not a demonstrable product title.
  if (
    /\b(for|with|in|and|to|from|by|at|the|a|an|your|our|its|this|these|those|is|are|was|were|has|have|built|crafted|designed|engineered|delivers|features|provides|offers|experience|enjoy|capture|lasts|see|gives|lets|forged|featuring|every|when|where|because|sentence|paragraph|description|here|there|first|second|third|fourth|fifth)\b/i.test(
      trimmed
    )
  ) {
    return false;
  }

  if (/[®™©]/.test(trimmed)) {
    return true;
  }

  // Catalog model lines such as iPhone 15 Pro Max or Dell XPS 16 9650.
  if (
    /\b[A-Za-z][\w&-]*\s+\d+[A-Za-z]?(?:\s+(?:Pro|Max|Plus|Ultra|Mini|Air|SE|XL|Lite|Edge|Note|Tab|Book|Pad|Watch|Buds|Series)\b)*/i.test(
      trimmed
    ) ||
    /\b[A-Z][\w&-]*\s+[A-Z]{2,}\b/.test(trimmed)
  ) {
    return true;
  }

  const hasModelDigits = /\b\d{2,}\b/.test(trimmed);
  const nameLikeTokens = words.filter((word) =>
    /^(?:[A-Z][\w-]*|[A-Z]{2,}|\d[\w.]*)$/.test(word)
  ).length;

  if (hasModelDigits && nameLikeTokens >= 2 && words.length <= 8) {
    return true;
  }

  return false;
}

function filterProseText(text: string): string {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length > 0 && !isSpecSentence(s) && !isProductTitleSentence(s)
    );
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
