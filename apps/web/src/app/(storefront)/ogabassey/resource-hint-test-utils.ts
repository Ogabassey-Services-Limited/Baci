export function hasRenderedResourceHintLink(
  html: string,
  attributes: Record<string, string>
): boolean {
  if (Object.keys(attributes).length === 0) {
    return false;
  }

  const template = document.createElement('template');
  template.innerHTML = html;
  const links = Array.from(template.content.querySelectorAll('link'));

  return links.some((link) =>
    Object.entries(attributes).every(
      ([name, value]) => link.getAttribute(name) === value
    )
  );
}
