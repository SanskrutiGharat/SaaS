import Channel from "../models/Channel.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

// Create a new channel
export const createChannel = async (req, res) => {
	try {
		const { name, members, isDirect } = req.body;
		const channel = new Channel({ name, members, createdBy: req.user.id, isDirect });
		await channel.save();
		res.status(201).json(channel);
	} catch (err) {
		res.status(500).json({ message: "Error creating channel" });
	}
};

// Get all channels
export const getChannels = async (req, res) => {
	try {
		const channels = await Channel.find({ members: req.user.id });
		res.json(channels);
	} catch (err) {
		res.status(500).json({ message: "Error fetching channels" });
	}
};

// Post a message
export const postMessage = async (req, res) => {
	try {
		const { channelId, text, fileUrl, threadParent, mentions } = req.body;
		const message = new Message({ channelId, sender: req.user.id, text, fileUrl, threadParent, mentions });
		await message.save();
		res.status(201).json(message);
	} catch (err) {
		res.status(500).json({ message: "Error posting message" });
	}
};

// Get messages for a channel
export const getMessages = async (req, res) => {
	try {
		const { channelId } = req.params;
		const messages = await Message.find({ channelId }).populate("sender").sort({ createdAt: 1 });
		res.json(messages);
	} catch (err) {
		res.status(500).json({ message: "Error fetching messages" });
	}
};

// Search messages
export const searchMessages = async (req, res) => {
	try {
		const { channelId, text, sender, date } = req.query;
		let query = { channelId };
		if (text) query.text = { $regex: text, $options: "i" };
		if (sender) query.sender = sender;
		if (date) query.createdAt = { $gte: new Date(date) };
		const messages = await Message.find(query).populate("sender");
		res.json(messages);
	} catch (err) {
		res.status(500).json({ message: "Error searching messages" });
	}
};
