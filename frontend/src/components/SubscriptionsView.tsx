import { useEffect, useState } from 'react';
import { getSubscriptions } from '../api/analytics';
import type { SubscriptionRow } from '../api/analytics';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Not set';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function normalizeStatus(status: string) {
  return status.trim() || 'Unknown';
}

function getStatusClass(status: string) {
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus.includes('active') || normalizedStatus.includes('success')) {
    return 'success';
  }

  if (normalizedStatus.includes('pending') || normalizedStatus.includes('created')) {
    return 'pending';
  }

  if (normalizedStatus.includes('expired') || normalizedStatus.includes('cancel') || normalizedStatus.includes('fail')) {
    return 'danger';
  }

  return 'neutral';
}

function getDateSortValue(value: string | null) {
  return value ? new Date(value).getTime() : 0;
}

function SubscriptionsView() {
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSubscriptions = async () => {
      try {
        const result = await getSubscriptions();
        setSubscriptions(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred while loading subscriptions.');
      } finally {
        setIsLoading(false);
      }
    };

    loadSubscriptions();
  }, []);

  const sortedSubscriptions = [...subscriptions].sort((left, right) => (
    getDateSortValue(right.createdOn) - getDateSortValue(left.createdOn)
  ));
  const totalAmount = subscriptions.reduce((sum, subscription) => sum + subscription.amount, 0);
  const activeCount = subscriptions.filter((subscription) => (
    normalizeStatus(subscription.status).toLowerCase().includes('active')
  )).length;
  return (
    <div className="view-content">
      <header className="view-header">
        <div>
          <h1>Subscriptions</h1>
          <p>Track vendor subscription status, amount, and subscription period.</p>
        </div>
      </header>

      {isLoading ? (
        <div className="status-banner">Loading subscriptions data...</div>
      ) : error ? (
        <div className="status-banner error">{error}</div>
      ) : (
        <main className="view-main">
          <section className="summary-grid">
            <article className="summary-card">
              <h2>Total subscriptions</h2>
              <p>{subscriptions.length}</p>
            </article>
            <article className="summary-card">
              <h2>Active</h2>
              <p>{activeCount}</p>
            </article>
            <article className="summary-card">
              <h2>Total amount</h2>
              <p>{formatCurrency(totalAmount)}</p>
            </article>
          </section>

          <section className="report-card wide-card">
            <h2>Subscription list</h2>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Vendor name</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Start date</th>
                    <th>End date</th>
                    <th>Created date</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSubscriptions.length > 0 ? (
                    sortedSubscriptions.map((subscription) => {
                      const status = normalizeStatus(subscription.status);

                      return (
                        <tr key={subscription.id}>
                          <td>{subscription.vendorName}</td>
                          <td>
                            <span className={`status-pill ${getStatusClass(status)}`}>
                              {status}
                            </span>
                          </td>
                          <td>{formatCurrency(subscription.amount)}</td>
                          <td>{formatDateTime(subscription.startDate)}</td>
                          <td>{formatDateTime(subscription.endDate)}</td>
                          <td>{formatDateTime(subscription.createdOn)}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="empty-state">
                        No subscription records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

export default SubscriptionsView;
