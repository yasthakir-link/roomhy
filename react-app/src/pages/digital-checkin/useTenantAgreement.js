import { useCallback, useEffect, useMemo, useState } from "react";
import { getApiBases, getWithFallback, postExpectSuccess } from "./utils";

export const useTenantAgreement = () => {
  const apiBases = useMemo(() => getApiBases(), []);
  const [loginId, setLoginId] = useState("");
  const [eSignName, setESignName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [tenantData, setTenantData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("loginId");
    if (id) setLoginId(id);
  }, []);

  useEffect(() => {
    if (!loginId) return;
    setLoadingData(true);
    getWithFallback(`/api/checkin/tenant/${encodeURIComponent(loginId)}`, apiBases)
      .then((data) => {
        if (data?.record) setTenantData(data.record);
      })
      .catch(() => {})
      .finally(() => setLoadingData(false));
  }, [loginId, apiBases]);

  const handleSubmit = useCallback(async (signatureDataUrl = "") => {
    if (!loginId.trim() || !eSignName.trim() || !accepted) {
      setError("Login ID, e-sign and acceptance are required");
      return;
    }
    if (!signatureDataUrl) {
      setError("Tenant signature is required");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const agreementResp = await postExpectSuccess(
        "/api/checkin/tenant/agreement",
        { loginId: loginId.trim(), eSignName: eSignName.trim(), accepted: true, signatureDataUrl },
        apiBases
      );
      if (!agreementResp.nextUrl) {
        throw new Error("Agreement completion URL was not returned");
      }
      window.location.href = agreementResp.nextUrl;
    } catch (err) {
      setError(err.message || "Unable to submit tenant agreement");
    } finally {
      setSubmitting(false);
    }
  }, [accepted, apiBases, eSignName, loginId]);

  return {
    loginId,
    setLoginId,
    eSignName,
    setESignName,
    accepted,
    setAccepted,
    submitting,
    error,
    handleSubmit,
    tenantData,
    loadingData
  };
};
