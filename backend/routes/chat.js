import express from "express";
import multer from "multer";
import {
	createChannel,
	getChannels,
	postMessage,
	getMessages,
	searchMessages
} from "../controllers/chatController.js";

const router = express.Router();
const upload = multer({ dest: "uploads/", limits: { fileSize: 5 * 1024 * 1024 } });

// Channel routes
router.post("/channel", createChannel);
router.get("/channels", getChannels);

// Message routes
router.post("/message", postMessage);
router.get("/messages/:channelId", getMessages);
router.get("/search", searchMessages);

// File upload (for chat attachments)
router.post("/upload", upload.single("file"), (req, res) => {
	res.json({ fileUrl: `/uploads/${req.file.filename}` });
});

export default router;
