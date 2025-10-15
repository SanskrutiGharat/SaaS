import React, { useState } from "react";
import axios from "axios";

const ResetPassword = () => {
	const [password, setPassword] = useState("");
	const [msg, setMsg] = useState("");
	// Get token from URL (assume /reset-password/:token)
	const token = window.location.pathname.split("/").pop();
	const handleSubmit = async e => {
		e.preventDefault();
		try {
			const res = await axios.post(`http://localhost:5000/api/auth/reset-password/${token}`, { password });
			setMsg(res.data.message);
		} catch (err) {
			setMsg(err.response?.data?.message || "Failed to reset password");
		}
	};
	return (
		<form onSubmit={handleSubmit}>
			<h2>Reset Password</h2>
			<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="New password" required />
			<button type="submit">Reset Password</button>
			<div>{msg}</div>
		</form>
	);
};
export default ResetPassword;
