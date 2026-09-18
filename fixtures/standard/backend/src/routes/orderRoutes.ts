import { Router, Request, Response } from 'express';
import { orderService } from '../services/orderService';

export const orderRouter = Router();

export async function getOrderHandler(req: Request, res: Response) {
  const { id } = req.params;
  const order = await orderService.fetchOrder(id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  return res.json(order);
}

export async function checkoutHandler(req: Request, res: Response) {
  try {
    const { orderId, userId, amount } = req.body;
    const result = await orderService.processCheckout({ orderId, userId, amount });
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
}

orderRouter.get('/orders/:id', getOrderHandler);
orderRouter.post('/orders/checkout', checkoutHandler);
