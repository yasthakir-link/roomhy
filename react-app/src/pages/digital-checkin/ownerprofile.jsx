import React, { useRef } from "react";
import { useHtmlPage } from "../../utils/htmlPage";
import { useOwnerProfile } from "./useOwnerProfile";

function AadhaarUploadArea({ doc, ocrStatus, onFileChange, onRemove, onUpload, uploading }) {
  const inputRef = React.useRef(null);
  const previewSrc = doc.preview || doc.url || "";
  const status = ocrStatus?.type || "";
  const statusIcon = { verified: "✓", scanning: "◌", suspicious: "⚠", rejected: "✕", error: "✕" }[status] || "";

  return (
    <div className="aadhaar-upload-wrap">
      {(previewSrc || doc.file) && (
        <div className="doc-upload-label-row" style={{ padding: "0 22px", marginBottom: 8 }}>
          <span />
          <button type="button" className="doc-remove-btn" onClick={onRemove} title="Remove and reupload">
            ✕ Remove
          </button>
        </div>
      )}
      <div
        className={`aadhaar-drop-zone ${status ? `aadhaar-drop-zone--${status}` : ""}`}
        onClick={() => !previewSrc && inputRef.current?.click()}
        style={{ cursor: previewSrc ? "default" : "pointer" }}
      >
        {previewSrc ? (
          <img src={previewSrc} alt="Aadhaar card" className="aadhaar-preview-img" />
        ) : (
          <div className="aadhaar-drop-inner">
            <div className="aadhaar-drop-icon">🪪</div>
            <p className="aadhaar-drop-title">Click to upload Aadhaar card image</p>
            <p className="aadhaar-drop-sub">JPG or PNG — front side of card — max 5 MB</p>
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => onFileChange(e.target.files?.[0])} />
      </div>

      {ocrStatus?.text && (
        <div className={`aadhaar-ocr-badge aadhaar-ocr-badge--${status}`}>
          {status === "scanning" ? (
            <span className="aadhaar-ocr-spinner" />
          ) : (
            <span className="aadhaar-ocr-badge-icon">{statusIcon}</span>
          )}
          {ocrStatus.text}
        </div>
      )}

      {previewSrc && !doc.uploaded && (
        <div className="aadhaar-upload-actions">
          <button type="button" onClick={onUpload} disabled={uploading} className="kyc-btn kyc-btn--save">
            {uploading ? "Saving..." : "Save Aadhaar Image"}
          </button>
          {doc.file && <span className="aadhaar-file-name">{doc.name}</span>}
        </div>
      )}
      {doc.uploaded && <p className="aadhaar-uploaded-msg">✓ Aadhaar image saved successfully.</p>}
    </div>
  );
}

function UploadBox({ label, icon, doc, inputId, onFileChange, onRemove }) {
  const inputRef = useRef(null);
  const previewSrc = doc.preview || doc.url || "";
  const isImage = doc.type?.startsWith("image/") || (doc.url && !doc.url.endsWith(".pdf"));

  return (
    <div className="doc-upload-wrap">
      <div className="doc-upload-label-row">
        <span className="doc-upload-label">{label}</span>
        {(previewSrc || doc.file) && (
          <button type="button" className="doc-remove-btn" onClick={onRemove} title="Remove and reupload">
            ✕ Remove
          </button>
        )}
      </div>
      <div
        className={`doc-drop-zone ${doc.uploaded ? "doc-drop-zone--done" : ""}`}
        onClick={() => !previewSrc && inputRef.current?.click()}
        style={{ cursor: previewSrc ? "default" : "pointer" }}
      >
        {previewSrc && isImage ? (
          <img src={previewSrc} alt={label} className="doc-preview-img" />
        ) : previewSrc ? (
          <div className="doc-drop-inner">
            <div className="doc-drop-icon">📄</div>
            <p className="doc-drop-title">{doc.name || "Document selected"}</p>
            <p className="doc-drop-sub">{doc.uploaded ? "Uploaded successfully" : "Ready to upload"}</p>
          </div>
        ) : (
          <div className="doc-drop-inner">
            <div className="doc-drop-icon">{icon || "📎"}</div>
            <p className="doc-drop-title">Click to upload {label}</p>
            <p className="doc-drop-sub">JPG, PNG or PDF — max 5 MB</p>
          </div>
        )}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/*,application/pdf"
          style={{ display: "none" }}
          onChange={(e) => onFileChange(e.target.files?.[0])}
        />
      </div>
      {doc.file && !doc.uploaded && (
        <div className="doc-status-badge doc-status-badge--pending">
          <span>⏳</span> {doc.name} — not yet uploaded
        </div>
      )}
      {doc.uploaded && (
        <div className="doc-status-badge doc-status-badge--done">
          <span>✓</span> Saved: {doc.name || "file"}
        </div>
      )}
    </div>
  );
}

export default function DigitalCheckinOwnerprofile() {
  useHtmlPage({
    title: "Owner Digital Check-In - Profile",
    bodyClass: "",
    htmlAttrs: { lang: "en" },
    metas: [
      { charset: "UTF-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" }
    ],
    links: [{ rel: "stylesheet", href: "/digital-checkin/assets/css/ownerprofile.css" }],
    styles: [],
    scripts: [],
    inlineScripts: []
  });

  const {
    form,
    updateForm,
    autoInfo,
    showAutoInfo,
    aadhaarLinkedPhone,
    setAadhaarLinkedPhone,
    aadhaarNumber,
    handleAadhaarChange,
    otp,
    setOtp,
    otpSent,
    kycStatus,
    loadingStart,
    loadingComplete,
    handleStartVerification,
    handleCompleteVerification,
    handleSubmit,
    ownerPhoto,
    bankProof,
    aadhaarDoc,
    aadhaarOcrStatus,
    docUploading,
    docStatus,
    handleFileSelect,
    handleDocumentUpload
  } = useOwnerProfile();

  const { occupiedRooms, occupiedBeds, occupiedRoomBeds, vacantRooms, vacantBeds, vacantRoomBeds } = form;

  return (
    <div className="html-page">
      <header className="dc-header">
        <div className="dc-header-inner">
          <img src="/website/images/whitelogo.jpeg" alt="Roomhy Logo" className="dc-logo" />
          <div>
            <p className="dc-eyebrow">Digital Check-In</p>
            <h1 className="dc-header-title">Owner Profile</h1>
          </div>
        </div>
      </header>

      <div className="wrap">
        <div className="hero-card">
          <p className="hero-kicker">Owner Onboarding</p>
          <h2 className="hero-title">Complete your property owner check-in</h2>
          <p className="hero-copy">Fields pre-filled by Roomhy staff are locked. Enter your name, date of birth, and upload required documents.</p>
        </div>

        {showAutoInfo && (
          <div id="autoFetchedInfo" className="info-panel">
            <p className="info-panel-title">Auto-Fetched Information</p>
            <div className="info-panel-grid">
              <p><strong>Email:</strong> <span>{autoInfo.email || "-"}</span></p>
              <p><strong>Area:</strong> <span>{autoInfo.area || "-"}</span></p>
              <p><strong>Password:</strong> <span className="mono">{autoInfo.password || "-"}</span></p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* ── Read-only account details (filled by Roomhy staff) ── */}
          <div className="section-label full">
            <span>Account Details</span>
            <span className="badge badge--readonly">Pre-filled by Roomhy</span>
          </div>
          <div className="grid">
            <div>
              <label>Login ID</label>
              <input value={form.loginId} readOnly className="input-readonly" tabIndex={-1} />
            </div>
            <div>
              <label>Gmail</label>
              <input value={form.email} readOnly className="input-readonly" tabIndex={-1} type="email" />
            </div>
            <div>
              <label>Area</label>
              <input value={form.area} readOnly className="input-readonly" tabIndex={-1} />
            </div>
            <div>
              <label>Phone Number</label>
              <input value={form.phone} readOnly className="input-readonly" tabIndex={-1} type="tel" />
            </div>
            <div className="full">
              <label>Address</label>
              <input
                value={form.address}
                onChange={(e) => updateForm({ address: e.target.value })}
                placeholder="Enter your address"
              />
            </div>
            <div>
              <label>Bank Name</label>
              <input value={form.bankName} readOnly className="input-readonly" tabIndex={-1} />
            </div>
            <div>
              <label>Branch Name</label>
              <input value={form.branchName} readOnly className="input-readonly" tabIndex={-1} />
            </div>
            <div>
              <label>Bank Account Number</label>
              <input value={form.bankAccountNumber} readOnly className="input-readonly" tabIndex={-1} />
            </div>
            <div>
              <label>IFSC Code</label>
              <input value={form.ifscCode} readOnly className="input-readonly" tabIndex={-1} />
            </div>
            <div>
              <label>Account Holder Name</label>
              <input value={form.accountHolderName} readOnly className="input-readonly" tabIndex={-1} />
            </div>
            <div>
              <label>UPI ID</label>
              <input value={form.upiId || "-"} readOnly className="input-readonly" tabIndex={-1} />
            </div>
          </div>

          {/* ── Owner fills: name + dob only ── */}
          <div className="section-label full" style={{ marginTop: 24 }}>
            <span>Your Personal Details</span>
            <span className="badge badge--owner">Fill by You</span>
          </div>
          <div className="grid">
            <div>
              <label>Full Name <span className="req">*</span></label>
              <input
                value={form.name}
                onChange={(e) => updateForm({ name: e.target.value })}
                required
                placeholder="Enter your full name"
              />
            </div>
            <div>
              <label>Date of Birth <span className="req">*</span></label>
              <input
                value={form.dob}
                onChange={(e) => updateForm({ dob: e.target.value })}
                type="date"
                required
              />
            </div>
          </div>
          <div className="full actions-row" style={{ marginTop: 8 }}>
            <button type="submit" className="secondary-btn">Save Profile</button>
          </div>

          {/* ── Occupancy (read-only) ── */}
          <div className="section-label full" style={{ marginTop: 24 }}>
            <span>Occupancy Details</span>
            <span className="badge badge--readonly">Pre-filled by Roomhy</span>
          </div>
          <div className="full">
            <div className="occupancy-grid">
              <div className="occupancy-block">
                <label>Occupied Rooms</label>
                <input type="number" value={occupiedRooms} readOnly className="input-readonly" tabIndex={-1} />
                {occupiedRoomBeds.map((beds, index) => (
                  <div key={`occ-${index}`} className="room-bed-row">
                    <label>{`Occupied Room ${index + 1} Beds`}</label>
                    <input type="number" value={beds} readOnly className="input-readonly" tabIndex={-1} />
                  </div>
                ))}
                <p className="occupancy-total">{`Occupied Beds Total: ${occupiedBeds}`}</p>
              </div>
              <div className="occupancy-block">
                <label>Vacant Rooms</label>
                <input type="number" value={vacantRooms} readOnly className="input-readonly" tabIndex={-1} />
                {vacantRoomBeds.map((beds, index) => (
                  <div key={`vac-${index}`} className="room-bed-row">
                    <label>{`Vacant Room ${index + 1} Beds`}</label>
                    <input type="number" value={beds} readOnly className="input-readonly" tabIndex={-1} />
                  </div>
                ))}
                <p className="occupancy-total">{`Vacant Beds Total: ${vacantBeds}`}</p>
              </div>
            </div>
          </div>

          {/* ── Owner Photo + Bank Proof ── */}
          <div className="section-label full" style={{ marginTop: 24 }}>
            <span>Owner Documents</span>
            <span className="badge badge--owner">Upload by You</span>
          </div>
          <p className="full" style={{ color: "#616d79", fontSize: 13, margin: "0 0 14px" }}>
            Upload your profile photo and bank statement.
          </p>
          <div className="full upload-grid">
            <UploadBox
              label="Owner Photo"
              icon="🧑‍💼"
              doc={ownerPhoto}
              inputId="ownerPhotoInput"
              onFileChange={(file) => handleFileSelect("ownerPhoto", file)}
              onRemove={() => handleFileSelect("ownerPhoto", null)}
            />
            <UploadBox
              label="Bank Statement / Proof"
              icon="🏦"
              doc={bankProof}
              inputId="bankProofInput"
              onFileChange={(file) => handleFileSelect("bankProof", file)}
              onRemove={() => handleFileSelect("bankProof", null)}
            />
          </div>
          {docStatus.text && (
            <div className={`full status-box ${docStatus.type === "error" ? "status-error" : "status-success"}`} style={{ marginTop: 10 }}>
              {docStatus.text}
            </div>
          )}
          <div className="full actions-row">
            <button type="button" onClick={handleDocumentUpload} disabled={docUploading} className="upload-btn">
              {docUploading ? "Uploading..." : "Upload Documents"}
            </button>
          </div>

          {/* ── Aadhaar Card Verification ── */}
          <div className="kyc-card full" style={{ marginTop: 28 }}>
            <div className="kyc-card-header">
              <div className="kyc-card-icon-wrap">🪪</div>
              <div>
                <h3 className="kyc-card-title">Aadhaar Card Verification</h3>
                <p className="kyc-card-desc">Upload a clear photo of your Aadhaar card (front side). We'll scan and verify it automatically.</p>
              </div>
            </div>

            <AadhaarUploadArea
              doc={aadhaarDoc}
              ocrStatus={aadhaarOcrStatus}
              onFileChange={(file) => handleFileSelect("aadhaarDoc", file)}
              onRemove={() => handleFileSelect("aadhaarDoc", null)}
              onUpload={handleDocumentUpload}
              uploading={docUploading}
            />
          </div>

          {/* ── Aadhaar OTP Verification ── */}
          <div className="kyc-card full" style={{ marginTop: 16 }}>
            <div className="kyc-card-header">
              <div className="kyc-card-icon-wrap">📱</div>
              <div>
                <h3 className="kyc-card-title">Aadhaar OTP Verification</h3>
                <p className="kyc-card-desc">Verify your identity with an OTP sent to your Aadhaar-linked mobile number.</p>
              </div>
            </div>

            <div className="kyc-fields-grid">
              <div>
                <label>Mobile Number (linked with Aadhaar)</label>
                <input
                  value={aadhaarLinkedPhone}
                  onChange={(e) => setAadhaarLinkedPhone(e.target.value)}
                  type="tel"
                  placeholder="10-digit mobile number"
                />
              </div>
              <div>
                <label>Aadhaar Number</label>
                <input
                  value={aadhaarNumber}
                  onChange={(e) => handleAadhaarChange(e.target.value)}
                  type="text"
                  placeholder="XXXX XXXX XXXX"
                />
              </div>
            </div>

            {otpSent && (
              <div className="kyc-otp-row">
                <label>OTP</label>
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  className="kyc-otp-input"
                />
              </div>
            )}

            {kycStatus.text && (
              <div className={`kyc-status-badge kyc-status-badge--${kycStatus.type === "error" ? "error" : "success"}`}>
                {kycStatus.type === "error" ? "✕ " : "✓ "}{kycStatus.text}
              </div>
            )}

            <div className="kyc-actions">
              <button type="button" onClick={handleStartVerification} disabled={loadingStart} className="kyc-btn kyc-btn--send">
                {loadingStart ? "Sending..." : otpSent ? "Resend OTP" : "Send OTP"}
              </button>
              <button type="button" onClick={handleCompleteVerification} disabled={loadingComplete || !otpSent} className="kyc-btn kyc-btn--verify">
                {loadingComplete ? "Verifying..." : "Verify & Complete"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
