import { useState, useEffect } from 'react';
import { getDayWiseAnalytics } from '../api/analytics';

interface DayWiseData {
  date: string;
  totalBookings: number;
  totalUsers: number;
  totalVendors: number;
  totalRevenue: number;
  totalProfit: number;
  deletedUsers: number;
  deletedVendors: number;
}

interface DayWiseAnalyticsState {
  data: DayWiseData[];
  isLoading: boolean;
  error: string | null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getMonthDateRange(date: Date): { from: Date; to: Date } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);
  return { from, to };
}

function getLast30DaysRange(date: Date): { from: Date; to: Date } {
  const to = new Date(date);
  const from = new Date(date);
  from.setDate(to.getDate() - 29);
  return { from, to };
}

function dateToInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function DayWiseAnalytics() {
  const today = new Date();
  const { from: defaultStart, to: defaultEnd } = getLast30DaysRange(today);

  const [fromDate, setFromDate] = useState(dateToInput(defaultStart));
  const [toDate, setToDate] = useState(dateToInput(defaultEnd));
  const [state, setState] = useState<DayWiseAnalyticsState>({
    data: [],
    isLoading: true,
    error: null
  });

  // Fetch data based on date range
  useEffect(() => {
    const fetchData = async () => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));
        
        const data = await getDayWiseAnalytics(fromDate, toDate);
        
        setState((prev) => ({
          ...prev,
          data: data,
          isLoading: false
        }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Failed to load data',
          isLoading: false
        }));
      }
    };

    fetchData();
  }, [fromDate, toDate]);

  const handlePreviousMonth = () => {
    const from = new Date(fromDate);
    from.setMonth(from.getMonth() - 1);
    const { from: newFrom, to: newTo } = getMonthDateRange(from);
    setFromDate(dateToInput(newFrom));
    setToDate(dateToInput(newTo));
  };

  const handleNextMonth = () => {
    const from = new Date(fromDate);
    from.setMonth(from.getMonth() + 1);
    const { from: newFrom, to: newTo } = getMonthDateRange(from);
    setFromDate(dateToInput(newFrom));
    setToDate(dateToInput(newTo));
  };

  const handleReset = () => {
    const { from: newFrom, to: newTo } = getLast30DaysRange(new Date());
    setFromDate(dateToInput(newFrom));
    setToDate(dateToInput(newTo));
  };

  // Calculate totals
  const totals = state.data.reduce(
    (acc, row) => ({
      totalBookings: acc.totalBookings + row.totalBookings,
      totalUsers: acc.totalUsers + row.totalUsers,
      totalVendors: acc.totalVendors + row.totalVendors,
      totalRevenue: acc.totalRevenue + row.totalRevenue,
      totalProfit: acc.totalProfit + row.totalProfit,
      deletedUsers: acc.deletedUsers + row.deletedUsers,
      deletedVendors: acc.deletedVendors + row.deletedVendors
    }),
    {
      totalBookings: 0,
      totalUsers: 0,
      totalVendors: 0,
      totalRevenue: 0,
      totalProfit: 0,
      deletedUsers: 0,
      deletedVendors: 0
    }
  );

  return (
    <section className="report-card day-wise-analytics">
      <div className="analytics-header">
        <h2>Day-wise Sales</h2>
        <div className="date-controls">
          <button className="nav-btn prev-btn" onClick={handlePreviousMonth} title="Previous month">
            ←
          </button>
          
          <div className="date-inputs">
            <div className="date-field">
              <label htmlFor="from-date">From</label>
              <input
                id="from-date"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <span className="date-separator">to</span>
            <div className="date-field">
              <label htmlFor="to-date">To</label>
              <input
                id="to-date"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>

          <button className="nav-btn next-btn" onClick={handleNextMonth} title="Next month">
            →
          </button>

          <button className="reset-btn" onClick={handleReset}>
            Reset
          </button>
        </div>
      </div>

      {state.isLoading ? (
        <div className="empty-state">Loading analytics…</div>
      ) : state.error ? (
        <div className="status-banner error">{state.error}</div>
      ) : state.data.length === 0 ? (
        <div className="empty-state">No data available for the selected date range</div>
      ) : (
        <div className="table-scroll">
          <table className="analytics-table">
            <thead>
              <tr>
                <th className="left-col">Date</th>
                <th className="number-col">Total Users</th>
                <th className="number-col">Total Vendors</th>
                <th className="number-col">Total Bookings</th>
                <th className="number-col">Booking Revenue</th>
                <th className="number-col">Booking amount</th>
                <th className="number-col">Deleted acc</th>
              </tr>
            </thead>
            <tbody>
              {state.data.map((row) => (
                <tr key={row.date}>
                  <td>{formatDate(row.date)}</td>
                  <td className="number">{row.totalUsers.toLocaleString()}</td>
                  <td className="number">{row.totalVendors.toLocaleString()}</td>
                  <td className="number">{row.totalBookings.toLocaleString()}</td>
                  <td className="amount">{formatCurrency(row.totalRevenue)}</td>
                  <td className="amount profit">{formatCurrency(row.totalProfit)}</td>
                  <td className="number">
                    <div>{row.deletedVendors.toLocaleString()} vendor</div>
                    <div>{row.deletedUsers.toLocaleString()} user</div>
                  </td>
                </tr>
              ))}
              <tr className="total-row">
                <td className="total-label">Total</td>
                <td className="number">{totals.totalUsers.toLocaleString()}</td>
                <td className="number">{totals.totalVendors.toLocaleString()}</td>
                <td className="number">{totals.totalBookings.toLocaleString()}</td>
                <td className="amount">{formatCurrency(totals.totalRevenue)}</td>
                <td className="amount profit">{formatCurrency(totals.totalProfit)}</td>
                <td className="number">
                  <div>{totals.deletedVendors.toLocaleString()} vendor</div>
                  <div>{totals.deletedUsers.toLocaleString()} user</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default DayWiseAnalytics;
