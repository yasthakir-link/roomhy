import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatAadhaarWithSpaces,
  getApiBases,
  getParamValue,
  getWithFallback,
  postExpectSuccess,
} from "./utils";

const OWNER_KYC_STATE_KEY = "roomhy_owner_kyc_state";

export const useOwnerKyc = () => {
  const apiBases = useMemo(() => getApiBases(), []);

  const [loginId, setLoginId] = useState("");
  const [aadhaarLinkedPhone, setAadhaarLinkedPhone] = useState("");
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");

  // Aadhaar image upload + OCR
  const [aadhaarImageDataUrl, setAadhaarImageDataUrl] = useState("");
  const [ocrStatus, setOcrStatus] = useState("idle"); // idle | loading | success | error | sandbox
  const [ocrExtractedNum, setOcrExtractedNum] = useState("");

  // OTP flow
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);

  // DigiLocker flow
  const [digilockerRef, setDigilockerRef] = useState("");
  const [lastRefId, setLastRefId] = useState("");
  const [loadingStart, setLoadingStart] = useState(false);
  const [loadingComplete, setLoadingComplete] = useState(false);

  const [otpMsg, setOtpMsg] = useState({ type: "", text: "" });
  const [nextVisible, setNextVisible] = useState(false);

  useEffect(() => {
    const initialLoginId = getParamValue(["loginId", "loginid", "staffId"]);
    const initialEmail = getParamValue(["email", "ownerEmail", "mail"]);
    if (initialLoginId) setLoginId(initialLoginId);
    if (initialEmail) setOwnerEmail(initialEmail);
  }, []);

  useEffect(() => {
    try {
      const state = JSON.parse(sessionStorage.getItem(OWNER_KYC_STATE_KEY) || "{}");
      if (!state || typeof state !== "object") return;
      if (!loginId && state.loginId) setLoginId(state.loginId);
      if (state.aadhaarLinkedPhone) setAadhaarLinkedPhone(state.aadhaarLinkedPhone);
      if (state.aadhaarNumber) setAadhaarNumber(state.aadhaarNumber);
      if (state.referenceId) {
        setDigilockerRef(state.referenceId);
        setLastRefId(state.referenceId);
      }
      if (!ownerEmail && state.ownerEmail) setOwnerEmail(state.ownerEmail);
      if (state.otpSent) setOtpSent(true);
      if (state.otpVerified) { setOtpVerified(true); setNextVisible(true); }
    } catch (_) {}
  }, [loginId, ownerEmail]);

  const saveKycState = useCallback(
    (extra = {}) => {
      try {
        sessionStorage.setItem(OWNER_KYC_STATE_KEY, JSON.stringify({
          loginId: loginId.trim(),
          aadhaarLinkedPhone: aadhaarLinkedPhone.trim(),
          aadhaarNumber: aadhaarNumber.trim().replace(/\D/g, ""),
          ownerEmail,
          referenceId: digilockerRef.trim() || lastRefId || "",
          otpSent,
          otpVerified,
          ...extra
        }));
      } catch (_) {}
    },
    [aadhaarLinkedPhone, aadhaarNumber, digilockerRef, lastRefId, loginId, ownerEmail, otpSent, otpVerified]
  );

  // Restore DigiLocker callback params from URL
  useEffect(() => {
    const referenceFromCallback = getParamValue(["reference_id", "ref_id", "referenceId"]);
    const verificationFromCallback = getParamValue(["verification_id", "verificationId"]);
    if (referenceFromCallback) {
      setDigilockerRef(referenceFromCallback);
      setLastRefId(referenceFromCallback);
      saveKycState({ referenceId: referenceFromCallback, verificationId: verificationFromCallback || "" });
      setOtpMsg({ type: "success", text: "DigiLocker callback received. Click Complete Verification." });
    }
  }, [saveKycState]);

  // Hydrate owner email from DB if not in URL
  useEffect(() => {
    const hydrateOwnerEmail = async () => {
      if (!loginId || ownerEmail) return;
      try {
        const owner = await getWithFallback(`/api/owners/${encodeURIComponent(loginId)}`, apiBases);
        const email = (owner?.email || owner?.profile?.email || owner?.checkinEmail || "").trim();
        if (email) setOwnerEmail(email);
      } catch (_) {}
    };
    hydrateOwnerEmail();
  }, [apiBases, loginId, ownerEmail]);

  const handleAadhaarChange = useCallback((value) => {
    setAadhaarNumber(formatAadhaarWithSpaces(value));
  }, []);

  // Upload Aadhaar image → OCR check
  const handleAadhaarImageUpload = useCallback(async (dataUrl, name, type) => {
    setAadhaarImageDataUrl(dataUrl);
    setOcrStatus("loading");
    setOcrExtractedNum("");
    try {
      const data = await postExpectSuccess(
        "/api/checkin/owner/documents",
        {
          loginId: loginId.trim(),
          aadhaarImage: { dataUrl, name: name || "aadhaar.jpg", type: type || "image/jpeg" }
        },
        apiBases
      );
      if (data.ocrResult?.sandbox) {
        setOcrStatus("sandbox");
      } else if (data.ocrResult && data.ocrResult.aadhaar_number) {
        const extracted = String(data.ocrResult.aadhaar_number || "").replace(/\D/g, "");
        setOcrExtractedNum(extracted);
        if (extracted.length === 12) {
          setAadhaarNumber(formatAadhaarWithSpaces(extracted));
        }
        setOcrStatus("success");
      } else if (data.ocrError) {
        setOcrStatus("error");
      } else {
        setOcrStatus("sandbox");
      }
    } catch (err) {
      setOcrStatus("error");
    }
  }, [apiBases, loginId]);

  const clearAadhaarImage = useCallback(() => {
    setAadhaarImageDataUrl("");
    setOcrStatus("idle");
    setOcrExtractedNum("");
  }, []);

  // OTP: Send
  const handleSendOtp = useCallback(async () => {
    const aadhaarRaw = aadhaarNumber.trim().replace(/\D/g, "");
    if (!loginId.trim()) return alert("Login ID is missing");
    if (!/^\d{12}$/.test(aadhaarRaw)) return alert("Aadhaar must be 12 digits");
    if (!aadhaarLinkedPhone.trim()) return alert("Aadhaar-linked phone number is required");

    try {
      setOtpMsg({ type: "", text: "" });
      const data = await postExpectSuccess(
        "/api/checkin/owner/kyc/send-otp",
        {
          loginId: loginId.trim(),
          aadhaarLinkedPhone: aadhaarLinkedPhone.trim(),
          aadhaarNumber: aadhaarRaw,
          email: ownerEmail
        },
        apiBases
      );
      setOtpSent(true);
      saveKycState({ otpSent: true });
      setOtpMsg({
        type: "success",
        text: data?.mockOtp
          ? `OTP sent. Sandbox mock OTP: ${data.mockOtp}`
          : "OTP sent to your Aadhaar-linked mobile. Enter it below."
      });
    } catch (err) {
      setOtpMsg({ type: "error", text: `Error: ${err.message}` });
    }
  }, [aadhaarLinkedPhone, aadhaarNumber, apiBases, loginId, ownerEmail, saveKycState]);

  // OTP: Verify
  const handleVerifyOtp = useCallback(async () => {
    const aadhaarRaw = aadhaarNumber.trim().replace(/\D/g, "");
    if (!otp.trim()) return alert("Please enter the OTP");
    if (!/^\d{12}$/.test(aadhaarRaw)) return alert("Aadhaar must be 12 digits");

    try {
      await postExpectSuccess(
        "/api/checkin/owner/kyc/verify-otp",
        { loginId: loginId.trim(), aadhaarNumber: aadhaarRaw, otp: otp.trim() },
        apiBases
      );
      setOtpVerified(true);
      saveKycState({ otpVerified: true });
      setOtpMsg({ type: "success", text: "Aadhaar OTP verified successfully." });
      setNextVisible(true);
    } catch (err) {
      setOtpMsg({ type: "error", text: `Error: ${err.message}` });
    }
  }, [aadhaarNumber, apiBases, loginId, otp, saveKycState]);

  // DigiLocker: Start
  const handleStart = useCallback(async () => {
    const trimmedLogin = loginId.trim();
    const aadhaarRaw = aadhaarNumber.trim().replace(/\s/g, "");
    if (!trimmedLogin) return alert("Login ID is missing. Please check the URL.");
    if (!/^\d{12}$/.test(aadhaarRaw)) return alert("Aadhaar must be 12 digits");

    try {
      setLoadingStart(true);
      const emailPart = ownerEmail ? `&email=${encodeURIComponent(ownerEmail)}` : "";
      const redirectUrl = `${window.location.origin}${window.location.pathname}?loginId=${encodeURIComponent(trimmedLogin)}${emailPart}`;
      const data = await postExpectSuccess(
        "/api/checkin/owner/kyc/digilocker/start",
        { loginId: trimmedLogin, aadhaarLinkedPhone: aadhaarLinkedPhone.trim(), aadhaarNumber: aadhaarRaw, email: ownerEmail, redirectUrl },
        apiBases
      );
      const referenceId = data.referenceId || "";
      setLastRefId(referenceId);
      setDigilockerRef(referenceId);
      saveKycState({ referenceId, verificationId: data.verificationId || "" });
      setOtpMsg({ type: "success", text: "DigiLocker verification initiated. Complete it and click Complete Verification." });
      if (data.verifyUrl) window.location.href = data.verifyUrl;
    } catch (err) {
      setOtpMsg({ type: "error", text: `Error: ${err.message}` });
      setLoadingStart(false);
    }
  }, [aadhaarLinkedPhone, aadhaarNumber, apiBases, loginId, ownerEmail, saveKycState]);

  // DigiLocker: Complete
  const handleComplete = useCallback(async () => {
    const trimmedLogin = loginId.trim();
    const aadhaarRaw = aadhaarNumber.trim().replace(/\s/g, "");
    const referenceId = digilockerRef.trim() || lastRefId;
    if (!trimmedLogin) return alert("Login ID is missing");
    if (!/^\d{12}$/.test(aadhaarRaw)) return alert("Aadhaar must be 12 digits");
    if (!referenceId) return alert("DigiLocker reference ID is required");

    try {
      saveKycState({ referenceId });
      setLoadingComplete(true);
      const data = await postExpectSuccess(
        "/api/checkin/owner/kyc/digilocker/complete",
        { loginId: trimmedLogin, aadhaarNumber: aadhaarRaw, referenceId },
        apiBases
      );
      if (data?.aadhaarNumber) {
        setAadhaarNumber(formatAadhaarWithSpaces(data.aadhaarNumber));
        saveKycState({ aadhaarNumber: data.aadhaarNumber, referenceId });
      }
      setOtpMsg({ type: "success", text: "DigiLocker verification completed successfully." });
      setNextVisible(true);
    } catch (err) {
      setOtpMsg({ type: "error", text: `Error: ${err.message}` });
      setLoadingComplete(false);
    }
  }, [aadhaarNumber, apiBases, digilockerRef, lastRefId, loginId, saveKycState]);

  const handleNext = useCallback(() => {
    const emailPart = ownerEmail ? `&email=${encodeURIComponent(ownerEmail)}` : "";
    window.location.href = `/digital-checkin/ownerterms?loginId=${encodeURIComponent(loginId.trim())}${emailPart}`;
  }, [loginId, ownerEmail]);

  return {
    loginId, setLoginId,
    ownerEmail,
    aadhaarLinkedPhone, setAadhaarLinkedPhone,
    aadhaarNumber, handleAadhaarChange,
    // Aadhaar image OCR
    aadhaarImageDataUrl, ocrStatus, ocrExtractedNum,
    handleAadhaarImageUpload, clearAadhaarImage,
    // OTP
    otp, setOtp, otpSent, otpVerified,
    handleSendOtp, handleVerifyOtp,
    // DigiLocker
    digilockerRef, setDigilockerRef,
    loadingStart, loadingComplete,
    handleStart, handleComplete,
    // Common
    otpMsg, nextVisible, handleNext
  };
};
