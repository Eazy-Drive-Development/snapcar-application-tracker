import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  getVendorListings,
  updateSubscriptionEndDate,
  updateVendorListingEndDate
} from '../api/analytics';
import type { VendorListingRow } from '../api/analytics';

type EditTarget = {
  type: 'listing' | 'subscription';
  id: number;
  title: string;
  currentEndDate: string | null;
};

type StatusFilter = 'All' | 'Active' | 'Inactive';

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

function formatCurrency(value: number | null) {
  if (value === null) {
    return '-';
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value);
}

function dateToInputValue(value: string | null) {
  if (!value) {
    return '';
  }

  return value.slice(0, 10);
}

function getStatusClass(status: string) {
  return status === 'Active' ? 'success' : 'danger';
}

function VendorListingsView() {
  const [rows, setRows] = useState<VendorListingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [endDate, setEndDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [listingStatusFilter, setListingStatusFilter] = useState<StatusFilter>('All');
  const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState<StatusFilter>('All');

  const loadVendorListings = async () => {
    try {
      const result = await getVendorListings();
      setRows(result.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred while loading vendor listings.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVendorListings();
  }, []);

  const openEditModal = (target: EditTarget) => {
    setEditTarget(target);
    setEndDate(dateToInputValue(target.currentEndDate));
    setFormError(null);
  };

  const closeEditModal = () => {
    setEditTarget(null);
    setEndDate('');
    setFormError(null);
    setIsSubmitting(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editTarget) {
      return;
    }

    if (!endDate) {
      setFormError('Select an end date.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      if (editTarget.type === 'listing') {
        await updateVendorListingEndDate(editTarget.id, endDate);
      } else {
        await updateSubscriptionEndDate(editTarget.id, endDate);
      }

      await loadVendorListings();
      closeEditModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to update end date.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRows = rows.filter((row) => (
    (listingStatusFilter === 'All' || row.listingStatus === listingStatusFilter) &&
    (subscriptionStatusFilter === 'All' || row.subscriptionDateStatus === subscriptionStatusFilter)
  ));

  const vendorCount = new Set(filteredRows.map((row) => row.vendorId)).size;
  const carCount = new Set(filteredRows.filter((row) => row.carId !== null).map((row) => row.carId)).size;
  const listingCount = filteredRows.filter((row) => row.listingId !== null).length;
  const activeListingCount = filteredRows.filter((row) => row.listingStatus === 'Active').length;
  const activeSubscriptionCount = new Set(
    filteredRows
      .filter((row) => row.subscriptionId !== null && row.subscriptionDateStatus === 'Active')
      .map((row) => row.vendorId)
  ).size;

  return (
    <div className="view-content">
      <header className="view-header">
        <div>
          <h1>Vendor Listings</h1>
          <p>Review vendor cars, active listing dates, and latest subscription dates.</p>
        </div>
      </header>

      {isLoading ? (
        <div className="status-banner">Loading vendor listings...</div>
      ) : error ? (
        <div className="status-banner error">{error}</div>
      ) : (
        <main className="view-main">
          <section className="summary-grid">
            <article className="summary-card">
              <h2>Total vendors</h2>
              <p>{vendorCount.toLocaleString()}</p>
            </article>
            <article className="summary-card">
              <h2>Total cars</h2>
              <p>{carCount.toLocaleString()}</p>
            </article>
            <article className="summary-card">
              <h2>Total listings</h2>
              <p>{listingCount.toLocaleString()}</p>
            </article>
            <article className="summary-card">
              <h2>Active listings</h2>
              <p>{activeListingCount.toLocaleString()}</p>
            </article>
            <article className="summary-card">
              <h2>Active subscriptions</h2>
              <p>{activeSubscriptionCount.toLocaleString()}</p>
            </article>
          </section>

          <section className="report-card wide-card">
            <div className="vendor-listings-toolbar">
              <div>
                <h2>Vendor car listing list</h2>
                <p>{filteredRows.length.toLocaleString()} of {rows.length.toLocaleString()} rows</p>
              </div>
              <div className="filter-controls">
                <label>
                  <span>Listing status</span>
                  <select
                    value={listingStatusFilter}
                    onChange={(event) => setListingStatusFilter(event.target.value as StatusFilter)}
                  >
                    <option value="All">All</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </label>
                <label>
                  <span>Subscription status</span>
                  <select
                    value={subscriptionStatusFilter}
                    onChange={(event) => setSubscriptionStatusFilter(event.target.value as StatusFilter)}
                  >
                    <option value="All">All</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </label>
                <button
                  className="button-secondary compact-button"
                  type="button"
                  onClick={() => {
                    setListingStatusFilter('All');
                    setSubscriptionStatusFilter('All');
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>Phone</th>
                    <th>Vehicle no</th>
                    <th>Listing start</th>
                    <th>Listing end</th>
                    <th>Listing status</th>
                    <th>Subscription end</th>
                    <th>Subscription amount</th>
                    <th>Subscription status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length > 0 ? (
                    filteredRows.map((row) => (
                      <tr key={`${row.vendorId}-${row.carId ?? 'no-car'}-${row.listingId ?? 'no-listing'}`}>
                        <td>{row.vendorName}</td>
                        <td>{row.vendorPhoneNumber ?? '-'}</td>
                        <td>{row.vehicleNumber ?? 'No car found'}</td>
                        <td>{formatDateTime(row.listingStartDate)}</td>
                        <td>{formatDateTime(row.listingEndDate)}</td>
                        <td>
                          <span className={`status-pill ${getStatusClass(row.listingStatus)}`}>
                            {row.listingStatus}
                          </span>
                        </td>
                        <td>{formatDateTime(row.subscriptionEndDate)}</td>
                        <td>{formatCurrency(row.subscriptionAmount)}</td>
                        <td>
                          <span className={`status-pill ${getStatusClass(row.subscriptionDateStatus)}`}>
                            {row.subscriptionDateStatus}
                          </span>
                        </td>
                        <td>
                          <div className="table-action-stack">
                            <button
                              className="paid-button edit"
                              type="button"
                              disabled={row.listingId === null}
                              onClick={() => row.listingId !== null && openEditModal({
                                type: 'listing',
                                id: row.listingId,
                                title: `${row.vehicleNumber ?? 'Listing'} listing`,
                                currentEndDate: row.listingEndDate
                              })}
                            >
                              Listing
                            </button>
                            <button
                              className="paid-button"
                              type="button"
                              disabled={row.subscriptionId === null}
                              onClick={() => row.subscriptionId !== null && openEditModal({
                                type: 'subscription',
                                id: row.subscriptionId,
                                title: `${row.vendorName} subscription`,
                                currentEndDate: row.subscriptionEndDate
                              })}
                            >
                              Subscription
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="empty-state">
                        No vendor listings found for the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      )}

      {editTarget && (
        <div className="modal-overlay" role="presentation" onClick={closeEditModal}>
          <div
            className="payment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vendor-listing-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2 id="vendor-listing-modal-title">Edit end date</h2>
                <p>{editTarget.title}</p>
              </div>
              <button className="modal-close" type="button" onClick={closeEditModal} aria-label="Close vendor listing popup">
                x
              </button>
            </div>

            <form className="payment-form" onSubmit={handleSubmit}>
              <label className="form-field">
                <span>End date</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </label>

              {formError && <div className="form-error">{formError}</div>}

              <div className="modal-actions">
                <button className="button-secondary" type="button" onClick={closeEditModal}>
                  Cancel
                </button>
                <button className="button-primary" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default VendorListingsView;
