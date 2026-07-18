import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createPaymentTracker, getPendingPayments } from '../api/analytics';

interface VendorPayout {
  paymentId: number;
  bookingId: number | null;
  gatewayPaymentAmount: number | null;
  vendorId: number | null;
  userId: number | null;
  vendorName: string;
  vendorPhoneNumber: string | null;
  customerName: string;
  customerPhoneNumber: string | null;
  amount: number;
  totalAmount: number;
  bookingStatus: string;
  deliveryType: string;
  bookingStartDate: string | null;
  bookingEndDate: string | null;
  platformCharges: number;
  remainingAmount: number;
  paymentTrackerId: number | null;
  paymentPayto: number | null;
  paidAmount: number | null;
  profit: number | null;
  paymentNotes: string | null;
}

type RefundTarget = 'vendor' | 'user' | 'none';
type PaymentStatusFilter = 'All' | 'Done' | 'Pending';
type BookingStatusFilter = 'All' | 'Ongoing' | 'Cancelled' | 'Complete successfully' | 'Cancelled by user' | 'Booking Confirmed';
type DeliveryTypeFilter = 'All' | 'Home Delivery' | 'Self Pick up' | 'Door Delivery';

function formatCurrency(value: number, fractionDigits = 0) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(value);
}

function formatNullableCurrency(value: number | null, fractionDigits = 2) {
  return value === null ? '-' : formatCurrency(value, fractionDigits);
}

function getGatewayAmountGap(amount: number, gatewayAmount: number | null) {
  return gatewayAmount === null ? null : amount - gatewayAmount;
}

function getOverallTotal(payment: VendorPayout) {
  return payment.totalAmount + payment.platformCharges;
}

function getRemainingVendorAmount(payment: VendorPayout) {
  return payment.gatewayPaymentAmount === null ? null : getOverallTotal(payment) - payment.gatewayPaymentAmount;
}

function getSnapcarPaidToCustomer(payment: VendorPayout) {
  return payment.gatewayPaymentAmount === null ? null : payment.gatewayPaymentAmount - payment.platformCharges;
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

function formatBookingDate(startDate: string | null, endDate: string | null) {
  return `${formatDateTime(startDate)} - ${formatDateTime(endDate)}`;
}

function isCancelledStatus(status: string) {
  return status.toLowerCase().includes('cancel');
}

function formatPerson(name: string, phoneNumber: string | null) {
  return phoneNumber ? `${name} (${phoneNumber})` : name;
}

function getCalculatedAdvanceAmount(payment: VendorPayout) {
  return (payment.totalAmount * 0.3) + payment.platformCharges;
}

function getDateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : '';
}

function escapeExcelCell(value: string | number | null) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatExportAmount(value: number) {
  return Number(value.toFixed(2));
}

