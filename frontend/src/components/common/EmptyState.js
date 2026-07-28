export function EmptyState({ title, description }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-white px-6 py-12 text-center">
      <h3 className="text-base font-semibold text-primary">{title}</h3>
      {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
