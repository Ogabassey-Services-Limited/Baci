declare module '*.png' {
  const content: import('next/image').StaticImageData;
  export default content;
}

declare module '*.avif' {
  const content: import('next/image').StaticImageData;
  export default content;
}

declare module '*.jpg' {
  const content: import('next/image').StaticImageData;
  export default content;
}