function PaymentView() {
  const [isLoading, setIsLoading] = useState(true);
  const [payments, setPayments] = useState<VendorPayout[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<VendorPayout | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentFormError, setPaymentFormError] = useState<string | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [refundTarget, setRefundTarget] = useState<RefundTarget>('vendor');
  const [detailPayment, setDetailPayment] = useState<VendorPayout | null>(null);
  const [vendorSearch, setVendorSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilter>('All');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<BookingStatusFilter>('All');
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState<DeliveryTypeFilter>('All');

  useEffect(() => {
    const loadPendingPayments = async () => {
      try {
        const result = await getPendingPayments();
        setPayments(result.data);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Unknown error occurred while loading pending payments.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadPendingPayments();
  }, []);

  const normalizedVendorSearch = vendorSearch.trim().toLowerCase();
  const filteredPayments = payments.filter((payment) => {
    const bookingDate = getDateInputValue(payment.bookingStartDate);
    const matchesVendor = !normalizedVendorSearch || payment.vendorName.toLowerCase().includes(normalizedVendorSearch);
    const matchesFromDate = !fromDate || (bookingDate !== '' && bookingDate >= fromDate);
    const matchesToDate = !toDate || (bookingDate !== '' && bookingDate <= toDate);
    const matchesPaymentStatus = (
      paymentStatusFilter === 'All' ||
      (paymentStatusFilter === 'Done' && payment.paymentTrackerId !== null) ||
      (paymentStatusFilter === 'Pending' && payment.paymentTrackerId === null)
    );
    const matchesBookingStatus = bookingStatusFilter === 'All' || payment.bookingStatus === bookingStatusFilter;
    const matchesDeliveryType = deliveryTypeFilter === 'All' || payment.deliveryType === deliveryTypeFilter;

    return matchesVendor && matchesFromDate && matchesToDate && matchesPaymentStatus && matchesBookingStatus && matchesDeliveryType;
  });

  const totalAmount = filteredPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalRemainingAmount = filteredPayments.reduce((sum, payment) => (
    payment.paymentTrackerId === null ? sum + payment.amount : sum
  ), 0);
  const totalProfit = filteredPayments.reduce((sum, payment) => (
    payment.profit === null ? sum : sum + payment.profit
  ), 0);

  const openPaymentModal = (payment: VendorPayout) => {
    const isCancelled = isCancelledStatus(payment.bookingStatus);
    const currentTarget = payment.paymentPayto === null
      ? 'none'
      : payment.paymentPayto === payment.userId
        ? 'user'
        : 'vendor';

    setSelectedPayment(payment);
    setPaymentAmount(String(payment.paidAmount ?? getSnapcarPaidToCustomer(payment) ?? ''));
    setPaymentNotes(payment.paymentNotes ?? '');
    setRefundTarget(isCancelled ? currentTarget : 'vendor');
    setPaymentFormError(null);
  };

  const closePaymentModal = () => {
    setSelectedPayment(null);
    setPaymentAmount('');
    setPaymentNotes('');
    setPaymentFormError(null);
    setIsSubmittingPayment(false);
    setRefundTarget('vendor');
  };

  const closeDetailModal = () => {
    setDetailPayment(null);
  };

  const handleDownloadExcel = () => {
    const exportRows = filteredPayments.map((payment) => {
      const overallTotal = payment.totalAmount + payment.platformCharges;
      const calculatedAdvanceAmount = getCalculatedAdvanceAmount(payment);
      const snapcarPaidToCustomer = getSnapcarPaidToCustomer(payment);

      return {
        bookingId: payment.bookingId ?? '',
        fromDate: formatDateTime(payment.bookingStartDate),
        toDate: formatDateTime(payment.bookingEndDate),
        vendorName: payment.vendorName,
        customerName: payment.customerName,
        overallTotal,
        advanceAmountPaid: payment.gatewayPaymentAmount,
        advanceAmountInDb: payment.amount,
        snapcarPaidToCustomer,
        amountPaid: payment.paymentTrackerId === null ? null : payment.paidAmount,
        profit: payment.paymentTrackerId === null ? null : payment.profit
      };
    });
    const totals = exportRows.reduce((sum, row) => ({
      overallTotal: sum.overallTotal + row.overallTotal,
      advanceAmountPaid: sum.advanceAmountPaid + (row.advanceAmountPaid ?? 0),
      advanceAmountInDb: sum.advanceAmountInDb + row.advanceAmountInDb,
      snapcarPaidToCustomer: sum.snapcarPaidToCustomer + (row.snapcarPaidToCustomer ?? 0),
      amountPaid: sum.amountPaid + (row.amountPaid ?? 0),
      profit: sum.profit + (row.profit ?? 0)
    }), {
      overallTotal: 0,
      advanceAmountPaid: 0,
      advanceAmountInDb: 0,
      snapcarPaidToCustomer: 0,
      amountPaid: 0,
      profit: 0
    });
    const headers = [
      'Booking id',
      'From date',
      'To date',
      'Vendor name',
      'Customer name',
      'Overall total',
      'Advance amount paid',
      'Advance amount in DB',
      'Snapcar paid',
      'Amount paid',
      'Profit'
    ];
    const rows = [
      headers,
      ...exportRows.map((row) => [
        row.bookingId,
        row.fromDate,
        row.toDate,
        row.vendorName,
        row.customerName,
        formatExportAmount(row.overallTotal),
        row.advanceAmountPaid === null ? '' : formatExportAmount(row.advanceAmountPaid),
        formatExportAmount(row.advanceAmountInDb),
        row.snapcarPaidToCustomer === null ? '' : formatExportAmount(row.snapcarPaidToCustomer),
        row.amountPaid === null ? '' : formatExportAmount(row.amountPaid),
        row.profit === null ? '' : formatExportAmount(row.profit)
      ]),
      [
        'Total',
        '',
        '',
        '',
        '',
        formatExportAmount(totals.overallTotal),
        formatExportAmount(totals.advanceAmountPaid),
        formatExportAmount(totals.advanceAmountInDb),
        formatExportAmount(totals.snapcarPaidToCustomer),
        formatExportAmount(totals.amountPaid),
        formatExportAmount(totals.profit)
      ]
    ];
    const tableRows = rows.map((row) => (
      `<tr>${row.map((cell) => `<td>${escapeExcelCell(cell)}</td>`).join('')}</tr>`
    )).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table>${tableRows}</table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payment-report-${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handlePaymentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedPayment) {
      return;
    }

    const amount = Number(paymentAmount);
    const notes = paymentNotes.trim();

    if (!Number.isFinite(amount) || amount < 0) {
      setPaymentFormError('Enter an amount to be paid that is zero or greater.');
      return;
    }

    if (notes.length > 200) {
      setPaymentFormError('Notes must be 200 characters or fewer.');
      return;
    }

    if (!selectedPayment.bookingId) {
      setPaymentFormError('Payment record is missing booking details.');
      return;
    }

    const isCancelled = isCancelledStatus(selectedPayment.bookingStatus);
    const payto = isCancelled
      ? refundTarget === 'none'
        ? null
        : refundTarget === 'user'
          ? selectedPayment.userId
          : selectedPayment.vendorId
      : selectedPayment.vendorId;

    if (payto === undefined || (payto === null && (!isCancelled || refundTarget !== 'none'))) {
      setPaymentFormError('Selected refund target is missing user details.');
      return;
    }

    try {
      setIsSubmittingPayment(true);
      setPaymentFormError(null);

      const tracker = await createPaymentTracker({
        paymentId: selectedPayment.paymentId,
        carBookingId: selectedPayment.bookingId,
        payto,
        amountPaid: amount,
        notes
      });

      setPayments((currentPayments) => currentPayments.map((payment) => (
        payment.paymentId === selectedPayment.paymentId
          ? {
              ...payment,
              paymentTrackerId: tracker.id,
              paymentPayto: payto,
              paidAmount: amount,
              profit: tracker.profit,
              paymentNotes: notes || null
            }
          : payment
      )));
      closePaymentModal();
    } catch (err) {
      setPaymentFormError(err instanceof Error ? err.message : 'Unable to submit payment details.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  return (
    <div className="view-content">
      <header className="view-header">
        <div>
          <h1>Payment Tracking</h1>
          <p>Monitor vendor payouts and pending payments.</p>
        </div>
      </header>

      {isLoading ? (
        <div className="status-banner">Loading payment data…</div>
      ) : error ? (
        <div className="status-banner error">{error}</div>
      ) : (
        <main className="view-main">
          <section className="summary-grid">
            <article className="summary-card">
              <h2>Total payments</h2>
              <p>{filteredPayments.length}</p>
            </article>
            <article className="summary-card">
              <h2>Total amount</h2>
              <p>{formatCurrency(totalAmount)}</p>
            </article>
            <article className="summary-card pending-card">
              <h2>Total remaining</h2>
              <p>{formatCurrency(totalRemainingAmount)}</p>
            </article>
            <article className="summary-card">
              <h2>Total profit</h2>
              <p>{formatCurrency(totalProfit, 2)}</p>
            </article>
          </section>

          <section className="report-card wide-card">
            <h2>Vendor payout list</h2>
            <div className="filter-controls payment-filter-controls">
              <div className="payment-filter-row">
                <label>
                  <span>From date</span>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                    onClick={(event) => event.currentTarget.showPicker()}
                    onFocus={(event) => event.currentTarget.showPicker()}
                    onKeyDown={(event) => event.preventDefault()}
                    onPaste={(event) => event.preventDefault()}
                  />
                </label>
                <label>
                  <span>To date</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(event) => setToDate(event.target.value)}
                    onClick={(event) => event.currentTarget.showPicker()}
                    onFocus={(event) => event.currentTarget.showPicker()}
                    onKeyDown={(event) => event.preventDefault()}
                    onPaste={(event) => event.preventDefault()}
                  />
                </label>
                <label>
                  <span>Payment status</span>
                  <select
                    value={paymentStatusFilter}
                    onChange={(event) => setPaymentStatusFilter(event.target.value as PaymentStatusFilter)}
                  >
                    <option value="All">All</option>
                    <option value="Done">Done</option>
                    <option value="Pending">Pending</option>
                  </select>
                </label>
                <label>
                  <span>Booking status</span>
                  <select
                    value={bookingStatusFilter}
                    onChange={(event) => setBookingStatusFilter(event.target.value as BookingStatusFilter)}
                  >
                    <option value="All">All</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="Complete successfully">Complete successfully</option>
                    <option value="Cancelled by user">Cancelled by user</option>
                    <option value="Booking Confirmed">Booking Confirmed</option>
                  </select>
                </label>
                <label>
                  <span>Delivery type</span>
                  <select
                    value={deliveryTypeFilter}
                    onChange={(event) => setDeliveryTypeFilter(event.target.value as DeliveryTypeFilter)}
                  >
                    <option value="All">All</option>
                    <option value="Home Delivery">Home Delivery</option>
                    <option value="Self Pick up">Self Pick up</option>
                    <option value="Door Delivery">Door Delivery</option>
                  </select>
                </label>
                <button
                  className="button-secondary compact-button"
                  type="button"
                  onClick={() => {
                    setVendorSearch('');
                    setFromDate('');
                    setToDate('');
                    setPaymentStatusFilter('All');
                    setBookingStatusFilter('All');
                    setDeliveryTypeFilter('All');
                  }}
                >
                  Reset
                </button>
                <button
                  className="button-primary compact-button"
                  type="button"
                  onClick={handleDownloadExcel}
                >
                  Download Excel
                </button>
              </div>
              <label className="search-filter payment-search-filter">
                <span>Search vendor</span>
                <input
                  type="search"
                  value={vendorSearch}
                  onChange={(event) => setVendorSearch(event.target.value)}
                  placeholder="Vendor name"
                />
              </label>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Booking / Vendor</th>
                    <th>Booking status</th>
                    <th>Delivery type</th>
                    <th>Booking date</th>
                    <th>Advance amount</th>
                    <th>Snapcar paid</th>
                    <th>Actual amount paid</th>
                    <th>Profit</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.length > 0 ? (
                    filteredPayments.map((row) => {
                      const isPaid = row.paymentTrackerId !== null;

                      return (
                        <tr key={row.paymentId}>
                          <td>
                            <div className="stacked-table-cell">
                              <strong>{row.bookingId ?? 'Not set'}</strong>
                              <span>{row.vendorName}</span>
                            </div>
                          </td>
                          <td>{row.bookingStatus}</td>
                          <td>{row.deliveryType}</td>
                          <td>{formatBookingDate(row.bookingStartDate, row.bookingEndDate)}</td>
                          <td>{formatNullableCurrency(row.gatewayPaymentAmount)}</td>
                          <td>{formatNullableCurrency(getSnapcarPaidToCustomer(row))}</td>
                          <td>{isPaid && row.paidAmount !== null ? formatCurrency(row.paidAmount, 2) : '-'}</td>
                          <td>{isPaid ? formatNullableCurrency(row.profit) : '-'}</td>
                          <td>
                            <div className="table-action-stack">
                              <button
                                className="paid-button neutral-action"
                                type="button"
                                onClick={() => setDetailPayment(row)}
                              >
                                View
                              </button>
                              <button
                                className={`paid-button ${isPaid ? 'edit' : ''}`}
                                type="button"
                                onClick={() => openPaymentModal(row)}
                              >
                                {isPaid ? 'Edit' : 'Pay'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="empty-state">
                        No payment records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      )}

      {selectedPayment && (
        <div className="modal-overlay" role="presentation" onClick={closePaymentModal}>
          <div
            className="payment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2 id="payment-modal-title">{selectedPayment.paymentTrackerId ? 'Edit payment' : 'Pay vendor'}</h2>
                <p>Customer: {formatPerson(selectedPayment.customerName, selectedPayment.customerPhoneNumber)}</p>
                <p>Vendor: {formatPerson(selectedPayment.vendorName, selectedPayment.vendorPhoneNumber)}</p>
              </div>
              <button className="modal-close" type="button" onClick={closePaymentModal} aria-label="Close payment popup">
                x
              </button>
            </div>

            <form className="payment-form" onSubmit={handlePaymentSubmit}>
              {selectedPayment.paymentTrackerId && selectedPayment.paidAmount !== null && (
                <div className="paid-amount-preview">
                  <span>Paid amount</span>
                  <strong>{formatCurrency(selectedPayment.paidAmount, 2)}</strong>
                </div>
              )}

              {isCancelledStatus(selectedPayment.bookingStatus) && (
                <fieldset className="refund-target-group">
                  <legend>Refund to</legend>
                  <label>
                    <input
                      type="radio"
                      name="refundTarget"
                      value="vendor"
                      checked={refundTarget === 'vendor'}
                      onChange={() => setRefundTarget('vendor')}
                    />
                    Vendor: {formatPerson(selectedPayment.vendorName, selectedPayment.vendorPhoneNumber)}
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="refundTarget"
                      value="user"
                      checked={refundTarget === 'user'}
                      onChange={() => setRefundTarget('user')}
                    />
                    User: {formatPerson(selectedPayment.customerName, selectedPayment.customerPhoneNumber)}
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="refundTarget"
                      value="none"
                      checked={refundTarget === 'none'}
                      onChange={() => setRefundTarget('none')}
                    />
                    No one
                  </label>
                </fieldset>
              )}

              <label className="form-field">
                <span>Amount to be paid</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                  placeholder="Enter amount"
                />
              </label>

              <label className="form-field">
                <span>Notes</span>
                <textarea
                  value={paymentNotes}
                  onChange={(event) => setPaymentNotes(event.target.value)}
                  placeholder="Enter payment notes"
                  maxLength={200}
                  rows={4}
                />
              </label>

              {paymentFormError && <div className="form-error">{paymentFormError}</div>}

              <div className="modal-actions">
                <button className="button-secondary" type="button" onClick={closePaymentModal}>
                  Cancel
                </button>
                <button className="button-primary" type="submit" disabled={isSubmittingPayment}>
                  {isSubmittingPayment ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailPayment && (
        <div className="modal-overlay" role="presentation" onClick={closeDetailModal}>
          <div
            className="payment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-detail-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2 id="payment-detail-modal-title">Payment detail</h2>
                <p>Booking ID: {detailPayment.bookingId ?? 'Not set'}</p>
                <p>Vendor: {formatPerson(detailPayment.vendorName, detailPayment.vendorPhoneNumber)}</p>
              </div>
              <button className="modal-close" type="button" onClick={closeDetailModal} aria-label="Close payment detail popup">
                x
              </button>
            </div>

            <div className="payment-detail-list">
              <div className="payment-detail-total">
                <span>Overall total</span>
                <strong>{formatCurrency(getOverallTotal(detailPayment), 2)}</strong>
              </div>
              <div>
                <span>Total trip amount</span>
                <strong>{formatCurrency(detailPayment.totalAmount, 2)}</strong>
              </div>
              <div>
                <span>Platform fee + GST</span>
                <strong>{formatCurrency(detailPayment.platformCharges, 2)}</strong>
              </div>
              <div>
                <span>Advance amount paid</span>
                <strong>{formatNullableCurrency(detailPayment.gatewayPaymentAmount)}</strong>
              </div>
              <div>
                <span>customer paid to vendor</span>
                <strong>{formatNullableCurrency(getRemainingVendorAmount(detailPayment))}</strong>
              </div>
              <div>
                <span>Snapcar paid</span>
                <strong>{formatNullableCurrency(getSnapcarPaidToCustomer(detailPayment))}</strong>
              </div>
              <div className="payment-check-section">
                <h3>Payment check</h3>
                <div>
                  <span>Payment GW amount</span>
                  <strong>{formatNullableCurrency(detailPayment.gatewayPaymentAmount)}</strong>
                </div>
                <div>
                  <span>Calculated advance amount</span>
                  <strong>
                    {formatCurrency(getCalculatedAdvanceAmount(detailPayment), 2)}
                    <small>
                      Gap: {formatNullableCurrency(getGatewayAmountGap(getCalculatedAdvanceAmount(detailPayment), detailPayment.gatewayPaymentAmount))}
                    </small>
                  </strong>
                </div>
                <div>
                  <span>DB advance amount</span>
                  <strong>
                    {formatCurrency(detailPayment.amount, 2)}
                    <small>
                      Gap: {formatNullableCurrency(getGatewayAmountGap(detailPayment.amount, detailPayment.gatewayPaymentAmount))}
                    </small>
                  </strong>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="button-primary" type="button" onClick={closeDetailModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PaymentView;
