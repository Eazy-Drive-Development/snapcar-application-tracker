import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createAccountTransaction, deleteAccountTransaction, getAccountSummary } from '../api/analytics';
import type { AccountSummary, AccountTransactionType } from '../api/analytics';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Not set';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value));
}

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function AccountView() {
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactionType, setTransactionType] = useState<AccountTransactionType | null>(null);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [transactionDate, setTransactionDate] = useState(getTodayInputValue());
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<number | null>(null);

  const loadAccountSummary = async () => {
    try {
      const result = await getAccountSummary();
      setSummary(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred while loading account details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAccountSummary();
  }, []);

  const openTransactionModal = (type: AccountTransactionType) => {
    setTransactionType(type);
    setAmount('');
    setNotes('');
    setTransactionDate(getTodayInputValue());
    setFormError(null);
  };

  const closeTransactionModal = () => {
    setTransactionType(null);
    setAmount('');
    setNotes('');
    setTransactionDate(getTodayInputValue());
    setFormError(null);
    setIsSubmitting(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!transactionType) {
      return;
    }

    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError('Enter an amount greater than zero.');
      return;
    }

    if (notes.trim().length > 255) {
      setFormError('Notes must be 255 characters or fewer.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);
      await createAccountTransaction({
        transactionType,
        amount: parsedAmount,
        notes: notes.trim(),
        transactionDate
      });
      await loadAccountSummary();
      closeTransactionModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save account entry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEntry = async (id: number) => {
    const shouldDelete = window.confirm('Are you sure you want to delete this account entry?');

    if (!shouldDelete) {
      return;
    }

    try {
      setDeletingEntryId(id);
      await deleteAccountTransaction(id);
      await loadAccountSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete account entry.');
    } finally {
      setDeletingEntryId(null);
    }
  };

  const modalTitle = transactionType === 'EXPENSE' ? 'Add expense' : 'Add money';

  return (
    <div className="view-content">
      <header className="view-header account-header">
        <div>
          <h1>Account</h1>
          <p>Review account totals from payment tracking and subscriptions.</p>
        </div>
      </header>

      {isLoading ? (
        <div className="status-banner">Loading account details...</div>
      ) : error ? (
        <div className="status-banner error">{error}</div>
      ) : summary ? (
        <main className="view-main account-main">
          <section className="report-card account-balance-card">
            <h2>Existing balance</h2>
            <div className="account-balance-list">
              <div>
                <span>Payment total profit</span>
                <strong>{formatCurrency(summary.totalProfit)}</strong>
              </div>
              <div>
                <span>Payment total remaining</span>
                <strong>{formatCurrency(summary.totalRemaining)}</strong>
              </div>
              <div>
                <span>Total subscription amount</span>
                <strong>{formatCurrency(summary.totalSubscriptionAmount)}</strong>
              </div>
              <div>
                <span>Money added externally</span>
                <strong>{formatCurrency(summary.moneyAdded)}</strong>
              </div>
              <div>
                <span>Expense</span>
                <strong>{formatCurrency(summary.expense)}</strong>
              </div>
              <div className="account-balance-total">
                <span>Overall total in account</span>
                <strong>{formatCurrency(summary.overallTotal)}</strong>
              </div>
            </div>
          </section>

          <section className="report-card wide-card">
            <div className="account-table-header">
              <h2>Account entries</h2>
              <div className="account-actions">
                <button className="button-secondary" type="button" onClick={() => openTransactionModal('EXPENSE')}>
                  Add expense
                </button>
                <button className="button-primary" type="button" onClick={() => openTransactionModal('MONEY_ADDED')}>
                  Add money
                </button>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Notes</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.transactions.length > 0 ? (
                    summary.transactions.map((transaction) => (
                      <tr key={transaction.id}>
                        <td>{formatDate(transaction.transactionDate)}</td>
                        <td>
                          <span className={`status-pill ${transaction.transactionType === 'EXPENSE' ? 'danger' : 'success'}`}>
                            {transaction.transactionType === 'EXPENSE' ? 'Expense' : 'Money added'}
                          </span>
                        </td>
                        <td>{formatCurrency(transaction.amount)}</td>
                        <td>{transaction.notes || '-'}</td>
                        <td>
                          <button
                            className="delete-button"
                            type="button"
                            onClick={() => handleDeleteEntry(transaction.id)}
                            disabled={deletingEntryId === transaction.id}
                          >
                            {deletingEntryId === transaction.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="empty-state">
                        No account entries found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      ) : (
        <div className="status-banner error">Account details are unavailable.</div>
      )}

      {transactionType && (
        <div className="modal-overlay" role="presentation" onClick={closeTransactionModal}>
          <div
            className="payment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2 id="account-modal-title">{modalTitle}</h2>
                <p>{transactionType === 'EXPENSE' ? 'Record money spent from account.' : 'Record money added manually.'}</p>
              </div>
              <button className="modal-close" type="button" onClick={closeTransactionModal} aria-label="Close account popup">
                x
              </button>
            </div>

            <form className="payment-form" onSubmit={handleSubmit}>
              <label className="form-field">
                <span>Amount</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="Enter amount"
                />
              </label>

              <label className="form-field">
                <span>Date</span>
                <input
                  type="date"
                  value={transactionDate}
                  onChange={(event) => setTransactionDate(event.target.value)}
                />
              </label>

              <label className="form-field">
                <span>Notes</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Enter notes"
                  maxLength={255}
                  rows={4}
                />
              </label>

              {formError && <div className="form-error">{formError}</div>}

              <div className="modal-actions">
                <button className="button-secondary" type="button" onClick={closeTransactionModal}>
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

export default AccountView;
