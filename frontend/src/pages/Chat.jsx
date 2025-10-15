import React, { useState, useEffect, useRef } from "react";
import ChannelList from "../components/ChannelList";
import ChatWindow from "../components/ChatWindow";
import MessageInput from "../components/MessageInput";
import ThreadView from "../components/ThreadView";
// import io from "socket.io-client";

const Chat = () => {
	const [selectedChannel, setSelectedChannel] = useState(null);
	const [threadParent, setThreadParent] = useState(null);
	// const socket = useRef(null);

	// useEffect(() => {
	//   socket.current = io("http://localhost:5000");
	//   return () => socket.current.disconnect();
	// }, []);

	return (
		<div style={{ display: "flex", height: "100vh" }}>
			<ChannelList onSelect={setSelectedChannel} selected={selectedChannel} />
			<div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
				<ChatWindow channelId={selectedChannel} onThread={setThreadParent} />
				<MessageInput channelId={selectedChannel} onThread={setThreadParent} />
			</div>
			{threadParent && (
				<ThreadView parentId={threadParent} onClose={() => setThreadParent(null)} />
			)}
		</div>
	);
};

export default Chat;
