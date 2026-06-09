import { Router, Request, Response } from 'express';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../db';
import { getSalesReportEmailData, sendSalesReportEmail } from '../services/salesReport';

const router = Router();

type QueryRow<T> = T & RowDataPacket;

const wrapAsync = (fn: (req: Request, res: Response) => Promise<unknown>) => (
  req: Request,
  res: Response,
  next: (error: unknown) => void
) => {
  Promise.resolve(fn(req, res)).catch(next);
};

const parseDays = (value: string | undefined, fallback = 14) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parsePositiveInteger = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseNonNegativeAmount = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const parsePositiveAmount = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const formatDayRows = (rows: Array<{ day: string; count?: number; totalAmount?: number }>, days: number) => {
  const data = new Map(rows.map((row) => [row.day, row]));
  const result: Array<{ day: string; count: number; totalAmount: number }> = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const day = date.toISOString().slice(0, 10);
    result.push({
      day,
      count: Number(data.get(day)?.count ?? 0),
      totalAmount: Number(data.get(day)?.totalAmount ?? 0)
    });
  }

  return result;
};

const isMissingTableError = (error: unknown) => (
  typeof error === 'object' && error !== null &&
  'code' in error && (error as { code: string }).code === 'ER_NO_SUCH_TABLE'
);

const isMissingAccountTransactionsTableError = (error: unknown) => (
  isMissingTableError(error) &&
  'message' in (error as { message?: string }) &&
  typeof (error as { message?: string }).message === 'string' &&
  (error as { message: string }).message.includes('account_transactions')
);

router.get('/daily-bookings', wrapAsync(async (req: Request, res: Response) => {
  const days = parseDays(req.query.days as string);

  try {
    const [rows] = await pool.query<
      Array<QueryRow<{ day: string; count: number }>>
    >(
      `SELECT DATE_FORMAT(cb.created_on, '%Y-%m-%d') AS day, COUNT(DISTINCT p.booking_id) AS count
       FROM payment p
       JOIN car_bookings cb ON cb.id = p.booking_id
       WHERE cb.created_on >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         AND p.row_status = 0
         AND p.status = 'SUCCESS'
       GROUP BY day
       ORDER BY day`,
      [days]
    );

    res.json({ days, data: formatDayRows(rows, days) });
  } catch (error) {
    if (isMissingTableError(error)) {
      return res.json({ days, data: formatDayRows([], days) });
    }
    throw error;
  }
}));

router.get('/daily-earnings', wrapAsync(async (req: Request, res: Response) => {
  const days = parseDays(req.query.days as string);

  try {
    const [rows] = await pool.query<
      Array<QueryRow<{ day: string; totalAmount: number }>>
    >(
      `SELECT DATE_FORMAT(cb.created_on, '%Y-%m-%d') AS day, COALESCE(SUM(p.amount), 0) AS totalAmount
       FROM payment p
       JOIN car_bookings cb ON cb.id = p.booking_id
       WHERE cb.created_on >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         AND p.row_status = 0
         AND p.status = 'SUCCESS'
       GROUP BY day
       ORDER BY day`,
      [days]
    );

    res.json({ days, data: formatDayRows(rows, days) });
  } catch (error) {
    if (isMissingTableError(error)) {
      return res.json({ days, data: formatDayRows([], days) });
    }
    throw error;
  }
}));

