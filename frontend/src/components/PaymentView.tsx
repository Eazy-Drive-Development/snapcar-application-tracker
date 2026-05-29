import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createPaymentTracker, getPendingPayments } from '../api/analytics';

interface VendorPayout {
  paymentId: number;
  bookingId: number | null;
  vendorId: number | null;
  userId: number | null;
  vendorName: string;
  customerName: string;
  amount: number;
  totalAmount: number;
  bookingStatus: string;
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

function formatCurrency(value: number, fractionDigits = 0) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
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

function formatBookingDate(startDate: string | null, endDate: string | null) {
  return `${formatDateTime(startDate)} - ${formatDateTime(endDate)}`;
}

function isCancelledStatus(status: string) {
  return status.toLowerCase().includes('cancel');
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

  const totalAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalRemainingAmount = payments.reduce((sum, payment) => (
    payment.paymentTrackerId === null ? sum + payment.amount : sum
  ), 0);
  const totalProfit = payments.reduce((sum, payment) => (
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
    setPaymentAmount(String(payment.paidAmount ?? payment.remainingAmount));
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
              <p>{payments.length}</p>
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
              <p>{formatCurrency(totalProfit)}</p>
            </article>
          </section>

          <section className="report-card wide-card">
            <h2>Vendor payout list</h2>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Booking id</th>
                    <th>Vendor name</th>
                    <th>Total amount</th>
                    <th>Advance amount</th>
                    <th>Booking status</th>
                    <th>Booking date</th>
                    <th>Remaining amount</th>
                    <th>Profit</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length > 0 ? (
                    payments.map((row) => {
                      const isPaid = row.paymentTrackerId !== null;

                      return (
                      <tr key={row.paymentId}>
                        <td>{row.bookingId ?? 'Not set'}</td>
                        <td>{row.vendorName}</td>
                        <td>{formatCurrency(row.totalAmount)}</td>
                        <td>{formatCurrency(row.amount)}</td>
                        <td>{row.bookingStatus}</td>
                        <td>{formatBookingDate(row.bookingStartDate, row.bookingEndDate)}</td>
                        <td>{formatCurrency(row.remainingAmount)}</td>
                        <td>{isPaid && row.profit !== null ? formatCurrency(row.profit) : '-'}</td>
                        <td>
                          <button
                            className={`paid-button ${isPaid ? 'edit' : ''}`}
                            type="button"
                            onClick={() => openPaymentModal(row)}
                          >
                            {isPaid ? 'Edit' : 'Pay'}
                          </button>
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
                <p>Customer: {selectedPayment.customerName}</p>
                <p>Vendor: {selectedPayment.vendorName}</p>
              </div>
              <button className="modal-close" type="button" onClick={closePaymentModal} aria-label="Close payment popup">
                x
              </button>
            </div>

            <form className="payment-form" onSubmit={handlePaymentSubmit}>
              {selectedPayment.paymentTrackerId && selectedPayment.paidAmount !== null && (
                <div className="paid-amount-preview">
                  <span>Paid amount</span>
                  <strong>{formatCurrency(selectedPayment.paidAmount)}</strong>
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
                    Vendor
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="refundTarget"
                      value="user"
                      checked={refundTarget === 'user'}
                      onChange={() => setRefundTarget('user')}
                    />
                    User
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
    </div>
  );
}

export default PaymentView;
