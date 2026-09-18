// Standard Fixture - API Client Indirection
export interface User {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  profile: {
    displayName: string;
    avatarUrl?: string;
  };
}

export interface Order {
  id: string;
  orderId: string;
  customerId: string;
  totalAmount: number;
  currency: string;
  status: string;
}

export const api = {
  async getUser(id: string): Promise<User> {
    const res = await fetch(`/api/users/${id}`);
    if (!res.ok) throw new Error(`Failed to fetch user ${id}`);
    return res.json();
  },

  async listUsers(): Promise<User[]> {
    const res = await fetch('/api/users');
    if (!res.ok) throw new Error('Failed to fetch user list');
    return res.json();
  },

  async getOrder(id: string): Promise<Order> {
    const res = await fetch(`/api/orders/${id}`);
    if (!res.ok) throw new Error(`Failed to fetch order ${id}`);
    return res.json();
  },

  async checkoutOrder(payload: { orderId: string; userId: string; amount: number }): Promise<{ success: boolean; txId: string }> {
    const res = await fetch('/api/orders/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Checkout failed');
    return res.json();
  }
};