router.get('/pending-payments', wrapAsync(async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<
      Array<QueryRow<{
        paymentId: number;
        bookingId: number | null;
        vendorId: number | null;
        userId: number | null;
        vendorName: string;
        vendorPhoneNumber: string | null;
        customerName: string;
        customerPhoneNumber: string | null;
        amount: number;
        totalAmount: number;
        bookingStatus: string | null;
        bookingStartDate: Date | null;
        bookingEndDate: Date | null;
        platformCharges: number;
        remainingAmount: number;
        paymentTrackerId: number | null;
        paymentPayto: number | null;
        paidAmount: number | null;
        profit: number | null;
        paymentNotes: string | null;
      }>>
    >(
      `SELECT p.id AS paymentId,
              p.booking_id AS bookingId,
              p.vendor_id AS vendorId,
              cb.user_id AS userId,
              COALESCE(u.name, CONCAT('Vendor #', p.vendor_id), 'Unknown vendor') AS vendorName,
              u.phone_number AS vendorPhoneNumber,
              COALESCE(customer.name, CONCAT('Customer #', cb.user_id), 'Unknown customer') AS customerName,
              customer.phone_number AS customerPhoneNumber,
              p.amount AS amount,
              COALESCE(cb.price, 0) AS totalAmount,
              cb.status AS bookingStatus,
              cb.start_date_time AS bookingStartDate,
              cb.end_date_time AS bookingEndDate,
              234.82 AS platformCharges,
              p.amount - 234.82 AS remainingAmount,
              ptr.id AS paymentTrackerId,
              ptr.payto AS paymentPayto,
              ptr.amount_paid AS paidAmount,
              ptr.profit AS profit,
              ptr.notes AS paymentNotes
       FROM payment p
       LEFT JOIN users u ON u.id = p.vendor_id
       LEFT JOIN car_bookings cb ON cb.id = p.booking_id
       LEFT JOIN users customer ON customer.id = cb.user_id
       LEFT JOIN (
         SELECT pt.*
         FROM payment_tracker pt
         JOIN (
           SELECT payment_id, MAX(id) AS id
           FROM payment_tracker
           GROUP BY payment_id
         ) latest_tracker ON latest_tracker.id = pt.id
       ) ptr ON ptr.payment_id = p.id
       WHERE p.row_status = 0
         AND p.status = 'SUCCESS'
       ORDER BY p.created_on DESC, p.id DESC`
    );

    res.json({
      data: rows.map((row) => ({
        vendorId: row.vendorId,
        userId: row.userId,
        paymentId: row.paymentId,
        bookingId: row.bookingId,
        vendorName: row.vendorName,
        vendorPhoneNumber: row.vendorPhoneNumber,
        customerName: row.customerName,
        customerPhoneNumber: row.customerPhoneNumber,
        amount: Number(row.amount),
        totalAmount: Number(row.totalAmount),
        bookingStatus: row.bookingStatus ?? 'Unknown',
        bookingStartDate: row.bookingStartDate,
        bookingEndDate: row.bookingEndDate,
        platformCharges: Number(row.platformCharges),
        remainingAmount: Number(row.remainingAmount),
        paymentTrackerId: row.paymentTrackerId,
        paymentPayto: row.paymentPayto,
        paidAmount: row.paidAmount === null ? null : Number(row.paidAmount),
        profit: row.profit === null ? null : Number(row.profit),
        paymentNotes: row.paymentNotes
      }))
    });
  } catch (error) {
    if (isMissingTableError(error)) {
      return res.json({ data: [] });
    }
    throw error;
  }
}));

router.get('/subscriptions', wrapAsync(async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<
      Array<QueryRow<{
        id: number;
        vendorId: number | null;
        vendorName: string;
        status: string | null;
        amount: number | null;
        startDate: Date | null;
        endDate: Date | null;
        createdOn: Date | null;
      }>>
    >(
      `SELECT s.id,
              s.vendor_id AS vendorId,
              COALESCE(u.name, CONCAT('Vendor #', s.vendor_id), 'Unknown vendor') AS vendorName,
              s.status,
              s.amount,
              s.start_date AS startDate,
              s.end_date AS endDate,
              s.created_on AS createdOn
       FROM subscriptions s
       LEFT JOIN users u ON u.id = s.vendor_id
       WHERE s.row_status = 0
         AND (s.status IS NULL OR LOWER(s.status) <> 'pending')
       ORDER BY s.created_on DESC, s.id DESC`
    );

    res.json({
      data: rows.map((row) => ({
        id: row.id,
        vendorId: row.vendorId,
        vendorName: row.vendorName,
        status: row.status ?? 'Unknown',
        amount: row.amount === null ? 0 : Number(row.amount),
        startDate: row.startDate,
        endDate: row.endDate,
        createdOn: row.createdOn
      }))
    });
  } catch (error) {
    if (isMissingTableError(error)) {
      return res.json({ data: [] });
    }
    throw error;
  }
}));

