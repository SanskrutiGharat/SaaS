import React, { useState } from "react";
import axios from "axios";

const Login = () => {
	const [form, setForm] = useState({ email: "", password: "", isCompany: true });
	const [msg, setMsg] = useState("");
	const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });
	const handleSubmit = async e => {
		e.preventDefault();
		try {
			const url = form.isCompany ? "login-company" : "login-member";
			const res = await axios.post(`http://localhost:5000/api/auth/${url}`, {
				companyEmail: form.email,
				email: form.email,
				password: form.password
			}, { withCredentials: true });
			setMsg("Login successful");
			// TODO: Redirect to dashboard
		} catch (err) {
			setMsg(err.response?.data?.message || "Login failed");
		}
	};
	return (
		<form onSubmit={handleSubmit}>
			<h2>Login</h2>
			<input name="email" placeholder="Email" value={form.email} onChange={handleChange} required type="email" />
			<input name="password" placeholder="Password" value={form.password} onChange={handleChange} required type="password" />
			<label>
				<input type="checkbox" checked={form.isCompany} onChange={e => setForm(f => ({ ...f, isCompany: e.target.checked }))} />
				Company Login
			</label>
			<button type="submit">Login</button>
			<div>{msg}</div>
			<a href="/forgot-password">Forgot Password?</a>
		</form>
	);
};
export default Login;
