export function buildDescriptionExcerpt(description: string) {
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
    return text.length > 200 ? `${text.substring(0, 200)}...` : text;
  }

  const plainText = description
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const excerpt = plainText.split(/(?<=[.!?])\s+/).slice(2, 5).join(' ');

  if (excerpt) {
    return excerpt.length > 200 ? `${excerpt.substring(0, 200)}...` : excerpt;
  }

  return plainText.length > 200 ? `${plainText.substring(0, 200)}...` : plainText;
}