router.get('/account-summary', wrapAsync(async (_req: Request, res: Response) => {
  try {
    const [paymentRows] = await pool.query<
      Array<QueryRow<{ totalProfit: number; totalRemaining: number }>>
    >(
      `SELECT
         COALESCE(SUM(CASE WHEN ptr.id IS NULL THEN 0 ELSE ptr.profit END), 0) AS totalProfit,
         COALESCE(SUM(CASE WHEN ptr.id IS NULL THEN p.amount ELSE 0 END), 0) AS totalRemaining
       FROM payment p
       LEFT JOIN (
         SELECT pt.*
         FROM payment_tracker pt
         JOIN (
           SELECT payment_id, MAX(id) AS id
           FROM payment_tracker
           GROUP BY payment_id
         ) latest_tracker ON latest_tracker.id = pt.id
       ) ptr ON ptr.payment_id = p.id
       WHERE p.row_status = 0
         AND p.status = 'SUCCESS'`
    );

    const [subscriptionRows] = await pool.query<
      Array<QueryRow<{ totalSubscriptionAmount: number }>>
    >(
      `SELECT COALESCE(SUM(amount), 0) AS totalSubscriptionAmount
       FROM subscriptions
       WHERE row_status = 0
         AND (status IS NULL OR LOWER(status) <> 'pending')`
    );

    let moneyAdded = 0;
    let expense = 0;
    let transactions: Array<{
      id: number;
      transactionType: string;
      amount: number;
      notes: string | null;
      transactionDate: Date | null;
      createdOn: Date | null;
    }> = [];

    try {
      const [accountRows] = await pool.query<
        Array<QueryRow<{ moneyAdded: number; expense: number }>>
      >(
        `SELECT
           COALESCE(SUM(CASE WHEN transaction_type = 'MONEY_ADDED' THEN amount ELSE 0 END), 0) AS moneyAdded,
           COALESCE(SUM(CASE WHEN transaction_type = 'EXPENSE' THEN amount ELSE 0 END), 0) AS expense
         FROM account_transactions
         WHERE row_status = 0`
      );

      const [transactionRows] = await pool.query<
        Array<QueryRow<{
          id: number;
          transactionType: string;
          amount: number;
          notes: string | null;
          transactionDate: Date | null;
          createdOn: Date | null;
        }>>
      >(
        `SELECT id,
                transaction_type AS transactionType,
                amount,
                notes,
                transaction_date AS transactionDate,
                created_on AS createdOn
         FROM account_transactions
         WHERE row_status = 0
         ORDER BY transaction_date DESC, id DESC
         LIMIT 50`
      );

      const accountSummary = accountRows[0] ?? { moneyAdded: 0, expense: 0 };
      moneyAdded = Number(accountSummary.moneyAdded);
      expense = Number(accountSummary.expense);
      transactions = transactionRows.map((row) => ({
        id: row.id,
        transactionType: row.transactionType,
        amount: Number(row.amount),
        notes: row.notes,
        transactionDate: row.transactionDate,
        createdOn: row.createdOn
      }));
    } catch (error) {
      if (!isMissingAccountTransactionsTableError(error)) {
        throw error;
      }
    }

    const paymentSummary = paymentRows[0] ?? { totalProfit: 0, totalRemaining: 0 };
    const subscriptionSummary = subscriptionRows[0] ?? { totalSubscriptionAmount: 0 };
    const totalProfit = Number(paymentSummary.totalProfit);
    const totalRemaining = Number(paymentSummary.totalRemaining);
    const totalSubscriptionAmount = Number(subscriptionSummary.totalSubscriptionAmount);
    const total = totalProfit + totalRemaining + totalSubscriptionAmount + moneyAdded;
    const overallTotal = total - expense;

    res.json({
      totalProfit,
      totalRemaining,
      totalSubscriptionAmount,
      moneyAdded,
      total,
      expense,
      overallTotal,
      transactions
    });
  } catch (error) {
    if (isMissingTableError(error)) {
      return res.json({
        totalProfit: 0,
        totalRemaining: 0,
        totalSubscriptionAmount: 0,
        moneyAdded: 0,
        total: 0,
        expense: 0,
        overallTotal: 0,
        transactions: []
      });
    }
    throw error;
  }
}));

