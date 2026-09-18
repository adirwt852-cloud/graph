// Injected Breaking Variant 3: Broken db.orders connection
export const db = {
  users: {
    async findOne() { return { id: 'usr_101', name: 'Alice' }; },
    async find() { return []; }
  },
  orders: {
    async findOne() {
      throw new Error('FATAL: Database connection timeout on collection orders');
    },
    async insertOne() {
      throw new Error('FATAL: Database connection timeout on collection orders');
    }
  }
};
