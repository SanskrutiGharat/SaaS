import Company from "../models/Company.js";
import Member from "../models/Member.js";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import crypto from "crypto";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    let user = await Company.findOne({ companyEmail: email });
    let type = "company";
    if (!user) {
      user = await Member.findOne({ email });
      type = "member";
    }
    if (!user) return res.status(404).json({ message: "No account found with that email." });
    const token = crypto.randomBytes(32).toString("hex");
    user.resetToken = token;
    user.resetTokenExpiry = Date.now() + 1000 * 60 * 15; // 15 min
    await user.save();
    const link = `http://localhost:3000/reset-password/${token}`;
    await transporter.sendMail({
      to: email,
      subject: "Password Reset",
      html: `<p>Click <a href='${link}'>here</a> to reset your password. Link expires in 15 minutes.</p>`
    });
    res.json({ message: "Reset link sent to your email." });
  } catch {
    res.status(500).json({ message: "Failed to send reset link." });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    let user = await Company.findOne({ resetToken: token, resetTokenExpiry: { $gt: Date.now() } });
    if (!user) user = await Member.findOne({ resetToken: token, resetTokenExpiry: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ message: "Invalid or expired token." });
    user.passwordHash = await bcrypt.hash(password, 10);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();
    res.json({ message: "Password reset successful. You can now log in." });
  } catch {
    res.status(500).json({ message: "Password reset failed." });
  }
};
