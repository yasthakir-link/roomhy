import React, { useEffect, useState } from "react";

const getApiUrl = () =>
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5001"
    : "https://api.roomhy.com";

export default function OwnerKycForm() {
  const apiUrl = getApiUrl();
  const [token, setToken] = useState("");
  const [visitInfo, setVisitInfo] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | form | success | error | expired | done
  const [errorMsg, setErrorMsg] = useState("");
  const [form, setForm] = useState({ aadhaarNumber: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token") || "";
    setToken(t);
    if (!t) {
      setStatus("error");
      setErrorMsg("No KYC token found in the link. Please use the link sent to your email.");
      return;
    }
    validateToken(t);
  }, []);

  const validateToken = async (t) => {
    try {
      const res = await fetch(`${apiUrl}/api/visits/kyc/${encodeURIComponent(t)}`);
      const data = await res.json();
      if (res.status === 410) {
        setStatus("done");
        return;
      }
      if (!res.ok || !data.success) {
        setStatus("expired");
        setErrorMsg(data.message || "This KYC link is invalid or has expired.");
        return;
      }
      setVisitInfo(data);
      setStatus("form");
    } catch (_) {
      setStatus("error");
      setErrorMsg("Unable to reach the server. Please try again later.");
    }
  };

  const validate = () => {
    const errors = {};
    if (!form.aadhaarNumber.trim() || !/^\d{12}$/.test(form.aadhaarNumber.trim())) {
      errors.aadhaarNumber = "Enter a valid 12-digit Aadhaar number";
    }
    if (!form.phone.trim() || !/^\d{10}$/.test(form.phone.trim())) {
      errors.phone = "Enter a valid 10-digit mobile number";
    }
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const res = await fetch(`${apiUrl}/api/visits/kyc/${encodeURIComponent(token)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aadhaarNumber: form.aadhaarNumber.trim(),
          phone: form.phone.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatus("success");
      } else {
        setErrorMsg(data.message || "Submission failed. Please try again.");
        setStatus("error");
      }
    } catch (_) {
      setErrorMsg("Unable to reach the server. Please try again later.");
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  const onChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setFieldErrors((prev) => ({ ...prev, [field]: "" }));
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f0f2f5", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: "480px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ display: "inline-block", background: "linear-gradient(135deg,#667eea,#764ba2)", padding: "14px 28px", borderRadius: "12px", marginBottom: "12px" }}>
            <span style={{ color: "#fff", fontSize: "22px", fontWeight: "700" }}>RoomHy</span>
          </div>
          <div style={{ color: "#555", fontSize: "14px" }}>Owner KYC Verification</div>
        </div>

        <div style={{ background: "#fff", borderRadius: "16px", boxShadow: "0 4px 24px rgba(0,0,0,0.1)", overflow: "hidden" }}>

          {/* Loading */}
          {status === "loading" && (
            <div style={{ padding: "48px", textAlign: "center", color: "#888" }}>
              <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
              <p>Verifying your KYC link...</p>
            </div>
          )}

          {/* KYC already done */}
          {status === "done" && (
            <div style={{ padding: "48px", textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>✅</div>
              <h2 style={{ color: "#16a34a", marginBottom: "8px" }}>KYC Already Submitted</h2>
              <p style={{ color: "#555" }}>Your KYC has already been completed. The admin will review and approve your property soon.</p>
            </div>
          )}

          {/* Expired / invalid link */}
          {status === "expired" && (
            <div style={{ padding: "48px", textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔗</div>
              <h2 style={{ color: "#dc2626", marginBottom: "8px" }}>Link Expired or Invalid</h2>
              <p style={{ color: "#555" }}>{errorMsg}</p>
              <p style={{ color: "#888", fontSize: "13px", marginTop: "16px" }}>Please contact RoomHy support to request a new KYC link.</p>
            </div>
          )}

          {/* Generic error */}
          {status === "error" && (
            <div style={{ padding: "48px", textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
              <h2 style={{ color: "#dc2626", marginBottom: "8px" }}>Something Went Wrong</h2>
              <p style={{ color: "#555" }}>{errorMsg}</p>
            </div>
          )}

          {/* Success */}
          {status === "success" && (
            <div style={{ padding: "48px", textAlign: "center" }}>
              <div style={{ fontSize: "56px", marginBottom: "16px" }}>🎉</div>
              <h2 style={{ color: "#16a34a", fontSize: "22px", marginBottom: "8px" }}>KYC Submitted!</h2>
              <p style={{ color: "#555", marginBottom: "8px" }}>Thank you! Your KYC details have been received.</p>
              <p style={{ color: "#777", fontSize: "13px" }}>The RoomHy admin will review and approve your property shortly. You'll be notified by email.</p>
            </div>
          )}

          {/* KYC Form */}
          {status === "form" && visitInfo && (
            <>
              <div style={{ background: "linear-gradient(135deg,#667eea,#764ba2)", padding: "24px 28px" }}>
                <h2 style={{ margin: 0, color: "#fff", fontSize: "20px", fontWeight: "700" }}>Complete KYC Verification</h2>
                <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.85)", fontSize: "13px" }}>
                  Property: <strong>{visitInfo.propertyName || "—"}</strong>
                </p>
              </div>

              <form onSubmit={handleSubmit} style={{ padding: "28px" }}>
                <p style={{ color: "#555", fontSize: "14px", marginTop: 0, marginBottom: "24px" }}>
                  Hi <strong>{visitInfo.ownerName || "Owner"}</strong>, please provide the following details to complete your KYC.
                </p>

                {/* Aadhaar */}
                <div style={{ marginBottom: "18px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#444", marginBottom: "6px" }}>
                    Aadhaar Number <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={12}
                    placeholder="Enter 12-digit Aadhaar number"
                    value={form.aadhaarNumber}
                    onChange={onChange("aadhaarNumber")}
                    style={{ width: "100%", padding: "10px 14px", border: `1px solid ${fieldErrors.aadhaarNumber ? "#dc2626" : "#d1d5db"}`, borderRadius: "8px", fontSize: "15px", boxSizing: "border-box", outline: "none" }}
                  />
                  {fieldErrors.aadhaarNumber && <p style={{ color: "#dc2626", fontSize: "12px", margin: "4px 0 0" }}>{fieldErrors.aadhaarNumber}</p>}
                </div>

                {/* Phone */}
                <div style={{ marginBottom: "24px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#444", marginBottom: "6px" }}>
                    Mobile Number <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="Enter 10-digit mobile number"
                    value={form.phone}
                    onChange={onChange("phone")}
                    style={{ width: "100%", padding: "10px 14px", border: `1px solid ${fieldErrors.phone ? "#dc2626" : "#d1d5db"}`, borderRadius: "8px", fontSize: "15px", boxSizing: "border-box", outline: "none" }}
                  />
                  {fieldErrors.phone && <p style={{ color: "#dc2626", fontSize: "12px", margin: "4px 0 0" }}>{fieldErrors.phone}</p>}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  style={{ width: "100%", padding: "13px", background: submitting ? "#a5b4fc" : "linear-gradient(135deg,#667eea,#764ba2)", color: "#fff", border: "none", borderRadius: "10px", fontSize: "16px", fontWeight: "700", cursor: submitting ? "not-allowed" : "pointer" }}
                >
                  {submitting ? "Submitting..." : "Submit KYC"}
                </button>

                <p style={{ fontSize: "11px", color: "#9ca3af", textAlign: "center", marginTop: "16px" }}>
                  Your information is encrypted and secure. RoomHy will never share your KYC details.
                </p>
              </form>
            </>
          )}
        </div>

        <p style={{ textAlign: "center", color: "#aaa", fontSize: "12px", marginTop: "20px" }}>
          © 2026 RoomHy. All rights reserved.
        </p>
      </div>
    </div>
  );
}
