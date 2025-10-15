import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  online: { type: Boolean, default: false },
  resetToken: { type: String },
  resetTokenExpiry: { type: Date }
});

export default mongoose.model("User", UserSchema);
