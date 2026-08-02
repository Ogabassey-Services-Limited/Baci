export function ProductGridHeading({ title }: { title: string }) {
  return (
    <h2 className="text-2xl font-bold tracking-tighter sm:text-3xl text-center text-foreground mb-10">
      {title}
    </h2>
  );
}
