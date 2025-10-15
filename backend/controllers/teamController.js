import Team from "../models/Team.js";
import Member from "../models/Member.js";
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

// Admin creates a team
export const createTeam = async (req, res) => {
  try {
    const { name, companyId } = req.body;
    const team = await Team.create({ name, company: companyId });
    res.status(201).json(team);
  } catch (err) {
    res.status(500).json({ message: "Team creation failed." });
  }
};

// Admin invites a member
export const inviteMember = async (req, res) => {
  try {
    const { name, email, password, companyId, teamId, role } = req.body;
    const existing = await Member.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email already registered as member." });
    const passwordHash = await bcrypt.hash(password, 10);
    const member = await Member.create({ name, email, passwordHash, company: companyId, team: teamId, role });
    // Generate verification token
    const token = crypto.randomBytes(32).toString("hex");
    member.verificationToken = token;
    member.verificationTokenExpiry = Date.now() + 1000 * 60 * 60; // 1 hour
    await member.save();
    // Send verification email
    const link = `http://localhost:3000/verify-member/${token}`;
    await transporter.sendMail({
      to: email,
      subject: "Verify your team member account",
      html: `<p>Click <a href="${link}">here</a> to verify your team member account.</p>`
    });
    res.status(201).json({ message: "Member invited. Verification email sent." });
  } catch (err) {
    res.status(500).json({ message: "Member invite failed." });
  }
};

// Member verifies email
export const verifyMember = async (req, res) => {
  try {
    const { token } = req.params;
    const member = await Member.findOne({ verificationToken: token, verificationTokenExpiry: { $gt: Date.now() } });
    if (!member) return res.status(400).json({ message: "Invalid or expired token." });
    member.isVerified = true;
    member.verificationToken = undefined;
    member.verificationTokenExpiry = undefined;
    await member.save();
    res.json({ message: "Email verified. You can now log in as a team member." });
  } catch (err) {
    res.status(500).json({ message: "Verification failed." });
  }
};

// Member login
export const loginMember = async (req, res) => {
  try {
    const { email, password } = req.body;
    const member = await Member.findOne({ email });
    if (!member) return res.status(400).json({ message: "Invalid credentials." });
    if (!member.isVerified) return res.status(403).json({ message: "Please verify your email before logging in." });
    const valid = await bcrypt.compare(password, member.passwordHash);
    if (!valid) return res.status(400).json({ message: "Invalid credentials." });
    const token = jwt.sign({ companyId: member.company, teamId: member.team, memberId: member._id, role: member.role }, process.env.JWT_SECRET, { expiresIn: "1d" });
    res.cookie("token", token, { httpOnly: true, sameSite: "lax" });
    res.json({ companyId: member.company, teamId: member.team, memberId: member._id, role: member.role });
  } catch (err) {
    res.status(500).json({ message: "Login failed." });
  }
};
