function isSpecSentence(sentence: string): boolean {
  return /^(storage|ram|color|colour|condition|platform|display|battery|camera|processor|gpu|sim\s*type|connectivity|availability\s*note|note|notes|warranty):\s*/i.test(
    sentence.trim()
  );
}

export function buildDescriptionExcerpt(description: string) {
  if (!description) return '';

  const worthMatch = description.match(
    /<h2[^>]*>Why[^<]*Worth[^<]*<\/h2>\s*<p>([^<]+)/i
  );

  if (worthMatch?.[1]) {
    const benefitText = worthMatch[1].trim();
    return benefitText.length > 200
      ? `${benefitText.substring(0, 200)}...`
      : benefitText;
  }

  const secondParagraph = description.match(/<\/p>\s*<p>([^<]+)/);
  if (secondParagraph?.[1]) {
    const text = secondParagraph[1].trim();
    if (!isSpecSentence(text)) {
      return text.length > 200 ? `${text.substring(0, 200)}...` : text;
    }
  }

  const plainText = description
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const allSentences = plainText.split(/(?<=[.!?])\s+/);
  const nonSpecSentences = allSentences.filter(
    (s) => s.trim().length > 0 && !isSpecSentence(s)
  );

  if (
    nonSpecSentences.length === 0 ||
    (nonSpecSentences.length === 1 &&
      nonSpecSentences[0].split(/\s+/).length <= 5)
  ) {
    return '';
  }

  const excerpt = nonSpecSentences.slice(2, 5).join(' ');

  if (excerpt) {
    return excerpt.length > 200 ? `${excerpt.substring(0, 200)}...` : excerpt;
  }

  const joined = nonSpecSentences.join(' ');
  return joined.length > 200 ? `${joined.substring(0, 200)}...` : joined;
}
