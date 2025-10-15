// Express server setup for SaaS app
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import chatRoutes from "./routes/chat.js";

const app = express();
app.use(express.json());
app.use(cors({ origin: "http://localhost:3000", credentials: true }));

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/uploads", express.static("uploads"));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/saas", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "http://localhost:3000" } });

const onlineUsers = new Map();

io.on("connection", (socket) => {
  // User presence
  socket.on("user_online", (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit("presence_update", Array.from(onlineUsers.keys()));
  });
  socket.on("disconnect", () => {
    for (const [userId, id] of onlineUsers.entries()) {
      if (id === socket.id) onlineUsers.delete(userId);
    }
    io.emit("presence_update", Array.from(onlineUsers.keys()));
  });

  // Join channel
  socket.on("join_channel", (channelId) => socket.join(channelId));

  // Send message
  socket.on("send_message", (data) => {
    io.to(data.channelId).emit("receive_message", data);
    // Mention notifications
    if (data.mentions && Array.isArray(data.mentions)) {
      data.mentions.forEach((userId) => {
        const targetSocket = onlineUsers.get(userId);
        if (targetSocket) io.to(targetSocket).emit("mention_notification", data);
      });
    }
  });

  // Threaded replies
  socket.on("send_thread_reply", (data) => {
    io.to(data.channelId).emit("receive_thread_reply", data);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
