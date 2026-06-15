const CARDS = [
  {
    label: 'Unique employees',
    tooltip: 'Number of distinct employees who sent at least one message in the selected period.',
    getValue: (stats, _quality) => stats?.queries?.uniqueEmployees || 0
  },
  {
    label: 'AI responses',
    tooltip: 'Total number of replies the chatbot generated, including cached and escalated responses.',
    getValue: (stats, _quality) => stats?.queries?.totalResponses || 0
  },
  {
    label: 'Escalation rate',
    tooltip: "Percentage of user messages the AI couldn't confidently answer and handed off to your team. Lower is better.",
    getValue: (stats, _quality) => `${stats?.queries?.escalationRate || 0}%`
  },
  {
    label: 'User feedback',
    tooltip: 'Counts of 👍 and 👎 ratings submitted by users. Most responses are not rated — this shows only messages where employees chose to give feedback.',
    getValue: (_stats, quality) => null, // rendered separately
    renderValue: (_stats, quality) => {
      const pos = quality?.summary?.positiveFeedback || 0;
      const neg = quality?.summary?.negativeFeedback || 0;
      return (
        <div className="mt-2 flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-3xl font-semibold text-card-foreground">
            <span className="text-2xl">👍</span>{pos}
          </span>
          <span className="text-muted-foreground/40 text-2xl font-light">·</span>
          <span className="flex items-center gap-1.5 text-3xl font-semibold text-card-foreground">
            <span className="text-2xl">👎</span>{neg}
          </span>
        </div>
      );
    }
  },
  {
    label: 'Avg response time',
    tooltip: 'How long the chatbot takes to generate a reply, averaged across all AI responses in the period. Lower means a faster experience for employees.',
    getValue: (_stats, quality) => formatDuration(quality?.summary?.averageLatencyMs)
  },
  {
    label: 'Resolution rate',
    tooltip: 'Of all escalated cases, the percentage that your team marked as resolved. Higher means your team is closing more support requests.',
    getValue: (_stats, quality) => `${quality?.summary?.resolutionRate || 0}%`
  }
];

export default function MetricCards({ stats, quality }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {CARDS.map(({ label, tooltip, getValue, renderValue }) => (
        <section key={label} className="group relative rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-1.5">
            <p className="text-sm text-muted-foreground">{label}</p>
            <span className="flex h-4 w-4 shrink-0 cursor-default items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground">
              ?
            </span>
          </div>
          {renderValue
            ? renderValue(stats, quality)
            : <p className="mt-2 text-3xl font-semibold text-card-foreground">{getValue(stats, quality)}</p>
          }

          {/* Tooltip */}
          <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-64 -translate-x-1/2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
            {tooltip}
            <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-border" />
          </div>
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
