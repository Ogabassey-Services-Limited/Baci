// Specific template for Tech/Electronics stores
export function TechTemplate({ children }: { children: React.ReactNode }) {
  // This template could add specific layouts, dark theme styles, or scripts
  return (
    <div className="template-tech bg-background text-foreground">
      {children}
    </div>
  );
}