router.post('/account-transactions', wrapAsync(async (req: Request, res: Response) => {
  const transactionType = typeof req.body.transactionType === 'string'
    ? req.body.transactionType.trim().toUpperCase()
    : '';
  const amount = parsePositiveAmount(req.body.amount);
  const notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : '';
  const transactionDate = typeof req.body.transactionDate === 'string' && req.body.transactionDate.trim()
    ? req.body.transactionDate.trim()
    : null;

  if (transactionType !== 'MONEY_ADDED' && transactionType !== 'EXPENSE') {
    return res.status(400).json({ error: 'transactionType must be MONEY_ADDED or EXPENSE.' });
  }

  if (amount === null) {
    return res.status(400).json({ error: 'Amount must be greater than zero.' });
  }

  if (notes.length > 255) {
    return res.status(400).json({ error: 'Notes must be 255 characters or fewer.' });
  }

  try {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO account_transactions (transaction_type, amount, notes, transaction_date, created_on, row_status)
       VALUES (?, ?, ?, COALESCE(?, NOW(6)), NOW(6), 0)`,
      [transactionType, amount, notes || null, transactionDate]
    );

    res.status(201).json({
      id: result.insertId,
      transactionType,
      amount,
      notes,
      transactionDate
    });
  } catch (error) {
    if (isMissingAccountTransactionsTableError(error)) {
      return res.status(500).json({
        error: 'account_transactions table is missing. Please create it before adding account entries.'
      });
    }
    throw error;
  }
}));

router.delete('/account-transactions/:id', wrapAsync(async (req: Request, res: Response) => {
  const transactionId = parsePositiveInteger(req.params.id);

  if (!transactionId) {
    return res.status(400).json({ error: 'Account entry id is required.' });
  }

  try {
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE account_transactions
       SET row_status = 1, modified_on = NOW(6)
       WHERE id = ?
         AND row_status = 0`,
      [transactionId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Account entry not found.' });
    }

    res.json({ deleted: true, id: transactionId });
  } catch (error) {
    if (isMissingAccountTransactionsTableError(error)) {
      return res.status(500).json({
        error: 'account_transactions table is missing. Please create it before deleting account entries.'
      });
    }
    throw error;
  }
}));

router.post('/payment-tracker', wrapAsync(async (req: Request, res: Response) => {
  const paymentId = parsePositiveInteger(req.body.paymentId);
  const carBookingId = parsePositiveInteger(req.body.carBookingId);
  const requestedPayto = req.body.payto;
  const payto = requestedPayto === null || requestedPayto === undefined ? null : parsePositiveInteger(requestedPayto);
  const amountPaid = parseNonNegativeAmount(req.body.amountPaid);
  const notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : '';

  if (!paymentId || !carBookingId) {
    return res.status(400).json({ error: 'paymentId and carBookingId are required.' });
  }

  if (requestedPayto !== null && requestedPayto !== undefined && !payto) {
    return res.status(400).json({ error: 'payto must be a valid user id or null.' });
  }

  if (amountPaid === null) {
    return res.status(400).json({ error: 'amountPaid must be zero or greater.' });
  }

  if (notes.length > 200) {
    return res.status(400).json({ error: 'Notes must be 200 characters or fewer.' });
  }

  const [paymentRows] = await pool.query<Array<QueryRow<{ amount: number }>>>(
    `SELECT amount
     FROM payment
     WHERE id = ?
     LIMIT 1`,
    [paymentId]
  );

  const payment = paymentRows[0];

  if (!payment) {
    return res.status(404).json({ error: 'Payment record not found.' });
  }

  const profit = Number(payment.amount) - amountPaid;

  const [existingRows] = await pool.query<Array<QueryRow<{ id: number }>>>(
    `SELECT id
     FROM payment_tracker
     WHERE payment_id = ?
     ORDER BY id DESC
     LIMIT 1`,
    [paymentId]
  );

  const existingTracker = existingRows[0];

  if (existingTracker) {
    await pool.query<ResultSetHeader>(
      `UPDATE payment_tracker
       SET car_booking_id = ?, payto = ?, amount_paid = ?, profit = ?, notes = ?
       WHERE id = ?`,
      [carBookingId, payto, amountPaid, profit, notes || null, existingTracker.id]
    );

    return res.json({
      id: existingTracker.id,
      paymentId,
      carBookingId,
      payto,
      amountPaid,
      profit,
      notes
    });
  }

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO payment_tracker (payment_id, car_booking_id, payto, amount_paid, profit, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [paymentId, carBookingId, payto, amountPaid, profit, notes || null]
  );

  res.status(201).json({
    id: result.insertId,
    paymentId,
    carBookingId,
    payto,
    amountPaid,
    profit,
    notes
  });
}));

