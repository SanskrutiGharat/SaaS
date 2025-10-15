import { forgotPassword, resetPassword } from "../controllers/passwordController.js";

// Forgot/reset password (company or member)
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
import { requireAuth, requireCompany, requireTeamMember } from "../middleware/auth.js";

// Example: Protect company dashboard route
// router.get("/dashboard/:companyId", requireAuth, requireCompany, (req, res) => {
//   res.json({ message: "Welcome to your company dashboard!" });
// });

// Example: Protect team dashboard route
// router.get("/dashboard/:companyId/team/:teamId", requireAuth, requireTeamMember, (req, res) => {
//   res.json({ message: "Welcome to your team dashboard!" });
// });
import express from "express";
import { registerCompany, verifyCompany, loginCompany } from "../controllers/companyController.js";
const router = express.Router();

// Company registration
router.post("/register-company", registerCompany);
// Company email verification
router.get("/verify-company/:token", verifyCompany);
// Company login
router.post("/login-company", loginCompany);


import { createTeam, inviteMember, verifyMember, loginMember } from "../controllers/teamController.js";

// Team creation (admin)
router.post("/create-team", createTeam);
// Invite member (admin)
router.post("/invite-member", inviteMember);
// Member email verification
router.get("/verify-member/:token", verifyMember);
// Member login
router.post("/login-member", loginMember);

export default router;
