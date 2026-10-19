import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import { env } from '../config/env';
import { User } from '../models';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { signToken } from '../utils/jwt';

function toPublicUser(user: User) {
  return { id: user.id, name: user.name, email: user.email };
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password } = req.body as {
    name?: string;
    email?: string;
    password?: string;
  };

  if (!name || !email || !password) {
    throw new ApiError(400, 'name, email and password are required');
  }

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw new ApiError(409, 'A user with that email already exists');
  }

  const passwordHash = await bcrypt.hash(password, env.bcryptSaltRounds);
  const user = await User.create({ name, email, passwordHash });

  const token = signToken({ sub: user.id, email: user.email });
  res.status(201).json({ token, user: toPublicUser(user) });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    throw new ApiError(400, 'email and password are required');
  }

  const user = await User.findOne({ where: { email } });
  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const token = signToken({ sub: user.id, email: user.email });
  res.json({ token, user: toPublicUser(user) });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findByPk(req.user?.id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  res.json({ user: toPublicUser(user) });
});
