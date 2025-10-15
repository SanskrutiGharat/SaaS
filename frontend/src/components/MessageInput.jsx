import React, { useState } from "react";
import axios from "axios";

const MessageInput = ({ channelId, onThread }) => {
	const [text, setText] = useState("");
	const [file, setFile] = useState(null);

	const handleSend = async (e) => {
		e.preventDefault();
		if (!channelId || (!text && !file)) return;
		let fileUrl = null;
		if (file) {
			const formData = new FormData();
			formData.append("file", file);
			const res = await axios.post("http://localhost:5000/api/chat/upload", formData, { withCredentials: true });
			fileUrl = res.data.fileUrl;
		}
		await axios.post("http://localhost:5000/api/chat/message", {
			channelId,
			text,
			fileUrl,
			// mentions: [], // TODO: Add mentions support
		}, { withCredentials: true });
		setText("");
		setFile(null);
	};

	return (
		<form style={{ display: "flex", padding: 8, borderTop: "1px solid #eee" }} onSubmit={handleSend}>
			<input
				type="text"
				value={text}
				onChange={e => setText(e.target.value)}
				placeholder="Type a message..."
				style={{ flex: 1, marginRight: 8 }}
			/>
			<input type="file" onChange={e => setFile(e.target.files[0])} />
			<button type="submit">Send</button>
		</form>
	);
};

export default MessageInput;
