import { db } from '../db/database';

export interface UserResponse {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  profile: {
    displayName: string;
  };
}

export const userService = {
  async findUserById(id: string): Promise<UserResponse | null> {
    const user = await db.users.findOne({ id });
    if (!user) return null;
    return {
      id: user.id,
      userId: user.userId,
      name: user.name,
      email: user.email,
      role: user.role,
      profile: {
        displayName: user.profile?.displayName || user.name
      }
    };
  },

  async listAllUsers(): Promise<UserResponse[]> {
    const users = await db.users.find({ status: 'active' });
    return users.map((user) => ({
      id: user.id,
      userId: user.userId,
      name: user.name,
      email: user.email,
      role: user.role,
      profile: {
        displayName: user.profile?.displayName || user.name
      }
    }));
  }
};
