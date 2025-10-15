import mongoose from "mongoose";

const TeamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "Member" }],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Team", TeamSchema);
