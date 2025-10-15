import React, { useEffect, useState } from "react";
import axios from "axios";

const ChatWindow = ({ channelId, onThread }) => {
	const [messages, setMessages] = useState([]);

	useEffect(() => {
		if (!channelId) return;
		axios.get(`http://localhost:5000/api/chat/messages/${channelId}`, { withCredentials: true })
			.then(res => setMessages(res.data))
			.catch(() => setMessages([]));
	}, [channelId]);

	return (
		<div style={{ flex: 1, overflowY: "auto", padding: 16, background: "#f9fafb" }}>
			{!channelId ? (
				<div>Select a channel to start chatting.</div>
			) : (
				messages.map(msg => (
					<div key={msg._id} style={{ marginBottom: 12 }}>
						<b>{msg.sender?.name || "User"}</b>: {msg.text}
						{msg.fileUrl && (
							<a href={`http://localhost:5000${msg.fileUrl}`} target="_blank" rel="noopener noreferrer">[file]</a>
						)}
						<button style={{ marginLeft: 8 }} onClick={() => onThread(msg._id)}>Reply</button>
					</div>
				))
			)}
		</div>
	);
};

export default ChatWindow;
