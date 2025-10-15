import React, { useState } from "react";
import axios from "axios";

const RegisterCompany = () => {
  const [form, setForm] = useState({ companyName: "", companyEmail: "", password: "" });
  const [msg, setMsg] = useState("");
  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });
  const handleSubmit = async e => {
    e.preventDefault();
    try {
      const res = await axios.post("http://localhost:5000/api/auth/register-company", form);
      setMsg(res.data.message);
    } catch (err) {
      setMsg(err.response?.data?.message || "Registration failed");
    }
  };
  return (
    <form onSubmit={handleSubmit}>
      <h2>Register Company</h2>
      <input name="companyName" placeholder="Company Name" value={form.companyName} onChange={handleChange} required />
      <input name="companyEmail" placeholder="Company Email" value={form.companyEmail} onChange={handleChange} required type="email" />
      <input name="password" placeholder="Password" value={form.password} onChange={handleChange} required type="password" />
      <button type="submit">Register</button>
      <div>{msg}</div>
    </form>
  );
};
export default RegisterCompany;
