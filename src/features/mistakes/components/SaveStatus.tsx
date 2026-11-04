export function SaveStatus({ busy, error, retry }: { busy: boolean; error: string; retry: () => void }) {
  if (busy) return <p className="text-sm text-ink-3">Хадгалж байна…</p>;
  if (!error) return null;
  return (
    <div role="alert" className="space-y-2 text-sm text-danger">
      <p>{error}</p>
      <button type="button" onClick={retry} className="font-bold underline">
        Хадгалалтыг дахин оролдох
      </button>
    </div>
  );
}
