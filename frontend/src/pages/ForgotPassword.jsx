import React, { useState } from "react";
import axios from "axios";

const ForgotPassword = () => {
	const [email, setEmail] = useState("");
	const [msg, setMsg] = useState("");
	const handleSubmit = async e => {
		e.preventDefault();
		try {
			const res = await axios.post("http://localhost:5000/api/auth/forgot-password", { email });
			setMsg(res.data.message);
		} catch (err) {
			setMsg(err.response?.data?.message || "Failed to send reset link");
		}
	};
	return (
		<form onSubmit={handleSubmit}>
			<h2>Forgot Password</h2>
			<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email" required />
			<button type="submit">Send Reset Link</button>
			<div>{msg}</div>
		</form>
	);
};
export default ForgotPassword;
