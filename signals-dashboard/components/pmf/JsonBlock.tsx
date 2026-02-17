interface JsonBlockProps {
  data: unknown;
  label?: string;
}

export function JsonBlock({ data, label }: JsonBlockProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <span className="text-sm font-medium text-gray-700">{label}</span>
      )}
      <pre className="max-h-80 overflow-auto rounded-md bg-gray-50 p-4 text-xs text-gray-800 border border-gray-200">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
