export async function readChatResponseText(response: {
  text: () => Promise<string>;
}): Promise<string> {
  return (await response.text()).trim();
}
