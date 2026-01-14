export interface RNFile {
  uri: string;
  name: string;
  type: string;
}

export function asUploadFile(file: RNFile): Blob {
  return file as unknown as Blob;
}
