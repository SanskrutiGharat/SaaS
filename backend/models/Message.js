import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema({
  channelId: { type: mongoose.Schema.Types.ObjectId, ref: "Channel" },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  text: { type: String },
  fileUrl: { type: String },
  threadParent: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Message", MessageSchema);
