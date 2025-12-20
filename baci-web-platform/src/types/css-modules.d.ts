// Type declarations for CSS module imports
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

declare module '@measured/puck/puck.css';
declare module 'react-grid-layout/css/styles.css';
declare module 'react-resizable/css/styles.css';
