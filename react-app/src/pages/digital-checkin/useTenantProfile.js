import { useCallback, useEffect, useMemo, useState } from "react";
import { isLocalHost } from "./utils";

const emptyForm = {
  loginId: "",
  name: "",
  tenantAddress: "",
  propertyName: "",
  propertyAddress: "",
  accommodationType: "",
  roomNo: "",
  agreedRent: "",
  securityDepositTotal: "",
  securityDepositPaid: "",
  securityDepositBalance: "",
  electricityCharge: "",
  maintenanceCharge: "",
  dob: "",
  guardianNumber: "",
  moveInDate: "",
  email: "",
  tenantPhone: "",
  backupEmail: "",
  backupPhone: "",
  duration: "",
  licenseStartDate: "",
  licenseEndDate: "",
  licenseFeeDueDate: "5",
  moveOutCharges: "",
  noticePeriodCharges: "",
  securityDeposit: "",
  inclusions: "",
  minimumStayDuration: "3 Months",
  gstCharges: "0",
  ownerName: ""
};

export const useTenantProfile = () => {
  const apiBase = useMemo(
    () => (isLocalHost() ? "http://localhost:5001" : "https://api.roomhy.com"),
    []
  );
  const [form, setForm] = useState(emptyForm);
  const [ownerFilledFields, setOwnerFilledFields] = useState([]);
  const [prefillLoading, setPrefillLoading] = useState(false);

  const updateForm = useCallback((patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  // Read loginId from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loginId = params.get("loginId");
    if (loginId) {
      updateForm({ loginId: loginId.toUpperCase() });
    }
  }, [updateForm]);

  // Fetch owner-filled tenant data from the backend prefill endpoint
  useEffect(() => {
    const loginId = (form.loginId || "").trim().toUpperCase();
    if (!loginId) return;

    const prefill = async () => {
      setPrefillLoading(true);
      try {
        const res = await fetch(`${apiBase}/api/checkin/tenant/prefill/${encodeURIComponent(loginId)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) return;

        const { prefillData = {}, ownerFilledFields: filled = [] } = data;

        // Only apply fields that have a value — don't overwrite tenant's prior input with blanks
        const patch = {};
        Object.keys(prefillData).forEach((k) => {
          if (prefillData[k] !== "" && prefillData[k] !== null && prefillData[k] !== undefined) {
            patch[k] = prefillData[k];
          }
        });
        if (Object.keys(patch).length > 0) updateForm(patch);
        setOwnerFilledFields(filled);
      } catch (_) {
        // network error — form remains empty/editable
      } finally {
        setPrefillLoading(false);
      }
    };

    prefill();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, form.loginId]);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      const rentRaw = (form.agreedRent || "").replace(/[^\d.]/g, "");
      const securityDepositTotalRaw = (form.securityDepositTotal || "").replace(/[^\d.]/g, "");
      const securityDepositPaidRaw = (form.securityDepositPaid || "").replace(/[^\d.]/g, "");
      const securityDepositBalanceRaw = (form.securityDepositBalance || "").replace(/[^\d.]/g, "");
      const electricityChargeRaw = (form.electricityCharge || "").replace(/[^\d.]/g, "");
      const maintenanceChargeRaw = (form.maintenanceCharge || "").replace(/[^\d.]/g, "");
      const payload = {
        loginId: form.loginId.trim().toUpperCase(),
        name: form.name.trim(),
        propertyName: form.propertyName.trim(),
        roomNo: form.roomNo.trim(),
        agreedRent: rentRaw ? Number(rentRaw) : null,
        securityDepositTotal: securityDepositTotalRaw ? Number(securityDepositTotalRaw) : 0,
        securityDepositPaid: securityDepositPaidRaw ? Number(securityDepositPaidRaw) : 0,
        securityDepositBalance: securityDepositBalanceRaw ? Number(securityDepositBalanceRaw) : 0,
        electricityCharge: electricityChargeRaw ? Number(electricityChargeRaw) : 0,
        maintenanceCharge: maintenanceChargeRaw ? Number(maintenanceChargeRaw) : 0,
        dob: form.dob,
        guardianNumber: form.guardianNumber.trim(),
        moveInDate: form.moveInDate,
        email: form.email.trim(),
        agreementDetails: {
          tenantName: form.name.trim(),
          tenantAddress: form.tenantAddress.trim(),
          tenantEmail: form.email.trim(),
          tenantPhone: form.tenantPhone.trim(),
          backupEmail: form.backupEmail.trim(),
          backupPhone: form.backupPhone.trim(),
          propertyName: form.propertyName.trim(),
          propertyAddress: form.propertyAddress.trim(),
          accommodationType: form.accommodationType.trim(),
          roomNumber: form.roomNo.trim(),
          rentAmount: rentRaw || "",
          duration: form.duration.trim(),
          licenseStartDate: form.licenseStartDate || form.moveInDate,
          licenseEndDate: form.licenseEndDate || "",
          licenseFeeDueDate: form.licenseFeeDueDate.trim() || "5",
          moveOutCharges: form.moveOutCharges.trim(),
          noticePeriodCharges: form.noticePeriodCharges.trim(),
          securityDeposit: form.securityDeposit.trim() || securityDepositTotalRaw || "",
          inclusions: form.inclusions.trim(),
          minimumStayDuration: form.minimumStayDuration.trim() || "3 Months",
          gstCharges: form.gstCharges.trim() || "0",
          ownerName: form.ownerName.trim()
        }
      };

      const res = await fetch(`${apiBase}/api/checkin/tenant/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) return alert(data.message || "Failed to save profile");

      window.location.href = `/digital-checkin/tenantkyc?loginId=${encodeURIComponent(payload.loginId)}`;
    },
    [apiBase, form]
  );

  return { form, updateForm, handleSubmit, ownerFilledFields, prefillLoading };
};
