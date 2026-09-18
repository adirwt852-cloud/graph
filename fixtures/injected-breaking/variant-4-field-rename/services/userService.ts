// Injected Breaking Variant 4: Field renamed userId -> accountIdentifier
import { db } from '../db/database';

export const userService = {
  async findUserById(id: string) {
    const user = await db.users.findOne({ id });
    if (!user) return null;
    return {
      id: user.id,
      // Field renamed: breaking downstream consumers expecting userId
      accountIdentifier: user.userId || user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      profile: {
        displayName: user.profile?.displayName || user.name
      }
    };
  }
};
