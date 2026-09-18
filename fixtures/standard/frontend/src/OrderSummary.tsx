import React, { useEffect, useState } from 'react';
import { api, Order } from './api-client';
import { PaymentButton } from './PaymentButton';

interface Props {
  orderId: string;
}

export const OrderSummary: React.FC<Props> = ({ orderId }) => {
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    // API client call
    api.getOrder(orderId).then((data) => {
      // Destructures totalAmount, currency, customerId
      const { totalAmount, currency, customerId } = data;
      setOrder(data);
    });
  }, [orderId]);

  if (!order) return <div className="text-sm text-gray-400">Loading order info...</div>;

  return (
    <div className="border border-indigo-100 bg-indigo-50/40 rounded p-4">
      <h4 className="font-medium text-indigo-950">Recent Order: #{order.orderId}</h4>
      <p className="text-sm text-indigo-900 mt-1">Customer: {order.customerId}</p>
      <p className="text-lg font-bold text-indigo-700 mt-2">${order.totalAmount} {order.currency}</p>
      <div className="mt-3">
        <PaymentButton orderId={order.id} userId={order.customerId} amount={order.totalAmount} />
      </div>
    </div>
  );
};
