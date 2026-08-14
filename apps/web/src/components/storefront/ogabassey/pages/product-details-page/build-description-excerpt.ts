function isSpecSentence(sentence: string): boolean {
  const trimmed = sentence.trim();
  const match = trimmed.match(
    /^(?:storage|ram|color|colour|condition|platform|display|battery|camera|processor|gpu|sim\s*type|connectivity|availability\s*note|note|notes|warranty):\s*(.+)$/i
  );
  if (!match) {
    return false;
  }

  const value = match[1].trim();
  if (!value) return true;

  // Feature headings with descriptive prose (e.g. "Camera: Capture every detail in vivid color.")
  // are marketing copy and should not be discarded as raw key-value technical specifications.
  const isFeatureProse =
    /\b(capture|captures|enjoy|enjoys|experience|experiences|deliver|delivers|power|powers|feature|features|featuring|provide|provides|built for|designed for|designed to|crafted|engineered|allow|allows|help|helps|bring|brings|ensure|ensures|stay|stays|transform|take|takes|protect|protects|unleash|perfect for|ready for|smoothly|effortlessly|stunning|vivid|crisp|immersive|breathtaking)\b/i.test(
      value
    );

  if (isFeatureProse) {
    return false;
  }

  return true;
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

  // If there are multiple sentences and the only non-spec sentence is the very first sentence (the title),
  // then the entire description is a spec dump with no marketing prose.
  if (
    allSentences.length > 1 &&
    nonSpecSentences.length === 1 &&
    nonSpecSentences[0] === allSentences[0]
  ) {
    return '';
  }

  // When 3+ sentences exist in plain text, sentences 1-2 are typically product title/header lines.
  // Prefer taking sentences 3-5 (index 2-4) filtered of specs.
  if (allSentences.length >= 3) {
    const candidateSlice = allSentences
      .slice(2, 5)
      .filter((s) => !isSpecSentence(s));
    const excerpt = candidateSlice.join(' ');
    if (excerpt) {
      return excerpt.length > 200 ? `${excerpt.substring(0, 200)}...` : excerpt;
    }
  }

  const joined = nonSpecSentences.join(' ');
  return joined.length > 200 ? `${joined.substring(0, 200)}...` : joined;
}
