export default function QualityPanel({ quality }) {
  const topics = quality?.topicDistribution || [];
  const topicTotal = topics.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <section className="rounded-xl border border-border bg-card p-6 xl:col-span-2">
        <h2 className="text-lg font-semibold text-card-foreground">Questions by Topic</h2>
        <p className="mt-1 text-sm text-muted-foreground">How employee questions are grouped, classified by AI as they come in</p>
        <div className="mt-4 space-y-3">
          {topics.length > 0 ? topics.map(item => (
            <div key={item.label}>
              <div className="flex justify-between text-sm">
                <span className="text-card-foreground">{item.label}</span>
                <span className="text-muted-foreground">
                  {item.count} ({Math.round((item.count / topicTotal) * 100)}%)
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-accent"
                  style={{ width: `${(item.count / topicTotal) * 100}%` }}
                />
              </div>
            </div>
          )) : (
            <p className="text-sm text-muted-foreground">
              No classified questions yet. Topics are tagged on new questions going forward.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
