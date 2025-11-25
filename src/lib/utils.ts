import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const checkPasswordStrength = (password: string): number => {
  if (!password) return 0;
  if (password.length >= 12) return 3; // Length is king (NIST)

  let score = 0;
  if (password.length >= 8) score++;
  if (/\d/.test(password)) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score > 3) return 3;
  if (score > 0 && password.length < 8) return 1;
  return score > 0 ? Math.min(score, 3) : 0;
};

/**
 * Converts a ReadableStream of Uint8Array into a data URI.
 * @param stream The ReadableStream from the AI response.
 * @returns A promise that resolves to a data URI string.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function streamToDataURI(stream: ReadableStream<any>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let done = false;
  let mimeType = 'image/png'; // Default MIME type

  while (!done) {
    const { value, done: readerDone } = await reader.read();
    if (readerDone) {
      done = true;
    } else {
      // The chunk can be a string (for text parts) or an object with binary data.
      // We are interested in the binary data for the image.
      if (value.image) {
        if (value.image.contentType) {
          mimeType = value.image.contentType;
        }
        chunks.push(value.image.data);
      } else if (value.text) {
        // This handles cases where the model might interleave text and image chunks.
        // We are primarily interested in the image.
      }
    }
  }

  if (chunks.length === 0) {
    throw new Error("No image data found in the stream.");
  }

  // Concatenate all chunks into a single Uint8Array
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  // Convert Uint8Array to a Base64 string
  const base64String = Buffer.from(combined).toString('base64');

  return `data:${mimeType};base64,${base64String}`;
}
