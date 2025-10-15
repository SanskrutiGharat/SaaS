import jwt from "jsonwebtoken";

export const requireAuth = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Not authenticated." });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token." });
  }
};

export const requireCompany = (req, res, next) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Admin access required." });
  if (req.user.companyId !== req.params.companyId) return res.status(403).json({ message: "Unauthorized company access." });
  next();
};

export const requireTeamMember = (req, res, next) => {
  if (req.user.role !== "member") return res.status(403).json({ message: "Team member access required." });
  if (req.user.companyId !== req.params.companyId) return res.status(403).json({ message: "Unauthorized company access." });
  if (req.user.teamId !== req.params.teamId) return res.status(403).json({ message: "Unauthorized team access." });
  next();
};
