import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function QueryTrend({ trends }) {
  const data = {
    labels: trends.map(item => new Date(item.date).toLocaleDateString()),
    datasets: [{
      label: 'Queries',
      data: trends.map(item => item.queries),
      borderColor: 'rgb(var(--accent))',
      backgroundColor: 'rgb(var(--accent) / 0.12)',
      fill: true,
      tension: 0.35
    }]
  };

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold text-card-foreground">Query Trend</h2>
      <div className="mt-4 h-64">
        {trends.length > 0 ? (
          <Line
            data={data}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No query data for this period.
          </div>
        )}
      </div>
    </section>
  );
}
