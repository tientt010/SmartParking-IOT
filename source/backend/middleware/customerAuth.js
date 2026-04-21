import jwt from "jsonwebtoken";

export const authenticateCustomer = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer "))
    return res.status(401).json({ message: "No token provided" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    if (decoded.role !== "customer")
      return res.status(403).json({ message: "Forbidden" });
    req.customer = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};
