import dotenv from 'dotenv';
import app from './app';
import { scheduleSalesReportEmail } from './services/salesReport';

dotenv.config();

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Snapcar Tracker backend listening on http://localhost:${port}`);
});

scheduleSalesReportEmail();
