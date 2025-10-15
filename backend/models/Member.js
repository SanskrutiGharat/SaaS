import mongoose from "mongoose";


const MemberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
  team: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
  role: { type: String, enum: ["admin", "member"], default: "member" },
  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String },
  verificationTokenExpiry: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Member", MemberSchema);
