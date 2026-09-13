import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import { listingsRouter } from './routes/listings.js';
import { bidsRouter } from './routes/bids.js';
import { ordersRouter } from './routes/orders.js';
import { usersRouter } from './routes/users.js';
import { authRouter } from './routes/auth.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/listings', listingsRouter);
app.use('/bids', bidsRouter);
app.use('/orders', ordersRouter);

app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Golden Attic API listening on port ${PORT}`);
});
