import React from "react";
import { useHtmlPage } from "../../utils/htmlPage";
import { useTenantAgreement } from "./useTenantAgreement";

const SignaturePad = ({ onChange }) => {
  const canvasRef = React.useRef(null);
  const drawingRef = React.useRef(false);

  const resizeCanvas = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.offsetWidth || 320;
    const height = 140;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2;
    context.strokeStyle = "#111827";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
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
    const clientX = touch ? touch.clientX : event.clientX;
    const clientY = touch ? touch.clientY : event.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (event) => {
    const context = canvasRef.current?.getContext("2d");
    const point = getPoint(event);
    if (!context || !point) return;
    drawingRef.current = true;
    context.beginPath();
    context.moveTo(point.x, point.y);
    event.preventDefault?.();
  };

  const draw = (event) => {
    if (!drawingRef.current) return;
    const context = canvasRef.current?.getContext("2d");
    const point = getPoint(event);
    if (!context || !point) return;
    context.lineTo(point.x, point.y);
    context.stroke();
    onChange(canvasRef.current.toDataURL("image/png"));
    event.preventDefault?.();
  };

  const stopDrawing = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    onChange(canvasRef.current?.toDataURL("image/png") || "");
  };

  const clearSignature = () => {
    resizeCanvas();
    onChange("");
  };

  return (
    <div style={{ marginTop: "12px" }}>
      <div
        style={{
          border: "1px dashed #94a3b8",
          borderRadius: "16px",
          background: "#fff",
          overflow: "hidden"
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "140px", display: "block", touchAction: "none", background: "#fff" }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
        <span style={{ fontSize: "12px", color: "#64748b" }}>Sign inside the box</span>
        <button
          type="button"
          onClick={clearSignature}
          style={{ border: "none", background: "transparent", color: "#2563eb", fontSize: "13px", cursor: "pointer" }}
        >
          Clear
        </button>
      </div>
    </div>
  );
};

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

  const { loginId, setLoginId, eSignName, setESignName, accepted, setAccepted, submitting, error, handleSubmit } =
    useTenantAgreement();
  const [signatureDataUrl, setSignatureDataUrl] = React.useState("");

  return (
    <div className="html-page">
      <div className="wrap" style={{ maxWidth: "820px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", marginBottom: "18px" }}>
          <div>
            <h2 style={{ marginBottom: "6px" }}>RoomHy Rental Agreement</h2>
            <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
              Review the agreement, sign below, and complete your tenant onboarding.
            </p>
          </div>
          <div
            style={{
              minWidth: "120px",
              textAlign: "center",
              border: "2px solid #1d4ed8",
              color: "#1d4ed8",
              borderRadius: "18px",
              padding: "10px 12px",
              fontWeight: 800,
              letterSpacing: "0.08em"
            }}
          >
            ROOMHY
            <div style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.02em" }}>OFFICIAL SEAL</div>
          </div>
        </div>

        <div className="box" style={{ maxHeight: "460px", overflowY: "auto", lineHeight: 1.75 }}>
          <h3 style={{ marginTop: 0 }}>LICENCE &amp; SUBSCRIPTION AGREEMENT</h3>
          <p>
            This License &amp; Subscription Agreement is executed between RoomHy and the Tenant as named in Annexure A.
            The parties agree that the tenant will occupy the allotted premises for residential purposes subject to the
            terms below.
          </p>
          <p><strong>1. Term:</strong> As per Annexure A.</p>
          <p><strong>2. Premises:</strong> As per Annexure A.</p>
          <p><strong>3. License Fee / Rent:</strong> As per Annexure A. Rent must be paid in advance on or before the due date.</p>
          <p><strong>4. Refundable Security Deposit:</strong> As per Annexure A. Deposit is refundable after deductions for dues or damages.</p>
          <p><strong>5. Minimum Stay Duration:</strong> As per Annexure A. Early move-out before minimum stay can result in deposit withholding.</p>
          <p><strong>6. Limited License:</strong> Use of the premises is subject to timely payment and compliance with RoomHy rules.</p>
          <p><strong>7. Rent Default:</strong> Delay or default in rent can lead to service restrictions, lockout, penalties, and termination.</p>
          <p><strong>8. Termination Without Cause:</strong> Either party may terminate with prior notice, subject to lock-in and notice conditions.</p>
          <p><strong>9. Termination For Cause:</strong> RoomHy may terminate immediately for illegal activity, non-payment, damage, or violation of rules.</p>
          <p><strong>10. Maintenance:</strong> Tenant must maintain the premises and bears cost for damages beyond normal wear and tear.</p>
          <p><strong>11. Renewal:</strong> Agreement may renew with revised rent and terms based on market conditions.</p>
          <p><strong>12. Notices:</strong> Notices may be sent by email or written communication.</p>
          <p><strong>13. Entire Agreement:</strong> This agreement with annexures forms the complete understanding between parties.</p>
          <p><strong>14. Severability:</strong> If any clause is invalid, the rest of the agreement remains effective.</p>
          <p><strong>15. Governing Law &amp; Jurisdiction:</strong> Laws of India apply and jurisdiction lies where the premises are located.</p>
          <p><strong>16. Assignment Of Receivables:</strong> RoomHy may assign receivables under this agreement.</p>
          <p><strong>17. Stamp Duty:</strong> Applicable stamp duty obligations, if any, are the responsibility of the tenant.</p>
          <p><strong>18. Other Terms &amp; Conditions:</strong> RoomHy may revise operating policies and tenant rules from time to time.</p>
          <h4>Annexure A</h4>
          <p>
            Tenant name, address, phone, email, premises details, accommodation type, monthly rent, start date, due date,
            early termination charges, move out charges, notice period, security deposit, inclusions, minimum stay duration,
            and tax details will be recorded from RoomHy tenant records.
          </p>
        </div>

        <label>Login ID</label>
        <input value={loginId} onChange={(e) => setLoginId(e.target.value)} required />

        <label>E-sign Full Name</label>
        <input value={eSignName} onChange={(e) => setESignName(e.target.value)} required />

        <label>Tenant Signature</label>
        <SignaturePad onChange={setSignatureDataUrl} />

        <label>
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            style={{ width: "auto" }}
          />{" "}
          I accept the rental agreement and provide my e-sign consent.
        </label>

        {error ? <div style={{ color: "#dc2626", marginTop: "12px", fontSize: "14px" }}>{error}</div> : null}
        <p style={{ marginTop: "12px", color: "#6b7280", fontSize: "14px" }}>
          After submission, the signed RoomHy rental agreement will be completed and emailed to the tenant.
        </p>

        <button onClick={() => handleSubmit(signatureDataUrl)} disabled={submitting} type="button">
          {submitting ? "Submitting..." : "Complete Agreement"}
        </button>
      </div>
    </div>
  );
}
