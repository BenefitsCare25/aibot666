export default function QualityPanel({ quality }) {
  const repeated = quality?.repeatedQuestions || [];
  const topics = quality?.topicDistribution || [];
  const maxAsked = Math.max(...repeated.map(item => item.count), 1);
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

      <section className="rounded-xl border border-border bg-card p-6 xl:col-span-2">
        <h2 className="text-lg font-semibold text-card-foreground">Top Questions Asked</h2>
        <p className="mt-1 text-sm text-muted-foreground">Most frequently asked questions in this period</p>
        <div className="mt-4 space-y-3">
          {repeated.length > 0 ? repeated.slice(0, 10).map((item, index) => (
            <div key={`${item.question}-${index}`}>
              <div className="flex items-start justify-between gap-4 text-sm">
                <span className="text-card-foreground">
                  <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                  {item.question}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {item.count}&times;
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-accent"
                  style={{ width: `${(item.count / maxAsked) * 100}%` }}
                />
              </div>
            </div>
          )) : (
            <p className="text-sm text-muted-foreground">
              No questions asked in this period yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
