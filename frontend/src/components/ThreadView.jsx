import React from "react";
const ThreadView = ({ parentId, onClose }) => (
	<div style={{ width: 320, borderLeft: "1px solid #eee", background: "#fff", padding: 16 }}>
		<button onClick={onClose} style={{ float: "right" }}>Close</button>
		<h4>Thread for message {parentId}</h4>
		{/* TODO: Fetch and display thread messages, allow replies */}
	</div>
);

export default ThreadView;
