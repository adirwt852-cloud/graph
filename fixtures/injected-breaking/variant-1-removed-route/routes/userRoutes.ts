// Injected Breaking Variant 1: Removed GET /api/users/:id route
import { Router, Request, Response } from 'express';
import { userService } from '../services/userService';

export const userRouter = Router();

export async function listUsersHandler(req: Request, res: Response) {
  const users = await userService.listAllUsers();
  return res.json(users);
}

// NOTE: /users/:id has been deliberately removed!
userRouter.get('/users', listUsersHandler);
