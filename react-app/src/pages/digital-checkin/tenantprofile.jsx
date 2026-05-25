import React from "react";
import { useHtmlPage } from "../../utils/htmlPage";
import { useTenantProfile } from "./useTenantProfile";

function Field({ label, field, type, required, locked, form, updateForm, children }) {
  const isLocked = locked(field);
  return (
    <div className={isLocked ? "field-group field-locked" : "field-group"}>
      <label>
        {label}
        {isLocked && <span className="owner-badge">Pre-filled by owner</span>}
        {required && !isLocked && <span className="required-mark"> *</span>}
      </label>
      {children || (
        <input
          type={type || "text"}
          value={form[field]}
          onChange={(e) => !isLocked && updateForm({ [field]: e.target.value })}
          readOnly={isLocked}
          required={required && !isLocked}
        />
      )}
    </div>
  );
}

export default function DigitalCheckinTenantprofile() {
  useHtmlPage({
    title: "Tenant Digital Check-In - Profile",
    bodyClass: "",
    htmlAttrs: { lang: "en" },
    metas: [
      { charset: "UTF-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" }
    ],
    links: [{ rel: "stylesheet", href: "/digital-checkin/assets/css/tenantprofile.css" }],
    styles: [],
    scripts: [],
    inlineScripts: []
  });

  const { form, updateForm, handleSubmit, ownerFilledFields, prefillLoading } = useTenantProfile();
  const locked = (field) => ownerFilledFields.includes(field);

  return (
    <div className="html-page">
      <div className="wrap">
        <h2>Tenant Profile</h2>

        {prefillLoading && (
          <div className="prefill-notice">Loading your details...</div>
        )}

        {ownerFilledFields.length > 0 && !prefillLoading && (
          <div className="prefill-banner">
            Some fields have been pre-filled by your property owner and cannot be changed. Please fill in the remaining fields to continue.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid">

            <Field form={form} updateForm={updateForm} locked={locked} label="Login ID" field="loginId" required>
              <input value={form.loginId} readOnly className="input-readonly" />
            </Field>

            <Field form={form} updateForm={updateForm} locked={locked} label="Name" field="name" required />

            <Field form={form} updateForm={updateForm} locked={locked} label="Property Name" field="propertyName" />

            <Field form={form} updateForm={updateForm} locked={locked} label="Property Address" field="propertyAddress" />

            <Field form={form} updateForm={updateForm} locked={locked} label="Tenant Address" field="tenantAddress" required />

            <Field form={form} updateForm={updateForm} locked={locked} label="Room Number" field="roomNo" />

            <Field form={form} updateForm={updateForm} locked={locked} label="Accommodation Type" field="accommodationType" />

            <Field form={form} updateForm={updateForm} locked={locked} label="Agreed Rent" field="agreedRent" />

            <Field form={form} updateForm={updateForm} locked={locked} label="Security Deposit Total" field="securityDepositTotal" />

            <Field form={form} updateForm={updateForm} locked={locked} label="Security Deposit Paid" field="securityDepositPaid" />

            <Field form={form} updateForm={updateForm} locked={locked} label="Security Deposit Balance" field="securityDepositBalance" />

            <Field form={form} updateForm={updateForm} locked={locked} label="Electricity Charge" field="electricityCharge" />

            <Field form={form} updateForm={updateForm} locked={locked} label="Maintenance Charge" field="maintenanceCharge" />

            <Field form={form} updateForm={updateForm} locked={locked} label="Date of Birth" field="dob" type="date" required />

            <Field form={form} updateForm={updateForm} locked={locked} label="Guardian Number" field="guardianNumber" required />

            <Field form={form} updateForm={updateForm} locked={locked} label="Date of Move In" field="moveInDate" type="date" required />

            <Field form={form} updateForm={updateForm} locked={locked} label="Email" field="email" type="email" required />

            <Field form={form} updateForm={updateForm} locked={locked} label="Tenant Phone" field="tenantPhone" required />

            <Field form={form} updateForm={updateForm} locked={locked} label="Backup Email" field="backupEmail" type="email" />

            <Field form={form} updateForm={updateForm} locked={locked} label="Backup Phone" field="backupPhone" />

            <Field form={form} updateForm={updateForm} locked={locked} label="Duration" field="duration" />

            <Field form={form} updateForm={updateForm} locked={locked} label="License Start Date" field="licenseStartDate" type="date" />

            <Field form={form} updateForm={updateForm} locked={locked} label="License End Date" field="licenseEndDate" type="date" />

            <Field form={form} updateForm={updateForm} locked={locked} label="License Fee Due Date" field="licenseFeeDueDate" />

            <Field form={form} updateForm={updateForm} locked={locked} label="Move Out Charges" field="moveOutCharges" />

            <Field form={form} updateForm={updateForm} locked={locked} label="Notice Period Charges" field="noticePeriodCharges" />

            <Field form={form} updateForm={updateForm} locked={locked} label="Security Deposit" field="securityDeposit" />

            <Field form={form} updateForm={updateForm} locked={locked} label="Inclusions" field="inclusions" />

            <Field form={form} updateForm={updateForm} locked={locked} label="Minimum Stay Duration" field="minimumStayDuration" />

            <Field form={form} updateForm={updateForm} locked={locked} label="GST Charges" field="gstCharges" />

            <Field form={form} updateForm={updateForm} locked={locked} label="Owner Name" field="ownerName" />

          </div>
          <button type="submit">Save &amp; Continue to KYC Verification</button>
        </form>
      </div>
    </div>
  );
}
