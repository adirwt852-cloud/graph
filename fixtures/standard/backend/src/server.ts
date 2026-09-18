import express from 'express';
import { userRouter } from './routes/userRoutes';
import { orderRouter } from './routes/orderRoutes';

export function createFixtureApp() {
  const app = express();
  app.use(express.json());
  
  app.use('/api', userRouter);
  app.use('/api', orderRouter);

  return app;
}
