const LABELS = {
  database: 'Database',
  redis: 'Redis',
  openai: 'OpenAI',
  documentQueue: 'Document queue',
  email: 'Email',
  telegram: 'Telegram'
};

export default function SystemHealth({ health }) {
  const services = Object.entries(health?.services || {});

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">System Health</h2>
          <p className="text-sm text-muted-foreground">
            Live dependency checks, refreshed with the dashboard
          </p>
        </div>
        <StatusBadge status={health?.status || 'unavailable'} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {services.map(([name, service]) => (
          <div key={name} className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-card-foreground">{LABELS[name] || name}</span>
              <StatusBadge status={service.status} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {service.detail || (
                service.latencyMs !== undefined ? `${service.latencyMs} ms` : 'Check completed'
              )}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatusBadge({ status }) {
  const classes = {
    operational: 'bg-emerald-100 text-emerald-700',
    degraded: 'bg-amber-100 text-amber-700',
    unavailable: 'bg-red-100 text-red-700',
    disabled: 'bg-muted text-muted-foreground'
  };

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${classes[status] || classes.unavailable}`}>
      {status}
    </span>
  );
}
