export default function MetricCards({ stats, quality }) {
  const cards = [
    ['Unique employees', stats?.queries?.uniqueEmployees || 0],
    ['AI responses', stats?.queries?.totalResponses || 0],
    ['Escalation rate', `${stats?.queries?.escalationRate || 0}%`],
    ['Helpful answers', `${quality?.summary?.helpfulRate || 0}%`],
    ['Average latency', formatDuration(quality?.summary?.averageLatencyMs)],
    ['Resolution rate', `${quality?.summary?.resolutionRate || 0}%`]
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map(([label, value]) => (
        <section key={label} className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-card-foreground">{value}</p>
        </section>
      ))}
    </div>
  );
}

function formatDuration(milliseconds = 0) {
  if (!milliseconds) return '0 ms';
  return milliseconds >= 1000
    ? `${(milliseconds / 1000).toFixed(1)} s`
    : `${milliseconds} ms`;
}
