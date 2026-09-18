// Database access abstraction supporting runtime logging
export interface DatabaseDriver {
  query<T = any>(sql: string, params?: any[]): Promise<T>;
  users: {
    findOne(query: { id: string }): Promise<any>;
    find(query: Record<string, any>): Promise<any[]>;
  };
  orders: {
    findOne(query: { id: string }): Promise<any>;
    insertOne(doc: any): Promise<any>;
  };
}

const mockUsers = [
  { id: 'usr_101', userId: 'usr_101', name: 'Alice Chen', email: 'alice@example.com', role: 'Staff Engineer', profile: { displayName: 'Alice C.' } },
  { id: 'usr_102', userId: 'usr_102', name: 'Bob Smith', email: 'bob@example.com', role: 'DevOps Lead', profile: { displayName: 'Bob S.' } },
];

const mockOrders = [
  { id: 'ord_501', orderId: 'ord_501', customerId: 'usr_101', totalAmount: 49.99, currency: 'USD', status: 'completed' },
];

// DB tracer callback for runtime verification
let dbTracerCallback: ((callName: string, meta: any) => void) | null = null;

export function registerDbTracer(tracer: (callName: string, meta: any) => void) {
  dbTracerCallback = tracer;
}

export const db: DatabaseDriver = {
  async query<T = any>(sql: string, params: any[] = []): Promise<T> {
    if (dbTracerCallback) dbTracerCallback('db.query', { sql, params });
    return [{ id: 'usr_101', name: 'Alice Chen' }] as any as T;
  },
  users: {
    async findOne(query: { id: string }) {
      if (dbTracerCallback) dbTracerCallback('db.users.findOne', { query });
      return mockUsers.find((u) => u.id === query.id || u.userId === query.id) || null;
    },
    async find(query: Record<string, any>) {
      if (dbTracerCallback) dbTracerCallback('db.users.find', { query });
      return mockUsers;
    }
  },
  orders: {
    async findOne(query: { id: string }) {
      if (dbTracerCallback) dbTracerCallback('db.orders.findOne', { query });
      return mockOrders.find((o) => o.id === query.id || o.orderId === query.id) || null;
    },
    async insertOne(doc: any) {
      if (dbTracerCallback) dbTracerCallback('db.orders.insertOne', { doc });
      mockOrders.push(doc);
      return { insertedId: doc.id || 'ord_new', acknowledged: true };
    }
  }
};