router.get('/summary', wrapAsync(async (_req: Request, res: Response) => {
  try {
    const [summaryRows] = await pool.query<
      Array<QueryRow<{ totalBookings: number; grossEarnings: number }>>
    >(
      `SELECT
         COUNT(DISTINCT p.booking_id) AS totalBookings,
         COALESCE(SUM(p.amount), 0) AS grossEarnings
       FROM payment p
       JOIN car_bookings cb ON cb.id = p.booking_id
       WHERE p.row_status = 0
         AND p.status = 'SUCCESS'`
    );

    const [userRows] = await pool.query<
      Array<QueryRow<{ totalCustomers: number; totalVendors: number }>>
    >(
      `SELECT
         COUNT(DISTINCT CASE WHEN ur.role_id = 1 THEN ur.user_id END) AS totalCustomers,
         COUNT(DISTINCT CASE WHEN ur.role_id = 2 THEN ur.user_id END) AS totalVendors
       FROM user_roles ur
       WHERE ur.role_id IN (1, 2)`
    );

    const [pendingRows] = await pool.query<
      Array<QueryRow<{ pendingAmount: number }>>
    >(
      `SELECT COALESCE(SUM(amount), 0) AS pendingAmount
       FROM payment
       WHERE row_status = 0
         AND status = 'CREATED'`
    );

    const [deletedRows] = await pool.query<
      Array<QueryRow<{ totalDeletedCustomers: number; totalDeletedVendors: number }>>
    >(
      `SELECT
         COUNT(DISTINCT CASE WHEN ur.role_id = 1 THEN da.user_id END) AS totalDeletedCustomers,
         COUNT(DISTINCT CASE WHEN ur.role_id = 2 THEN da.user_id END) AS totalDeletedVendors
       FROM deleted_accounts da
       JOIN user_roles ur ON ur.user_id = da.user_id
       WHERE ur.role_id IN (1, 2)`
    );

    const summary = summaryRows[0] ?? { totalBookings: 0, grossEarnings: 0 };
    const users = userRows[0] ?? { totalCustomers: 0, totalVendors: 0 };
    const pending = pendingRows[0] ?? { pendingAmount: 0 };
    const deleted = deletedRows[0] ?? { totalDeletedCustomers: 0, totalDeletedVendors: 0 };

    res.json({
      totalBookings: Number(summary.totalBookings),
      totalCustomers: Number(users.totalCustomers),
      totalVendors: Number(users.totalVendors),
      totalDeletedCustomers: Number(deleted.totalDeletedCustomers),
      totalDeletedVendors: Number(deleted.totalDeletedVendors),
      grossEarnings: Number(summary.grossEarnings),
      pendingAmount: Number(pending.pendingAmount)
    });
  } catch (error) {
    if (isMissingTableError(error)) {
      return res.json({
        totalBookings: 0,
        totalCustomers: 0,
        totalVendors: 0,
        totalDeletedCustomers: 0,
        totalDeletedVendors: 0,
        grossEarnings: 0,
        pendingAmount: 0
      });
    }
    throw error;
  }
}));

router.get('/sales-report/yesterday', wrapAsync(async (_req: Request, res: Response) => {
  const report = await getSalesReportEmailData();
  res.json(report);
}));

router.post('/sales-report/send', wrapAsync(async (req: Request, res: Response) => {
  const report = await sendSalesReportEmail();
  res.json({ sent: true, report });
}));

