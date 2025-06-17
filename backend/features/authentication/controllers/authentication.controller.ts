import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import {
  findByUsername,
  insertUser,
  updateLastLogin,
} from "../repositories/authentication.repository.js";

const SALT_ROUNDS = 10;

/* ─────────── LOGIN ─────────── */
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: "username and password are required" });

    const user = await findByUsername(username);
    if (!user)
      return res.status(401).json({ message: "invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok)
      return res.status(401).json({ message: "invalid credentials" });

    await updateLastLogin(user.id);
    res.json({ message: "logged in successfully", userId: user.id });
  } catch (err) {
    next(err);
  }
};

/* ────────── REGISTER ───────── */
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body;

    if (!username || !password)
      return res
        .status(400)
        .json({ message: "username and password are required" });

    if (password.length < 8)
      return res
        .status(400)
        .json({ message: "password must be at least 8 characters" });

    if (await findByUsername(username))
      return res.status(409).json({ message: "username already taken" });

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const userId = await insertUser(username, hash);
    console.log(userId)
    res.status(201).json({ message: "user created", userId });
  } catch (err) {
    next(err);
  }
};