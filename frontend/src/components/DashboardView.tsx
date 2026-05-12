import { useEffect, useState } from 'react';
import { getSummary } from '../api/analytics';
import DayWiseAnalytics from './DayWiseAnalytics';

interface DailyStats {
  day: string;
  count: number;
  totalAmount: number;
}

interface PendingVendor {
  vendorId: number;
  vendorName: string;
  unpaidBookings: number;
  pendingAmount: number;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value);
}

function DashboardView() {
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState({ totalBookings: 0, grossEarnings: 0, pendingAmount: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const summaryResult = await getSummary();
        setSummary(summaryResult);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Unknown error occurred while loading analytics.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalytics();
  }, []);

  return (
    <div className="view-content">
      <header className="view-header">
        <div>
          <h1>Performance Dashboard</h1>
          <p>Track day-wise booking performance and earnings.</p>
        </div>
      </header>

      {isLoading ? (
        <div className="status-banner">Loading analytics…</div>
      ) : (
        <main className="view-main">
          {error ? <div className="status-banner error">{error}</div> : null}

          <section className="summary-grid">
            <article className="summary-card">
              <h2>Total bookings</h2>
              <p>{summary.totalBookings}</p>
            </article>
            <article className="summary-card">
              <h2>Gross earnings</h2>
              <p>{formatCurrency(summary.grossEarnings)}</p>
            </article>
            <article className="summary-card pending-card">
              <h2>Pending payments</h2>
              <p>{formatCurrency(summary.pendingAmount)}</p>
            </article>
          </section>

          <DayWiseAnalytics />
        </main>
      )}
    </div>
  );
}

export default DashboardView;
