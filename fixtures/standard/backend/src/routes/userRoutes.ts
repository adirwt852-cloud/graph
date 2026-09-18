import { Router, Request, Response } from 'express';
import { userService } from '../services/userService';

export const userRouter = Router();

export async function getUserByIdHandler(req: Request, res: Response) {
  const { id } = req.params;
  const user = await userService.findUserById(id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json(user);
}

export async function listUsersHandler(req: Request, res: Response) {
  const users = await userService.listAllUsers();
  return res.json(users);
}

userRouter.get('/users/:id', getUserByIdHandler);
userRouter.get('/users', listUsersHandler);
