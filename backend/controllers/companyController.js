import Company from "../models/Company.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import crypto from "crypto";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const registerCompany = async (req, res) => {
  try {
    const { companyName, companyEmail, password } = req.body;
    const existing = await Company.findOne({ companyEmail });
    if (existing) return res.status(400).json({ message: "Email already registered." });
    const passwordHash = await bcrypt.hash(password, 10);
    const company = await Company.create({ companyName, companyEmail, passwordHash });
    // Generate verification token
    const token = crypto.randomBytes(32).toString("hex");
    company.verificationToken = token;
    company.verificationTokenExpiry = Date.now() + 1000 * 60 * 60; // 1 hour
    await company.save();
    // Send verification email
    const link = `http://localhost:3000/verify-company/${token}`;
    await transporter.sendMail({
      to: companyEmail,
      subject: "Verify your company account",
      html: `<p>Click <a href="${link}">here</a> to verify your company account.</p>`
    });
    res.status(201).json({ message: "Registration successful. Please check your email to verify your account." });
  } catch (err) {
    res.status(500).json({ message: "Registration failed." });
  }
};

export const verifyCompany = async (req, res) => {
  try {
    const { token } = req.params;
    const company = await Company.findOne({ verificationToken: token, verificationTokenExpiry: { $gt: Date.now() } });
    if (!company) return res.status(400).json({ message: "Invalid or expired token." });
    company.isVerified = true;
    company.verificationToken = undefined;
    company.verificationTokenExpiry = undefined;
    await company.save();
    res.json({ message: "Email verified. You can now log in." });
  } catch (err) {
    res.status(500).json({ message: "Verification failed." });
  }
};

export const loginCompany = async (req, res) => {
  try {
    const { companyEmail, password } = req.body;
    const company = await Company.findOne({ companyEmail });
    if (!company) return res.status(400).json({ message: "Invalid credentials." });
    if (!company.isVerified) return res.status(403).json({ message: "Please verify your email before logging in." });
    const valid = await bcrypt.compare(password, company.passwordHash);
    if (!valid) return res.status(400).json({ message: "Invalid credentials." });
    const token = jwt.sign({ companyId: company._id, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "1d" });
    res.cookie("token", token, { httpOnly: true, sameSite: "lax" });
    res.json({ companyId: company._id });
  } catch (err) {
    res.status(500).json({ message: "Login failed." });
  }
};
