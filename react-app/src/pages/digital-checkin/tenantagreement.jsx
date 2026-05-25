import React from "react";
import { useHtmlPage } from "../../utils/htmlPage";
import { useTenantAgreement } from "./useTenantAgreement";

const fmtDate = (val) => {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d)) return String(val);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};


const Row = ({ label, value }) => (
  <div style={{ display: "flex", gap: "8px", padding: "5px 0", borderBottom: "1px solid #f0f2f5" }}>
    <span style={{ minWidth: "170px", fontSize: "12px", color: "#64748b", fontWeight: 600 }}>{label}</span>
    <span style={{ fontSize: "13px", color: "#1e293b", fontWeight: 500 }}>{value || "—"}</span>
  </div>
);

const SignaturePad = React.forwardRef(({ onChange }, ref) => {
  const canvasRef = React.useRef(null);
  const drawingRef = React.useRef(false);

  React.useImperativeHandle(ref, () => ({
    getDataUrl: () => canvasRef.current?.toDataURL("image/png") || ""
  }));

  const resizeCanvas = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.offsetWidth || 400;
    const height = 110;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#1e293b";
    ctx.fillStyle = "#fafbfc";
    ctx.fillRect(0, 0, width, height);
  }, []);

  React.useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  const getPoint = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches?.[0];
    return {
      x: (touch ? touch.clientX : event.clientX) - rect.left,
      y: (touch ? touch.clientY : event.clientY) - rect.top
    };
  };

  const startDrawing = (e) => {
    const ctx = canvasRef.current?.getContext("2d");
    const p = getPoint(e);
    if (!ctx || !p) return;
    drawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    e.preventDefault?.();
  };

  const draw = (e) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    const p = getPoint(e);
    if (!ctx || !p) return;
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    onChange(canvasRef.current.toDataURL("image/png"));
    e.preventDefault?.();
  };

  const stopDrawing = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    onChange(canvasRef.current?.toDataURL("image/png") || "");
  };

  const clear = () => {
    resizeCanvas();
    onChange("");
  };

  return (
    <div>
      <div
        style={{
          border: "1.5px solid #cbd5e1",
          borderRadius: "10px",
          background: "#fafbfc",
          overflow: "hidden",
          position: "relative"
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "110px", display: "block", touchAction: "none" }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        <button
          type="button"
          onClick={clear}
          style={{
            position: "absolute",
            top: "6px",
            right: "10px",
            background: "rgba(255,255,255,0.85)",
            border: "1px solid #cbd5e1",
            borderRadius: "6px",
            fontSize: "11px",
            color: "#475569",
            padding: "2px 10px",
            cursor: "pointer",
            fontWeight: 600
          }}
        >
          Clear
        </button>
      </div>
      <div
        style={{
          borderTop: "2px solid #94a3b8",
          marginTop: "0",
          paddingTop: "4px",
          fontSize: "11px",
          color: "#94a3b8",
          letterSpacing: "0.04em"
        }}
      >
        SIGN ABOVE THIS LINE
      </div>
    </div>
  );
});
SignaturePad.displayName = "SignaturePad";

