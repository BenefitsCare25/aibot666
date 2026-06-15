export default function QualityPanel({ quality }) {
  const unanswered = quality?.unansweredClusters || [];
  const negative = quality?.recentNegativeFeedback || [];
  const similarities = quality?.similarityDistribution || [];

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-card-foreground">Retrieval Quality</h2>
        <div className="mt-4 space-y-3">
          {similarities.map(item => {
            const max = Math.max(...similarities.map(entry => entry.count), 1);
            return (
              <div key={item.label}>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="text-card-foreground">{item.count}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-accent"
                    style={{ width: `${(item.count / max) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-card-foreground">Unanswered Clusters</h2>
        <div className="mt-4 space-y-3">
          {unanswered.length > 0 ? unanswered.slice(0, 6).map(item => (
            <div key={`${item.question}-${item.count}`} className="rounded-lg bg-muted p-3">
              <p className="text-sm text-card-foreground">{item.question}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.category} · {item.count} escalation{item.count === 1 ? '' : 's'}
              </p>
            </div>
          )) : (
            <p className="text-sm text-muted-foreground">No escalated question clusters.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 xl:col-span-2">
        <h2 className="text-lg font-semibold text-card-foreground">Recent Negative Feedback</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {negative.length > 0 ? negative.map(item => (
            <div key={item.messageId} className="rounded-lg border border-border p-4">
              <p className="line-clamp-3 text-sm text-card-foreground">{item.answer}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {item.reason || 'No reason supplied'}
              </p>
            </div>
          )) : (
            <p className="text-sm text-muted-foreground">No negative feedback in this period.</p>
          )}
        </div>
      </section>
    </div>
  );
}
