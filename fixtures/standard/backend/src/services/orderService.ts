import { db } from '../db/database';
import { userService } from './userService';

export interface OrderResponse {
  id: string;
  orderId: string;
  customerId: string;
  totalAmount: number;
  currency: string;
  status: string;
}

export const orderService = {
  async fetchOrder(orderId: string): Promise<OrderResponse | null> {
    const order = await db.orders.findOne({ id: orderId });
    if (!order) return null;
    return {
      id: order.id,
      orderId: order.orderId,
      customerId: order.customerId,
      totalAmount: order.totalAmount,
      currency: order.currency,
      status: order.status
    };
  },

  async processCheckout(payload: { orderId: string; userId: string; amount: number }) {
    // Inter-service call
    const user = await userService.findUserById(payload.userId);
    if (!user) {
      throw new Error(`Customer ${payload.userId} not found`);
    }

    const newOrder = {
      id: payload.orderId || `ord_${Date.now()}`,
      orderId: payload.orderId || `ord_${Date.now()}`,
      customerId: payload.userId,
      totalAmount: payload.amount,
      currency: 'USD',
      status: 'completed',
    };

    await db.orders.insertOne(newOrder);

    return {
      success: true,
      txId: `tx_${Date.now()}`
    };
  }
};