export default function DigitalCheckinTenantagreement() {
  useHtmlPage({
    title: "Tenant Rental Agreement & E-sign",
    bodyClass: "",
    htmlAttrs: { lang: "en" },
    metas: [
      { charset: "UTF-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" }
    ],
    links: [{ rel: "stylesheet", href: "/digital-checkin/assets/css/tenantagreement.css" }],
    styles: [],
    scripts: [],
    inlineScripts: []
  });

  const {
    loginId, setLoginId,
    eSignName, setESignName,
    accepted, setAccepted,
    submitting, error, handleSubmit,
    tenantData, loadingData
  } = useTenantAgreement();

  const [signatureDataUrl, setSignatureDataUrl] = React.useState("");

  const profile = tenantData?.tenantProfile || {};
  const details = profile.agreementDetails || {};
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const tenantName  = profile.name || details.tenantName || "—";
  const propertyName = profile.propertyName || details.propertyName || "—";
  const roomNo      = profile.roomNo || details.roomNumber || "—";
  const ownerName   = details.ownerName || "—";
  const agreedRent  = profile.agreedRent ? `₹${profile.agreedRent}/month` : "—";
  const secDep      = details.securityDeposit || (profile.securityDepositTotal ? `₹${profile.securityDepositTotal}` : "—");
  const moveInDate  = fmtDate(profile.moveInDate || details.licenseStartDate);
  const licStart    = fmtDate(details.licenseStartDate || profile.moveInDate);
  const licEnd      = fmtDate(details.licenseEndDate);
  const duration    = details.duration || "—";
  const accomType   = details.accommodationType || "—";
  const electricity = profile.electricityCharge ? `₹${profile.electricityCharge}` : "—";
  const maintenance = profile.maintenanceCharge ? `₹${profile.maintenanceCharge}` : "—";
  const minStay     = details.minimumStayDuration || "3 Months";
  const inclusions  = details.inclusions || "As per property terms";
  const gst         = details.gstCharges ? `${details.gstCharges}%` : "0%";
  const tenantAddr  = details.tenantAddress || "—";
  const tenantEmail = profile.email || details.tenantEmail || "—";

  return (
    <div className="html-page">
      <div className="wrap" style={{ maxWidth: "820px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
          <div>
            <h2 style={{ marginBottom: "4px" }}>RoomHy Rental Agreement</h2>
            <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
              Review the agreement, sign below, and complete your tenant onboarding.
            </p>
          </div>
          <div style={{
            minWidth: "110px", textAlign: "center",
            border: "2px solid #1d4ed8", color: "#1d4ed8",
            borderRadius: "18px", padding: "10px 12px",
            fontWeight: 800, letterSpacing: "0.08em", flexShrink: 0
          }}>
            ROOMHY
            <div style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.02em" }}>OFFICIAL SEAL</div>
          </div>
        </div>

        {/* Login ID */}
        <label>Login ID</label>
        <input value={loginId} onChange={(e) => setLoginId(e.target.value)} required />

        {/* Document card — agreement + annexure + signature all in one */}
        <div className="box" style={{ padding: 0, marginTop: "20px", overflow: "hidden" }}>

          {/* Scrollable clauses */}
          <div style={{ maxHeight: "300px", overflowY: "auto", padding: "20px 24px", lineHeight: 1.75, color: "#374151" }}>
            <h3 style={{ marginTop: 0, fontSize: "15px", letterSpacing: "0.04em", color: "#1e293b" }}>
              LICENCE &amp; SUBSCRIPTION AGREEMENT
            </h3>
            <p style={{ fontSize: "13px" }}>
              This License &amp; Subscription Agreement is executed between RoomHy and the Tenant as named in Annexure A.
              The parties agree that the tenant will occupy the allotted premises for residential purposes subject to the terms below.
            </p>
            <p style={{ fontSize: "13px" }}><strong>1. Term:</strong> As per Annexure A.</p>
            <p style={{ fontSize: "13px" }}><strong>2. Premises:</strong> As per Annexure A.</p>
            <p style={{ fontSize: "13px" }}><strong>3. License Fee / Rent:</strong> As per Annexure A. Rent must be paid in advance on or before the due date.</p>
            <p style={{ fontSize: "13px" }}><strong>4. Refundable Security Deposit:</strong> As per Annexure A. Deposit is refundable after deductions for dues or damages.</p>
            <p style={{ fontSize: "13px" }}><strong>5. Minimum Stay Duration:</strong> As per Annexure A. Early move-out before minimum stay can result in deposit withholding.</p>
            <p style={{ fontSize: "13px" }}><strong>6. Limited License:</strong> Use of the premises is subject to timely payment and compliance with RoomHy rules.</p>
            <p style={{ fontSize: "13px" }}><strong>7. Rent Default:</strong> Delay or default in rent can lead to service restrictions, lockout, penalties, and termination.</p>
            <p style={{ fontSize: "13px" }}><strong>8. Termination Without Cause:</strong> Either party may terminate with prior notice, subject to lock-in and notice conditions.</p>
            <p style={{ fontSize: "13px" }}><strong>9. Termination For Cause:</strong> RoomHy may terminate immediately for illegal activity, non-payment, damage, or violation of rules.</p>
            <p style={{ fontSize: "13px" }}><strong>10. Maintenance:</strong> Tenant must maintain the premises and bears cost for damages beyond normal wear and tear.</p>
            <p style={{ fontSize: "13px" }}><strong>11. Renewal:</strong> Agreement may renew with revised rent and terms based on market conditions.</p>
            <p style={{ fontSize: "13px" }}><strong>12. Notices:</strong> Notices may be sent by email or written communication.</p>
            <p style={{ fontSize: "13px" }}><strong>13. Entire Agreement:</strong> This agreement with annexures forms the complete understanding between parties.</p>
            <p style={{ fontSize: "13px" }}><strong>14. Severability:</strong> If any clause is invalid, the rest of the agreement remains effective.</p>
            <p style={{ fontSize: "13px" }}><strong>15. Governing Law &amp; Jurisdiction:</strong> Laws of India apply and jurisdiction lies where the premises are located.</p>
            <p style={{ fontSize: "13px" }}><strong>16. Assignment Of Receivables:</strong> RoomHy may assign receivables under this agreement.</p>
            <p style={{ fontSize: "13px" }}><strong>17. Stamp Duty:</strong> Applicable stamp duty obligations, if any, are the responsibility of the tenant.</p>
            <p style={{ fontSize: "13px" }}><strong>18. Other Terms &amp; Conditions:</strong> RoomHy may revise operating policies and tenant rules from time to time.</p>
          </div>

          {/* Annexure A — dynamic values */}
          <div style={{ background: "#f8fafc", borderTop: "1.5px solid #e2e8f0", padding: "18px 24px" }}>
            <div style={{ fontWeight: 800, fontSize: "13px", letterSpacing: "0.06em", color: "#1e293b", marginBottom: "12px" }}>
              ANNEXURE A — RENTAL DETAILS
              {loadingData && <span style={{ fontWeight: 400, fontSize: "11px", color: "#94a3b8", marginLeft: "10px" }}>Loading…</span>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
              <Row label="Tenant Name"        value={tenantName} />
              <Row label="Owner Name"         value={ownerName} />
              <Row label="Property"           value={propertyName} />
              <Row label="Room No."           value={roomNo} />
              <Row label="Accommodation Type" value={accomType} />
              <Row label="Duration"           value={duration} />
              <Row label="Move-in Date"       value={moveInDate} />
              <Row label="License Start"      value={licStart} />
              <Row label="License End"        value={licEnd} />
              <Row label="Monthly Rent"       value={agreedRent} />
              <Row label="Security Deposit"   value={secDep} />
              <Row label="Electricity"        value={electricity} />
              <Row label="Maintenance"        value={maintenance} />
              <Row label="GST"                value={gst} />
              <Row label="Minimum Stay"       value={minStay} />
              <Row label="Tenant Email"       value={tenantEmail} />
            </div>
            <Row label="Tenant Address" value={tenantAddr} />
            <Row label="Inclusions"     value={inclusions} />
          </div>

          {/* Signature block — attached to bottom of document */}
          <div style={{ borderTop: "2px dashed #cbd5e1", padding: "20px 24px 24px", background: "#fff" }}>
            <div style={{ fontWeight: 700, fontSize: "13px", letterSpacing: "0.05em", color: "#475569", marginBottom: "14px" }}>
              TENANT SIGNATURE
            </div>

            {/* Meta row: name + date */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "13px" }}>
              <div>
                <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600, marginBottom: "2px" }}>TENANT</div>
                <div style={{ fontWeight: 700, color: "#1e293b" }}>{tenantName}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600, marginBottom: "2px" }}>DATE</div>
                <div style={{ fontWeight: 700, color: "#1e293b" }}>{today}</div>
              </div>
            </div>

            {/* E-sign name */}
            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569", margin: "0 0 6px" }}>
                E-sign Full Name
              </label>
              <input
                value={eSignName}
                onChange={(e) => setESignName(e.target.value)}
                placeholder="Type your full legal name"
                style={{ borderRadius: "8px", minHeight: "38px", fontSize: "14px" }}
                required
              />
            </div>

            {/* Signature canvas */}
            <SignaturePad onChange={setSignatureDataUrl} />

            {/* Preview of drawn signature inside the doc */}
            {signatureDataUrl && (
              <div style={{ marginTop: "10px", padding: "8px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "4px" }}>Signature preview (as it appears in the agreement)</div>
                <img src={signatureDataUrl} alt="tenant signature" style={{ maxHeight: "60px", maxWidth: "100%" }} />
              </div>
            )}
          </div>
        </div>

        {/* Acceptance + submit */}
        <label style={{ marginTop: "18px", display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            style={{ width: "auto", marginTop: "2px" }}
          />
          <span style={{ fontSize: "14px", color: "#374151" }}>
            I accept the rental agreement and provide my e-sign consent.
          </span>
        </label>

        {error ? <div style={{ color: "#dc2626", marginTop: "12px", fontSize: "14px" }}>{error}</div> : null}

        <p style={{ marginTop: "10px", color: "#6b7280", fontSize: "13px" }}>
          After submission, the signed RoomHy rental agreement will be emailed to you.
        </p>

        <button
          onClick={() => handleSubmit(signatureDataUrl)}
          disabled={submitting}
          type="button"
          style={{ width: "100%" }}
        >
          {submitting ? "Submitting…" : "Complete Agreement"}
        </button>
      </div>
    </div>
  );
}
