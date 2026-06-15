export default function ActivityPanel({ activity, categories }) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-card-foreground">Recent Activity</h2>
        <div className="mt-4 max-h-96 space-y-3 overflow-y-auto">
          {activity.length > 0 ? activity.map(item => (
            <article key={item.id} className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-card-foreground">{item.employeeName}</p>
                <span className={item.status === 'escalated'
                  ? 'text-xs font-medium text-amber-600'
                  : 'text-xs font-medium text-emerald-600'}
                >
                  {item.status}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.question}</p>
            </article>
          )) : (
            <p className="text-sm text-muted-foreground">No recent activity.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-card-foreground">Top Knowledge Categories</h2>
        <div className="mt-4 space-y-4">
          {(categories?.topCategories || []).map(category => (
            <div key={category.category} className="rounded-lg bg-muted p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-card-foreground">{category.category}</p>
                <span className="text-sm text-muted-foreground">{category.totalUsage} uses</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {category.entries} knowledge entr{category.entries === 1 ? 'y' : 'ies'}
              </p>
            </div>
          ))}
          {(categories?.topCategories || []).length === 0 && (
            <p className="text-sm text-muted-foreground">No knowledge usage data.</p>
          )}
        </div>
      </section>
    </div>
  );
}
