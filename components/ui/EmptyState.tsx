export function EmptyState({
  icon,
  title,
  description,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
      {icon && <div className="text-slate-400 dark:text-slate-600">{icon}</div>}
      <p className="font-medium text-slate-700 dark:text-slate-300">{title}</p>
      {description && <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>}
    </div>
  );
}
