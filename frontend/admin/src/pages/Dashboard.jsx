import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { analyticsApi } from '../api/analytics';
import ActivityPanel from '../components/dashboard/ActivityPanel';
import MetricCards from '../components/dashboard/MetricCards';
import QualityPanel from '../components/dashboard/QualityPanel';
import QueryTrend from '../components/dashboard/QueryTrend';
import SystemHealth from '../components/dashboard/SystemHealth';

const FILTERS = [
  ['today', 'Today'],
  ['week', '7 days'],
  ['month', '30 days'],
  ['all', 'All time']
];

export default function Dashboard() {
  const [timeFilter, setTimeFilter] = useState('week');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const companySelected = Boolean(localStorage.getItem('selected_company_domain'));
  const dateRange = useMemo(() => getDateRange(timeFilter), [timeFilter]);

  const handleDownloadReport = async () => {
    setDownloading(true);
    try {
      await analyticsApi.downloadQualityReport(dateRange);
      toast.success('Report downloaded');
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    if (!companySelected) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    Promise.all([
      analyticsApi.getAnalytics(dateRange),
      analyticsApi.getRecentActivity({ ...dateRange, limit: 10 }),
      analyticsApi.getFrequentCategories(dateRange),
      analyticsApi.getQueryTrends(dateRange),
      analyticsApi.getQualityAnalytics(dateRange),
      analyticsApi.getSystemHealth()
    ])
      .then(([stats, activity, categories, trends, quality, health]) => {
        if (!active) return;
        setData({
          stats: stats.data,
          activity: activity.data,
          categories: categories.data,
          trends: trends.data,
          quality: quality.data,
          health: health.data
        });
      })
      .catch(() => {
        if (active) toast.error('Failed to load dashboard data');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [companySelected, dateRange]);

  if (!companySelected) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="text-xl font-semibold text-card-foreground">Select a company</h1>
        <p className="mt-2 text-muted-foreground">Choose a company to view its analytics.</p>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">Answer quality and system operations</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-2 rounded-xl border border-border bg-card p-1">
            {FILTERS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTimeFilter(value)}
                className={timeFilter === value
                  ? 'rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground'
                  : 'rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted'}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleDownloadReport}
            disabled={downloading}
            className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground hover:bg-muted disabled:opacity-50"
          >
            {downloading ? 'Generating…' : 'Download HR report'}
          </button>
        </div>
      </header>

      <MetricCards stats={data.stats} quality={data.quality} />
      <QueryTrend trends={data.trends} />
      <QualityPanel quality={data.quality} />
      <ActivityPanel activity={data.activity} categories={data.categories} />
      <SystemHealth health={data.health} />
    </div>
  );
}

function getDateRange(filter) {
  if (filter === 'all') return {};

  const endDate = new Date();
  const startDate = new Date(endDate);
  if (filter === 'today') {
    startDate.setHours(0, 0, 0, 0);
  } else {
    startDate.setDate(startDate.getDate() - (filter === 'week' ? 7 : 30));
  }

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  };
}
