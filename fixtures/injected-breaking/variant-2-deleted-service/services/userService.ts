// Injected Breaking Variant 2: Deleted userService.findUserById
import { db } from '../db/database';

export const userService = {
  // findUserById has been removed/broken!
  async listAllUsers() {
    const users = await db.users.find({ status: 'active' });
    return users;
  }
};
