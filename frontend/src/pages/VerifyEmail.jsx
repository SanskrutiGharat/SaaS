import React, { useEffect, useState } from "react";
import axios from "axios";

const VerifyEmail = ({ type }) => {
  const [msg, setMsg] = useState("");
  useEffect(() => {
    const token = window.location.pathname.split("/").pop();
    const url = type === "company" ? "verify-company" : "verify-member";
    axios.get(`http://localhost:5000/api/auth/${url}/${token}`)
      .then(res => setMsg(res.data.message))
      .catch(err => setMsg(err.response?.data?.message || "Verification failed"));
  }, [type]);
  return <div><h2>Email Verification</h2><div>{msg}</div></div>;
};
export default VerifyEmail;
