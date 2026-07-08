import { useTest1 } from '../viewmodel';

export function Test1Page() {
  const { data, loading, error } = useTest1();

  if (loading) {
    return <p>Loading…</p>;
  }

  if (error) {
    return <p>Failed to load test1: {error.message}</p>;
  }

  if (!data?.test1) {
    return <p>No test1 found.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-lg font-semibold">#{data.test1.id}</p>
      {(data.test1.test2 ?? [])
        .filter((child) => child != null)
        .map((child) => (
          <p key={child.id}>- #{child.id}</p>
        ))}
    </div>
  );
}
