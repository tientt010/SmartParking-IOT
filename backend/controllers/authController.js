import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const signToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    }
  );
};

export const signup = async (req, res) => {
  const { username, password, role = "user" } = req.body;
  if (!username || !password)
    return res
      .status(400)
      .json({ message: "Username and password are required" });

  const existingUser = await User.findOne({ username });
  if (existingUser)
    return res.status(400).json({ message: "Username already exists" });

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({
    username,
    password: hashed,
    role,
  });

  const safeUser = { id: user._id, username: user.username, role: user.role };

  res.status(201).json({ user: safeUser, token: signToken(user) });
};

export const login = async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const safeUser = { id: user._id, username: user.username, role: user.role };
  res.json({ user: safeUser, token: signToken(user) });
};

export const me = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  const safeUser = { id: user._id, username: user.username, role: user.role };
  res.json(safeUser);
};
