import React, { useEffect, useState } from "react";
import axios from "axios";

const ChannelList = ({ onSelect, selected }) => {
	const [channels, setChannels] = useState([]);

	useEffect(() => {
		axios.get("http://localhost:5000/api/chat/channels", { withCredentials: true })
			.then(res => setChannels(res.data))
			.catch(() => setChannels([]));
	}, []);

	return (
		<div style={{ width: 240, borderRight: "1px solid #eee", padding: 8 }}>
			<h3>Channels</h3>
			<ul style={{ listStyle: "none", padding: 0 }}>
				{channels.map((ch) => (
					<li
						key={ch._id}
						style={{
							background: selected === ch._id ? "#e0e7ff" : undefined,
							padding: 8,
							cursor: "pointer",
							borderRadius: 4,
							marginBottom: 4,
						}}
						onClick={() => onSelect(ch._id)}
					>
						#{ch.name} {/* TODO: Add unread badge */}
					</li>
				))}
			</ul>
		</div>
	);
};

export default ChannelList;
