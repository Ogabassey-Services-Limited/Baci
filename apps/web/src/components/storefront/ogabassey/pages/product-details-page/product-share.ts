interface ProductShareArgs {
  merchantName: string;
  productName: string;
  toast: (args: { description: string; title: string }) => void;
  url: string;
}

export async function shareProductLink({
  merchantName,
  productName,
  toast,
  url,
}: ProductShareArgs) {
  const sharePayload = {
    title: productName,
    text: `Check out ${productName} on ${merchantName}`,
    url,
  };

  if (navigator.share) {
    try {
      await navigator.share(sharePayload);
      return;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return;
      }
    }
  }

  try {
    await navigator.clipboard.writeText(sharePayload.url);
    toast({
      title: 'Link copied!',
      description: 'Product link has been copied to your clipboard.',
    });
    return;
  } catch {
    const textArea = document.createElement('textarea');
    textArea.value = sharePayload.url;
    textArea.setAttribute('readonly', 'true');
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }

  toast({
    title: 'Copy link manually',
    description: 'The product link is selected. Copy it from the URL field.',
  });
}
