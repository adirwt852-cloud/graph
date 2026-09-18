import React, { useState } from 'react';
import { api } from './api-client';

interface Props {
  orderId: string;
  userId: string;
  amount: number;
}

export const PaymentButton: React.FC<Props> = ({ orderId, userId, amount }) => {
  const [processing, setProcessing] = useState(false);
  const [paid, setPaid] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const handlePay = async () => {
    setProcessing(true);
    setErrorBanner(null);
    try {
      // POST /api/orders/checkout with resilient error capture
      const result = await api.checkoutOrder({ orderId, userId, amount });
      if (result.success) {
        setPaid(true);
      }
    } catch (err: any) {
      // Try/catch handler gracefully degrades experience
      setErrorBanner('Payment processing currently degraded. Please retry.');
    } finally {
      setProcessing(false);
    }
  };

  if (paid) return <span className="text-emerald-700 font-semibold text-sm">Paid ✓</span>;

  return (
    <div>
      <button
        onClick={handlePay}
        disabled={processing}
        className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
      >
        {processing ? 'Processing...' : 'Pay Now'}
      </button>
      {errorBanner && (
        <p className="text-xs text-amber-700 mt-1.5 bg-amber-50 p-1.5 rounded">{errorBanner}</p>
      )}
    </div>
  );
};