router.get('/day-wise-analytics', wrapAsync(async (req: Request, res: Response) => {
  const { fromDate, toDate } = req.query as { fromDate?: string; toDate?: string };

  if (!fromDate || !toDate) {
    return res.status(400).json({ error: 'fromDate and toDate are required' });
  }

  try {
    // Get users and vendors count by date
    const [userVendorRows] = await pool.query<
      Array<QueryRow<{ day: string; totalUsers: number; totalVendors: number }>>
    >(
      `SELECT
        DATE_FORMAT(u.created_on, '%Y-%m-%d') AS day,
        COUNT(CASE WHEN roles.role_id = 1 THEN 1 END) AS totalUsers,
        COUNT(CASE WHEN roles.role_id = 2 THEN 1 END) AS totalVendors
       FROM users u
       LEFT JOIN (
         SELECT user_id, MIN(role_id) AS role_id
         FROM user_roles
         WHERE role_id IN (1, 2)
         GROUP BY user_id
       ) roles ON roles.user_id = u.id
       WHERE u.created_on >= ?
         AND u.created_on < DATE_ADD(?, INTERVAL 1 DAY)
       GROUP BY day
       ORDER BY day`,
      [fromDate, toDate]
    );

    // Get bookings, revenue, and profit by date
    const [bookingRows] = await pool.query<
      Array<QueryRow<{ day: string; totalBookings: number; totalRevenue: number; totalProfit: number }>>
    >(
      `SELECT
        DATE_FORMAT(successful_bookings.created_on, '%Y-%m-%d') AS day,
        COUNT(*) AS totalBookings,
        COALESCE(SUM(successful_bookings.paidAmount), 0) AS totalRevenue,
        COALESCE(SUM(successful_bookings.bookingAmount), 0) AS totalProfit
       FROM (
         SELECT
           p.booking_id,
           cb.created_on,
           COALESCE(cb.price, 0) AS bookingAmount,
           COALESCE(SUM(p.amount), 0) AS paidAmount
         FROM payment p
         JOIN car_bookings cb ON cb.id = p.booking_id
         WHERE cb.created_on >= ?
           AND cb.created_on < DATE_ADD(?, INTERVAL 1 DAY)
           AND p.row_status = 0
           AND p.status = 'SUCCESS'
         GROUP BY p.booking_id, cb.created_on, cb.price
       ) successful_bookings
       GROUP BY day
       ORDER BY day`,
      [fromDate, toDate]
    );

    const [deletedAccountRows] = await pool.query<
      Array<QueryRow<{ day: string; deletedUsers: number; deletedVendors: number }>>
    >(
      `SELECT
        DATE_FORMAT(da.deleted_on, '%Y-%m-%d') AS day,
        COUNT(CASE WHEN roles.role_id = 1 THEN 1 END) AS deletedUsers,
        COUNT(CASE WHEN roles.role_id = 2 THEN 1 END) AS deletedVendors
       FROM deleted_accounts da
       LEFT JOIN (
         SELECT user_id, MIN(role_id) AS role_id
         FROM user_roles
         WHERE role_id IN (1, 2)
         GROUP BY user_id
       ) roles ON roles.user_id = da.user_id
       WHERE da.deleted_on >= ?
         AND da.deleted_on < DATE_ADD(?, INTERVAL 1 DAY)
       GROUP BY day
       ORDER BY day`,
      [fromDate, toDate]
    );

    // Combine the data by date
    const combinedData = new Map<string, {
      date: string;
      totalBookings: number;
      totalUsers: number;
      totalVendors: number;
      totalRevenue: number;
      totalProfit: number;
      deletedUsers: number;
      deletedVendors: number;
    }>();

    // Initialize all dates in range
    const from = new Date(fromDate);
    const to = new Date(toDate);
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      combinedData.set(dateStr, {
        date: dateStr,
        totalBookings: 0,
        totalUsers: 0,
        totalVendors: 0,
        totalRevenue: 0,
        totalProfit: 0,
        deletedUsers: 0,
        deletedVendors: 0
      });
    }

    // Fill user/vendor data
    userVendorRows.forEach(row => {
      const existing = combinedData.get(row.day);
      if (existing) {
        existing.totalUsers = Number(row.totalUsers);
        existing.totalVendors = Number(row.totalVendors);
      }
    });

    // Fill booking/revenue/profit data
    bookingRows.forEach(row => {
      const existing = combinedData.get(row.day);
      if (existing) {
        existing.totalBookings = Number(row.totalBookings);
        existing.totalRevenue = Number(row.totalRevenue);
        existing.totalProfit = Number(row.totalProfit);
      }
    });

    deletedAccountRows.forEach(row => {
      const existing = combinedData.get(row.day);
      if (existing) {
        existing.deletedUsers = Number(row.deletedUsers);
        existing.deletedVendors = Number(row.deletedVendors);
      }
    });

    const result = Array.from(combinedData.values());
    res.json(result);

  } catch (error) {
    console.error('Day-wise analytics error:', error);
    if (isMissingTableError(error)) {
      return res.json([]);
    }
    throw error;
  }
}));

router.get('/test-date-format', wrapAsync(async (_req: Request, res: Response) => {
  try {
    // Check how DATE() function works
    const [dateTest] = await pool.query(`SELECT created_on, DATE(created_on) as date_only, DATE_FORMAT(created_on, '%Y-%m-%d') as formatted_date FROM car_bookings WHERE status = 'Complete successfully' LIMIT 3`);

    res.json({
      dateTest: dateTest
    });

  } catch (error) {
    console.error('Test date format error:', error);
    const message = error instanceof Error ? error.message : 'Unknown database error';
    res.status(500).json({ error: 'Database error', details: message });
  }
}));

export default router;
