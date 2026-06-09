import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { RowDataPacket } from 'mysql2';
import pool from '../db';

const REPORT_TIME_ZONE = process.env.SALES_REPORT_TIME_ZONE ?? 'Asia/Kolkata';
const REPORT_CRON = process.env.SALES_REPORT_CRON ?? '0 10 * * *';
const PLATFORM_NAME = 'Snapcar';

type QueryRow<T> = T & RowDataPacket;

export interface SalesReportData {
  label: string;
  fromDate: string;
  toDate: string;
  totalNewUsers: number;
  totalNewVendors: number;
  totalBookings: number;
  totalRevenue: number;
}

export interface SalesReportEmailData {
  overall: {
    totalCustomers: number;
    totalVendors: number;
    totalBookings: number;
    totalDeletedCustomers: number;
    totalDeletedVendors: number;
  };
  yesterday: SalesReportData;
  monthToDate: SalesReportData;
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getYesterdayInTimeZone(timeZone = REPORT_TIME_ZONE) {
  const zonedNow = new Date(new Date().toLocaleString('en-US', { timeZone }));
  zonedNow.setDate(zonedNow.getDate() - 1);
  return formatDateInput(zonedNow);
}

export function getTodayInTimeZone(timeZone = REPORT_TIME_ZONE) {
  const zonedNow = new Date(new Date().toLocaleString('en-US', { timeZone }));
  return formatDateInput(zonedNow);
}

export function getMonthStartInTimeZone(timeZone = REPORT_TIME_ZONE) {
  const zonedNow = new Date(new Date().toLocaleString('en-US', { timeZone }));
  zonedNow.setDate(1);
  return formatDateInput(zonedNow);
}

export async function getSalesReportData(fromDate: string, toDate: string, label: string): Promise<SalesReportData> {
  const [userRows] = await pool.query<
    Array<QueryRow<{ totalNewUsers: number; totalNewVendors: number }>>
  >(
    `SELECT
       COUNT(CASE WHEN roles.role_id = 1 THEN 1 END) AS totalNewUsers,
       COUNT(CASE WHEN roles.role_id = 2 THEN 1 END) AS totalNewVendors
     FROM users u
     LEFT JOIN (
       SELECT user_id, MIN(role_id) AS role_id
       FROM user_roles
       WHERE role_id IN (1, 2)
       GROUP BY user_id
     ) roles ON roles.user_id = u.id
     WHERE u.created_on >= ?
       AND u.created_on < DATE_ADD(?, INTERVAL 1 DAY)`,
    [fromDate, toDate]
  );

  const [bookingRows] = await pool.query<
    Array<QueryRow<{ totalBookings: number; totalRevenue: number }>>
  >(
    `SELECT
       COUNT(DISTINCT p.booking_id) AS totalBookings,
       COALESCE(SUM(p.amount), 0) AS totalRevenue
     FROM payment p
     JOIN car_bookings cb ON cb.id = p.booking_id
     WHERE cb.created_on >= ?
       AND cb.created_on < DATE_ADD(?, INTERVAL 1 DAY)
       AND p.row_status = 0
       AND p.status = 'SUCCESS'`,
    [fromDate, toDate]
  );

  const users = userRows[0] ?? { totalNewUsers: 0, totalNewVendors: 0 };
  const bookings = bookingRows[0] ?? { totalBookings: 0, totalRevenue: 0 };

  return {
    label,
    fromDate,
    toDate,
    totalNewUsers: Number(users.totalNewUsers),
    totalNewVendors: Number(users.totalNewVendors),
    totalBookings: Number(bookings.totalBookings),
    totalRevenue: Number(bookings.totalRevenue)
  };
}

export async function getSalesReportEmailData(): Promise<SalesReportEmailData> {
  const yesterday = getYesterdayInTimeZone();
  const [overallRows] = await pool.query<
    Array<QueryRow<{
      totalCustomers: number;
      totalVendors: number;
      totalBookings: number;
      totalDeletedCustomers: number;
      totalDeletedVendors: number;
    }>>
  >(
    `SELECT
       (SELECT COUNT(DISTINCT CASE WHEN ur.role_id = 1 THEN ur.user_id END)
        FROM user_roles ur
        WHERE ur.role_id IN (1, 2)) AS totalCustomers,
       (SELECT COUNT(DISTINCT CASE WHEN ur.role_id = 2 THEN ur.user_id END)
        FROM user_roles ur
        WHERE ur.role_id IN (1, 2)) AS totalVendors,
       (SELECT COUNT(DISTINCT p.booking_id)
        FROM payment p
        JOIN car_bookings cb ON cb.id = p.booking_id
        WHERE p.row_status = 0
          AND p.status = 'SUCCESS') AS totalBookings,
       (SELECT COUNT(DISTINCT da.user_id)
        FROM deleted_accounts da
        JOIN user_roles ur ON ur.user_id = da.user_id
        WHERE ur.role_id = 1) AS totalDeletedCustomers,
       (SELECT COUNT(DISTINCT da.user_id)
        FROM deleted_accounts da
        JOIN user_roles ur ON ur.user_id = da.user_id
        WHERE ur.role_id = 2) AS totalDeletedVendors`
  );
  const overall = overallRows[0] ?? {
    totalCustomers: 0,
    totalVendors: 0,
    totalBookings: 0,
    totalDeletedCustomers: 0,
    totalDeletedVendors: 0
  };

  return {
    overall: {
      totalCustomers: Number(overall.totalCustomers),
      totalVendors: Number(overall.totalVendors),
      totalBookings: Number(overall.totalBookings),
      totalDeletedCustomers: Number(overall.totalDeletedCustomers),
      totalDeletedVendors: Number(overall.totalDeletedVendors)
    },
    yesterday: await getSalesReportData(yesterday, yesterday, "Yesterday's Report"),
    monthToDate: await getSalesReportData(
      getMonthStartInTimeZone(),
      getTodayInTimeZone(),
      'This Month to Date'
    )
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value);
}

function formatReportRange(report: SalesReportData) {
  return report.fromDate === report.toDate ? report.fromDate : `${report.fromDate} to ${report.toDate}`;
}

function buildTextSection(report: SalesReportData) {
  return [
    `${report.label} (${formatReportRange(report)})`,
    `New vendor registrations: ${report.totalNewVendors}`,
    `New user registrations: ${report.totalNewUsers}`,
    `Confirmed bookings: ${report.totalBookings}`,
    `Booking revenue: ${formatCurrency(report.totalRevenue)}`
  ].join('\n');
}

function buildHtmlSection(report: SalesReportData) {
  return `
    <h3 style="margin:24px 0 8px">${report.label}</h3>
    <p style="margin:0 0 10px;color:#475569">Period: <strong>${formatReportRange(report)}</strong></p>
    <table cellpadding="10" cellspacing="0" border="0" style="border-collapse:collapse;min-width:420px;margin-bottom:12px">
      <tr style="background:#f8fafc"><td>New vendor registrations</td><td><strong>${report.totalNewVendors}</strong></td></tr>
      <tr><td>New user registrations</td><td><strong>${report.totalNewUsers}</strong></td></tr>
      <tr style="background:#f8fafc"><td>Confirmed bookings</td><td><strong>${report.totalBookings}</strong></td></tr>
      <tr><td>Booking revenue</td><td><strong>${formatCurrency(report.totalRevenue)}</strong></td></tr>
    </table>
  `;
}

function buildOverallTextSection(report: SalesReportEmailData['overall']) {
  return [
    'Overall Totals',
    `Total customers: ${report.totalCustomers}`,
    `Total vendors: ${report.totalVendors}`,
    `Total bookings: ${report.totalBookings}`,
    `Total deleted customers: ${report.totalDeletedCustomers}`,
    `Total deleted vendors: ${report.totalDeletedVendors}`
  ].join('\n');
}

function buildOverallHtmlSection(report: SalesReportEmailData['overall']) {
  return `
    <h3 style="margin:24px 0 8px">Overall Totals</h3>
    <table cellpadding="10" cellspacing="0" border="0" style="border-collapse:collapse;min-width:420px;margin-bottom:12px">
      <tr style="background:#f8fafc"><td>Total customers</td><td><strong>${report.totalCustomers}</strong></td></tr>
      <tr><td>Total vendors</td><td><strong>${report.totalVendors}</strong></td></tr>
      <tr style="background:#f8fafc"><td>Total bookings</td><td><strong>${report.totalBookings}</strong></td></tr>
      <tr><td>Total deleted customers</td><td><strong>${report.totalDeletedCustomers}</strong></td></tr>
      <tr style="background:#f8fafc"><td>Total deleted vendors</td><td><strong>${report.totalDeletedVendors}</strong></td></tr>
    </table>
  `;
}

export function buildSalesReportEmail(report: SalesReportEmailData) {
  const subject = `${PLATFORM_NAME} Daily Sales Report - ${report.yesterday.toDate}`;
  const text = [
    `Hi Hitesh/Ajay,`,
    '',
    `Please find below the ${PLATFORM_NAME} sales summary with yesterday's report and this month-to-date status.`,
    '',
    buildOverallTextSection(report.overall),
    '',
    buildTextSection(report.yesterday),
    '',
    buildTextSection(report.monthToDate),
    '',
    `Regards,`,
    `${PLATFORM_NAME} Reports`
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
      <p>Hi Hitesh/Ajay,</p>
      <p>Please find below the <strong>${PLATFORM_NAME}</strong> sales summary with yesterday's report and this month-to-date status.</p>
      ${buildOverallHtmlSection(report.overall)}
      ${buildHtmlSection(report.yesterday)}
      ${buildHtmlSection(report.monthToDate)}
      <p>Regards,<br />${PLATFORM_NAME} Reports</p>
    </div>
  `;

  return { subject, text, html };
}

function getMailConfig() {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASSWORD,
    SMTP_PASS,
    SALES_REPORT_FROM,
    SALES_REPORT_TO
  } = process.env;
  const smtpPassword = SMTP_PASSWORD ?? SMTP_PASS;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !smtpPassword || !SALES_REPORT_FROM || !SALES_REPORT_TO) {
    return null;
  }

  return {
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    auth: {
      user: SMTP_USER,
      pass: smtpPassword
    },
    from: SALES_REPORT_FROM,
    to: SALES_REPORT_TO
  };
}

export function isSalesReportEmailConfigured() {
  return getMailConfig() !== null;
}

export async function sendSalesReportEmail() {
  const config = getMailConfig();

  if (!config) {
    throw new Error('Sales report email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SALES_REPORT_FROM, and SALES_REPORT_TO.');
  }

  const report = await getSalesReportEmailData();
  const email = buildSalesReportEmail(report);
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: config.auth
  });

  await transporter.sendMail({
    from: config.from,
    to: config.to,
    subject: email.subject,
    text: email.text,
    html: email.html
  });

  return report;
}

export function scheduleSalesReportEmail() {
  cron.schedule(REPORT_CRON, async () => {
    try {
      if (!isSalesReportEmailConfigured()) {
        // eslint-disable-next-line no-console
        console.log('Daily sales report email skipped because SMTP is not configured.');
        return;
      }

      await sendSalesReportEmail();
      // eslint-disable-next-line no-console
      console.log('Daily sales report email sent.');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to send daily sales report email:', error);
    }
  }, {
    timezone: REPORT_TIME_ZONE
  });
}
