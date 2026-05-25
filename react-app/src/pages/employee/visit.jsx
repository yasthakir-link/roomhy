import React, { useEffect, useMemo, useRef, useState } from "react";
import { useHtmlPage } from "../../utils/htmlPage";
import { fetchJson } from "../../utils/api";

// ─── Helpers ───────────────────────────────────────────────────────────────────
const readStoredUser = () => {
  try {
    const raw =
      sessionStorage.getItem("manager_user") ||
      sessionStorage.getItem("user") ||
      localStorage.getItem("manager_user") ||
      localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
};

const normalizeVisit = (visit) => {
  const stableId = visit?.visitId || visit?._id || "";
  return { ...visit, _id: stableId, visitId: visit.visitId || stableId };
};

const pickFirstText = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const normalizeIdentity = (value) => String(value || "").trim().toLowerCase();

const visitBelongsToEmployee = (visit, user) => {
  if (!visit || !user) return false;
  const userIds = [user?.loginId, user?.staffId, user?.id, user?._id].map(normalizeIdentity).filter(Boolean);
  const userNames = [user?.name, user?.staffName, user?.fullName, user?.employeeName].map(normalizeIdentity).filter(Boolean);
  const visitIds = [
    visit?.staffId, visit?.submittedById, visit?.employeeId, visit?.employee_id,
    visit?.createdBy, visit?.created_by, visit?.addedBy, visit?.added_by,
    visit?.propertyInfo?.staffId, visit?.propertyInfo?.submittedById
  ].map(normalizeIdentity).filter(Boolean);
  const visitNames = [
    visit?.staffName, visit?.submittedBy, visit?.employeeName,
    visit?.createdByName, visit?.addedByName,
    visit?.propertyInfo?.staffName, visit?.propertyInfo?.submittedBy,
  ].map(normalizeIdentity).filter(Boolean);
  if (userIds.length && visitIds.some((v) => userIds.includes(v))) return true;
  if (userNames.length && visitNames.some((v) => userNames.includes(v))) return true;
  return false;
};

const toDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const watermarkDataUrl = (dataUrl, areaName, visitDate) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const text = `RoomHy | ${areaName || "Area"} | ${visitDate}`;
      const fontSize = Math.max(16, Math.floor(canvas.width / 40));
      ctx.font = `${fontSize}px Inter, sans-serif`;
      ctx.textBaseline = "bottom";
      const padding = 10;
      const textWidth = ctx.measureText(text).width;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(padding - 6, canvas.height - fontSize - padding - 6, textWidth + 12, fontSize + 12);
      ctx.fillStyle = "white";
      ctx.fillText(text, padding, canvas.height - padding);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });

// ─── Credentials generator ─────────────────────────────────────────────────────
const generateOwnerId = () => `ROOMHY${Math.floor(10000 + Math.random() * 90000)}`;
const generatePassword = () => {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

// ─── localStorage helpers ──────────────────────────────────────────────────────
const savePropertyEnquiry = (enquiry) => {
  try {
    const existing = JSON.parse(localStorage.getItem("roomhy_property_enquiries") || "[]");
    existing.unshift(enquiry);
    localStorage.setItem("roomhy_property_enquiries", JSON.stringify(existing));
  } catch (_) {}
};

// ─── Constants ────────────────────────────────────────────────────────────────
const AMENITIES_LIST = [
  "Wi-Fi", "Drinking Water", "Food", "Power Backup",
  "Washing Machine", "Parking", "CCTV", "AC",
  "Geyser", "Lift", "Study Table", "Cupboard"
];

// ══════════════════════════════════════════════════════════════════════════════
// ADD PROPERTY MODAL — per manager's diagram:
// Form shows only Property Info. Owner info autofilled (NOT shown as input).
// ══════════════════════════════════════════════════════════════════════════════
function AddPropertyModal({ visit, staffName, staffId, areaName, onClose, onSuccess }) {
  const [propName, setPropName] = useState(visit?.propertyName || visit?.propertyInfo?.name || "");
  const [propType, setPropType] = useState(visit?.propertyType || "PG");
  const [selectedAmenities, setSelectedAmenities] = useState(
    Array.isArray(visit?.amenities) ? visit.amenities : []
  );
  const [rules, setRules] = useState({
    visitorsAllowed: visit?.visitorsAllowed || "Yes",
    cookingAllowed: visit?.cookingAllowed || "Yes",
    smokingAllowed: visit?.smokingAllowed || "No",
    petsAllowed: visit?.petsAllowed || "No",
    entryExit: visit?.entryExit || ""
  });
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  // Owner info autofilled silently from visit — NOT shown in form (per manager diagram)
  const ownerData = {
    ownerName: visit?.ownerName || visit?.propertyInfo?.ownerName || "",
    ownerEmail: visit?.ownerEmail || visit?.propertyInfo?.ownerEmail || "",
    ownerPhone: visit?.contactPhone || visit?.ownerPhone || visit?.propertyInfo?.contactPhone || "",
    address: visit?.address || visit?.propertyInfo?.address || "",
    city: visit?.city || visit?.propertyInfo?.city || areaName || "",
    area: visit?.area || visit?.areaLocality || areaName || "",
    gender: visit?.gender || "",
    monthlyRent: visit?.monthlyRent || "",
    deposit: visit?.deposit || "",
    roomCount: visit?.roomCount ?? visit?.propertyInfo?.roomCount ?? "",
    bedCount: visit?.bedCount ?? visit?.propertyInfo?.bedCount ?? "",
    vacantRooms: visit?.vacantRooms ?? visit?.propertyInfo?.vacantRooms ?? "",
    vacantBeds: visit?.vacantBeds ?? visit?.propertyInfo?.vacantBeds ?? "",
    occupiedRooms: visit?.occupiedRooms ?? visit?.propertyInfo?.occupiedRooms ?? "",
    occupiedBeds: visit?.occupiedBeds ?? visit?.propertyInfo?.occupiedBeds ?? "",
  };

  const toggleAmenity = (a) =>
    setSelectedAmenities((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  const toggleRule = (key, val) => setRules((prev) => ({ ...prev, [key]: val }));

  const handleImageUpload = async (files) => {
    const remaining = 15 - images.length;
    if (remaining <= 0) { setError("Maximum 15 images allowed."); return; }
    const toProcess = Array.from(files).slice(0, remaining);
    const results = [];
    for (const file of toProcess) {
      const dataUrl = await toDataUrl(file);
      const stamped = await watermarkDataUrl(dataUrl, areaName, new Date().toLocaleDateString());
      results.push(stamped);
    }
    setImages((prev) => [...prev, ...results]);
    setError("");
  };

  const removeImage = (idx) => setImages((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!propName.trim()) { setError("Property name is required."); return; }
    if (images.length === 0) { setError("Please upload at least 1 property image."); return; }
    setSubmitting(true); setError("");
    try {
      const ownerId = generateOwnerId();
      const ownerPassword = generatePassword();
      const enquiryId = `ENQ${Date.now()}`;
      const enquiry = {
        enquiryId, type: "property_from_visit", status: "pending",
        submittedAt: new Date().toISOString(), submittedBy: staffName, submittedById: staffId,
        visitId: visit?.visitId || visit?._id || "", visitArea: areaName,
        propertyName: propName.trim(), propertyType: propType,
        amenities: selectedAmenities, rules, images,
        ...ownerData,
        pendingCredentials: { loginId: ownerId, password: ownerPassword, role: "owner" },
        approvedAt: null, approvedBy: null, credentialsSent: false,
        digitalCheckinLink: null  // never send digital checkin
      };
      savePropertyEnquiry(enquiry);
      try {
        await fetchJson("/api/property-enquiries", { method: "POST", body: JSON.stringify(enquiry) });
      } catch (_) {}
      onSuccess(enquiry);
    } catch (err) {
      setError(err?.message || "Failed to submit property.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex justify-between items-center px-6 py-4 border-b border-gray-100 rounded-t-2xl">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Add Property</h3>
            <p className="text-xs text-gray-400 mt-0.5">Visit → {ownerData.ownerName || "Owner"} • {areaName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 text-gray-400 transition text-lg">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

          {/* Property Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Property Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text" value={propName} onChange={(e) => setPropName(e.target.value)}
              placeholder="e.g. Sunrise PG, Green Hostel..."
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 transition"
            />
          </div>

          {/* Property Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Property Type</label>
            <div className="flex gap-2 flex-wrap">
              {["PG", "Hostel", "Room", "Flat"].map((t) => (
                <button key={t} type="button" onClick={() => setPropType(t)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition ${propType === t ? "border-purple-500 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Amenities */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Amenities</label>
            <div className="grid grid-cols-3 gap-2">
              {AMENITIES_LIST.map((a) => (
                <label key={a} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs font-medium transition select-none ${selectedAmenities.includes(a) ? "border-purple-500 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                  <input type="checkbox" checked={selectedAmenities.includes(a)} onChange={() => toggleAmenity(a)} className="hidden" />
                  <span className={`w-3.5 h-3.5 rounded border-2 flex-shrink-0 flex items-center justify-center ${selectedAmenities.includes(a) ? "border-purple-500 bg-purple-500" : "border-gray-300"}`}>
                    {selectedAmenities.includes(a) && (
                      <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                        <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                  {a}
                </label>
              ))}
            </div>
          </div>

          {/* House Rules */}
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
            <p className="text-sm font-semibold text-gray-700 mb-3">House Rules</p>
            <input type="text" value={rules.entryExit} onChange={(e) => setRules((p) => ({ ...p, entryExit: e.target.value }))}
              placeholder="Entry / Exit timing e.g. 6 AM – 10 PM"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 mb-3 bg-white" />
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "visitorsAllowed", label: "Visitors Allowed" },
                { key: "cookingAllowed", label: "Cooking Allowed" },
                { key: "smokingAllowed", label: "Smoking Allowed" },
                { key: "petsAllowed", label: "Pets Allowed" }
              ].map((item) => (
                <div key={item.key}>
                  <p className="text-xs text-gray-500 mb-1.5">{item.label}</p>
                  <div className="flex gap-2">
                    {["Yes", "No"].map((val) => (
                      <button key={val} type="button" onClick={() => toggleRule(item.key, val)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border-2 transition ${rules[item.key] === val ? val === "Yes" ? "border-green-500 bg-green-50 text-green-700" : "border-red-400 bg-red-50 text-red-600" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Image Upload max 15 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-700">Property Images <span className="text-red-500">*</span></label>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${images.length >= 15 ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-500"}`}>{images.length}/15</span>
            </div>
            {images.length < 15 && (
              <div className="border-2 border-dashed border-purple-200 rounded-xl p-5 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition mb-3" onClick={() => fileInputRef.current?.click()}>
                <div className="text-3xl mb-1.5">📷</div>
                <p className="text-sm text-gray-500 font-medium">Click to upload images</p>
                <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP • Max 15 photos</p>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleImageUpload(e.target.files)} />
              </div>
            )}
            {images.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {images.map((src, idx) => (
                  <div key={idx} className="relative group aspect-square">
                    <img src={src} alt={`img-${idx + 1}`} className="w-full h-full object-cover rounded-xl border border-gray-200" />
                    <button type="button" onClick={() => removeImage(idx)} className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow">✕</button>
                    <span className="absolute bottom-1 left-1 bg-black/50 text-white text-[9px] rounded px-1 font-mono">{idx + 1}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info note — owner autofilled hidden */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
            ℹ️ Owner details are auto-filled from the visit report and will be sent to Superadmin.
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">⚠️ {error}</div>}

          <button type="submit" disabled={submitting}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-2 text-sm">
            {submitting ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block"></span>Submitting to Superadmin...</>
            ) : "Submit for Superadmin Approval →"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUCCESS MODAL — shows credentials (Login ID + Password only, no checkin link)
// ══════════════════════════════════════════════════════════════════════════════
function PropertySuccessModal({ enquiry, onClose }) {
  const { pendingCredentials, propertyName, ownerName } = enquiry;
  return (
    <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M5 13L9 17L19 7" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-1">Property Submitted!</h3>
        <p className="text-sm text-gray-500 mb-5">
          <strong>{propertyName}</strong> is in Superadmin enquiry panel under <strong>{ownerName || "owner"}</strong>.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-left">
          <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-3">🔐 Owner Credentials — After Approval Only</p>
          <div className="space-y-2">
            <div className="flex justify-between items-center bg-white rounded-lg px-3 py-2 border border-amber-100">
              <span className="text-xs text-gray-500">Login ID</span>
              <span className="font-mono font-bold text-gray-800 text-sm">{pendingCredentials.loginId}</span>
            </div>
            <div className="flex justify-between items-center bg-white rounded-lg px-3 py-2 border border-amber-100">
              <span className="text-xs text-gray-500">Password</span>
              <span className="font-mono font-bold text-gray-800 text-sm">{pendingCredentials.password}</span>
            </div>
          </div>
          <p className="text-[11px] text-amber-600 mt-3 leading-relaxed">
            ✅ Only Login ID &amp; Password will be sent — no digital check-in link.
          </p>
        </div>
        <button onClick={onClose} className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-700 transition">Done</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN VISIT COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function Visit() {
  useHtmlPage({
    title: "Roomhy - Visit Reports",
    bodyClass: "text-slate-800",
    htmlAttrs: { lang: "en" },
    metas: [{ charset: "UTF-8" }, { name: "viewport", content: "width=device-width, initial-scale=1.0" }],
    links: [
      { rel: "stylesheet", href: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" },
      { rel: "stylesheet", href: "/superadmin/assets/css/visit.css" }
    ],
    scripts: [
      { src: "https://cdn.tailwindcss.com" },
      { src: "https://unpkg.com/lucide@latest" },
      { src: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js" }
    ],
    inlineScripts: []
  });

  const [user, setUser] = useState(null);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [geo, setGeo] = useState({ lat: "", lng: "" });
  const [fieldPhotos, setFieldPhotos] = useState([]);
  const [profPhotos, setProfPhotos] = useState([]);
  const [visitId, setVisitId] = useState("");
  const [visitDateDisplay, setVisitDateDisplay] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [locationCode, setLocationCode] = useState("");
  const [visitorsAllowed, setVisitorsAllowed] = useState("Yes");
  const [cookingAllowed, setCookingAllowed] = useState("Yes");
  const [smokingAllowed, setSmokingAllowed] = useState("No");
  const [petsAllowed, setPetsAllowed] = useState("No");
  const [cleanlinessRating, setCleanlinessRating] = useState("");
  const [ownerBehaviourPublic, setOwnerBehaviourPublic] = useState("");
  const [studentReviewsRating, setStudentReviewsRating] = useState("");
  const [employeeRating, setEmployeeRating] = useState("");
  const [captureGroups, setCaptureGroups] = useState({ photo_building: [], photo_room: [], photo_bathroom: [], photo_bed: [], photo_extra: [] });
  const [showProfModal, setShowProfModal] = useState(false);
  const [profPreview, setProfPreview] = useState([]);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraView, setCameraView] = useState("capture");
  const [cameraKey, setCameraKey] = useState("");
  const [cameraFacing, setCameraFacing] = useState("environment");
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraLocation, setCameraLocation] = useState("");
  const [previewLocation, setPreviewLocation] = useState("");
  const [capturedPreview, setCapturedPreview] = useState("");
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState("");
  const [resolvedAreaName, setResolvedAreaName] = useState("");
  const [resolvedCityName, setResolvedCityName] = useState("");
  const [editingVisit, setEditingVisit] = useState(null);
  const [modalAreaName, setModalAreaName] = useState("");
  const [modalCityName, setModalCityName] = useState("");
  const [currentStep, setCurrentStep] = useState(1);
  const [stepError, setStepError] = useState("");
  const [isSubmittingVisit, setIsSubmittingVisit] = useState(false);
  const [customAmenityInput, setCustomAmenityInput] = useState("");
  const [customAmenities, setCustomAmenities] = useState([]);
  const cameraStreamRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const visitFormRef = useRef(null);

  // ── Add Property states ──────────────────────────────────────────────────────
  const [addPropVisit, setAddPropVisit] = useState(null);
  const [showAddProp, setShowAddProp] = useState(false);
  const [addedVisitIds, setAddedVisitIds] = useState(() => {
    try {
      const list = JSON.parse(localStorage.getItem("roomhy_property_enquiries") || "[]");
      return new Set(list.map((e) => e.visitId).filter(Boolean));
    } catch (_) { return new Set(); }
  });

  const staffName = user?.name || user?.staffName || user?.fullName || "Manager";
  const staffId = user?.loginId || user?.staffId || user?.id || user?._id || "";
  const areaName = modalAreaName || resolvedAreaName;

  const loadVisits = async () => {
    try {
      setErrorMsg("");
      const query = staffId || staffName ? `?staffId=${encodeURIComponent(staffId)}&staffName=${encodeURIComponent(staffName)}` : "";
      const data = await fetchJson(`/api/visits${query}`);
      const list = (data?.visits || data || []).map(normalizeVisit).filter((v) => visitBelongsToEmployee(v, user || { loginId: staffId, name: staffName }));
      setVisits(list);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      setErrorMsg(err?.body || err?.message || "Failed to load visits");
    }
  };

  useEffect(() => { setUser(readStoredUser()); }, []);

  useEffect(() => {
    let active = true;
    const resolveAssignedLocation = async () => {
      const directArea = pickFirstText(user?.areaName, user?.location, user?.area, user?.assignedArea, user?.locationName, user?.team, user?.city);
      const directCity = pickFirstText(user?.city, user?.cityName, user?.assignedCity);
      if (directArea || directCity) {
        if (!active) return;
        setResolvedAreaName(directArea); setResolvedCityName(directCity);
        setModalAreaName((c) => c || directArea); setModalCityName((c) => c || directCity);
        return;
      }
      const areaCode = pickFirstText(user?.areaCode, user?.locationCode);
      if (!areaCode) { if (!active) return; setResolvedAreaName(""); setResolvedCityName(""); return; }
      try {
        const data = await fetchJson("/api/locations/areas");
        const areas = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
        const matchedArea = areas.find((area) => {
          const code = pickFirstText(area?.code, area?.areaCode, area?.locationCode, area?.pincode);
          return code && code.toLowerCase() === areaCode.toLowerCase();
        });
        if (!active) return;
        setResolvedAreaName(pickFirstText(matchedArea?.name, matchedArea?.areaName, directArea));
        setResolvedCityName(pickFirstText(matchedArea?.cityName, matchedArea?.city?.name, typeof matchedArea?.city === "string" ? matchedArea.city : "", directCity));
      } catch (_) { if (!active) return; setResolvedAreaName(directArea); setResolvedCityName(directCity); }
    };
    resolveAssignedLocation();
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadVisits();
    const interval = setInterval(loadVisits, 15000);
    return () => clearInterval(interval);
  }, [staffId, staffName, user]);

  useEffect(() => {
    if (window?.lucide) window.lucide.createIcons();
  }, [showModal, showProfModal, showCamera, visits, captureGroups, profPhotos, showAddProp]);

  const generatePropertyId = () => setPropertyId(`PROP${Date.now()}`);

  const resetModalDefaults = () => {
    const now = new Date();
    setVisitId(`v_${Date.now()}`); setVisitDateDisplay(now.toLocaleString()); generatePropertyId();
    setVisitorsAllowed("Yes"); setCookingAllowed("Yes"); setSmokingAllowed("No"); setPetsAllowed("No");
    setCleanlinessRating(""); setOwnerBehaviourPublic(""); setStudentReviewsRating(""); setEmployeeRating("");
    setCaptureGroups({ photo_building: [], photo_room: [], photo_bathroom: [], photo_bed: [], photo_extra: [] });
    setFieldPhotos([]); setProfPhotos([]); setProfPreview([]);
    setLocationCode(user?.areaCode || user?.locationCode || "");
    setEditingVisit(null); setModalAreaName(resolvedAreaName || ""); setModalCityName(resolvedCityName || "");
    setCurrentStep(1); setStepError("");
    setCustomAmenityInput(""); setCustomAmenities([]);
  };

  const openModal = () => {
    resetModalDefaults(); setShowModal(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setGeo({ lat: "", lng: "" }),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    }
  };

  const closeModal = () => setShowModal(false);

  const openEditModal = (visit) => {
    const record = normalizeVisit(visit);
    setEditingVisit(record); setVisitId(record.visitId || record._id || "");
    setVisitDateDisplay(record.visitDateDisplay || (record.submittedAt ? new Date(record.submittedAt).toLocaleString() : new Date().toLocaleString()));
    setPropertyId(record.propertyId || ""); setLocationCode(record.locationCode || user?.areaCode || user?.locationCode || "");
    setVisitorsAllowed(record.visitorsAllowed === false ? "No" : "Yes");
    setCookingAllowed(record.cookingAllowed === false ? "No" : "Yes");
    setSmokingAllowed(record.smokingAllowed === true ? "Yes" : "No");
    setPetsAllowed(record.petsAllowed === true ? "Yes" : "No");
    setCleanlinessRating(String(record.cleanlinessRating || "")); setOwnerBehaviourPublic(record.ownerBehaviourPublic || "");
    setStudentReviewsRating(String(record.studentReviewsRating || "")); setEmployeeRating(String(record.employeeRating || ""));
    setCaptureGroups({ photo_building: [], photo_room: [], photo_bathroom: [], photo_bed: [], photo_extra: [] });
    setFieldPhotos(Array.isArray(record.photos) ? record.photos : []);
    setProfPhotos(Array.isArray(record.professionalPhotos) ? record.professionalPhotos : []);
    setProfPreview(Array.isArray(record.professionalPhotos) ? record.professionalPhotos : []);
    setGeo({ lat: record.latitude || "", lng: record.longitude || "" });
    setModalAreaName(record.area || record.areaLocality || record.propertyInfo?.area || resolvedAreaName || "");
    setModalCityName(record.city || record.propertyInfo?.city || resolvedCityName || "");
    setCurrentStep(1); setStepError("");
    const baseAmenities = ["Wi-Fi","Drinking water","Food","Power backup","Washing machine","Parking","CCTV"];
    const existing = Array.isArray(record.amenities) ? record.amenities : [];
    const extras = existing.filter((a) => a && !baseAmenities.includes(a));
    setCustomAmenities(extras);
    setCustomAmenityInput("");
    setShowModal(true);
  };

  const deleteVisit = async (visit) => {
    const targetId = visit?.visitId || visit?._id;
    if (!targetId || !window.confirm("Delete this visit report?")) return;
    const prevVisits = visits;
    setVisits((prev) => prev.filter((v) => (v.visitId || v._id) !== targetId));
    try {
      await fetchJson(`/api/visits/${encodeURIComponent(targetId)}`, { method: "DELETE" });
    } catch (err) {
      setVisits(prevVisits);
      window.alert(err?.body || err?.message || "Failed to delete visit");
    }
  };

  const setToggleValue = (field, value) => {
    if (field === "visitorsAllowed") setVisitorsAllowed(value);
    if (field === "cookingAllowed") setCookingAllowed(value);
    if (field === "smokingAllowed") setSmokingAllowed(value);
    if (field === "petsAllowed") setPetsAllowed(value);
  };

  const handleStarClick = (value, field) => {
    if (field === "cleanlinessRating") setCleanlinessRating(String(value));
    if (field === "studentReviewsRating") setStudentReviewsRating(String(value));
    if (field === "employeeRating") setEmployeeRating(String(value));
  };

  const setOwnerBehaviour = (value) => setOwnerBehaviourPublic(value);

  const renderStars = (value, field) => (
    <div className="flex gap-1 text-2xl cursor-pointer">
      {[1,2,3,4,5].map((n) => (
        <span key={`${field}-${n}`} className={`star ${Number(value) >= n ? "text-yellow-400" : "text-gray-300"}`} onClick={() => handleStarClick(n, field)}>
          {Number(value) >= n ? "★" : "☆"}
        </span>
      ))}
    </div>
  );

  const stopCameraStream = () => { if (cameraStreamRef.current) { cameraStreamRef.current.getTracks().forEach((t) => t.stop()); cameraStreamRef.current = null; } };
  useEffect(() => () => stopCameraStream(), []);

  const startCamera = async (facing = cameraFacing) => {
    try { setCameraError(""); setCameraLoading(true); stopCameraStream();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } });
      cameraStreamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraLoading(false);
    } catch (_) { setCameraLoading(false); setCameraError("Camera access denied or unavailable."); }
  };

  const openCamera = async (key) => {
    setCameraKey(key); setCapturedPreview(""); setCameraView("capture"); setShowCamera(true);
    setCameraLoading(true); setCameraError(""); setCameraLocation(""); setPreviewLocation("");
    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => { const loc = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`; setCameraLocation(loc); setPreviewLocation(loc); },
          () => { setCameraLocation("Location unavailable"); setPreviewLocation("Location unavailable"); },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
      }
    } catch (_) {}
    await startCamera(cameraFacing);
  };

  const closeCamera = () => { stopCameraStream(); setShowCamera(false); setCameraView("capture"); setCameraKey(""); setCapturedPreview(""); };
  const toggleCamera = async () => { const next = cameraFacing === "environment" ? "user" : "environment"; setCameraFacing(next); await startCamera(next); };
  const capturePhoto = () => {
    const video = videoRef.current; const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 1280; canvas.height = video.videoHeight || 720;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    setCapturedPreview(canvas.toDataURL("image/jpeg", 0.9)); setCameraView("preview");
  };
  const recapturePhoto = () => { setCapturedPreview(""); setCameraView("capture"); };
  const deleteCapture = () => { setCapturedPreview(""); closeCamera(); };
  const confirmCapture = async () => {
    if (!capturedPreview || !cameraKey) return;
    const maxCount = cameraKey === "photo_extra" ? 11 : 5;
    const existing = captureGroups[cameraKey] || [];
    if (existing.length >= maxCount) { alert(`Maximum ${maxCount} photos allowed.`); return; }
    const stamped = await watermarkDataUrl(capturedPreview, areaName, visitDateDisplay || new Date().toLocaleDateString());
    setCaptureGroups((prev) => ({ ...prev, [cameraKey]: [...existing, stamped] }));
    closeCamera();
  };

  const openProfModal = () => { setShowProfModal(true); setProfPreview(profPhotos.slice()); };
  const closeProfModal = () => { setShowProfModal(false); setProfPreview([]); };
  const handleProfInput = async (files) => {
    if (!files || files.length === 0) return;
    const existing = profPreview.slice();
    const remaining = 10 - existing.length;
    const toRead = Array.from(files).slice(0, remaining);
    const list = [];
    for (const file of toRead) list.push(await toDataUrl(file));
    setProfPreview([...existing, ...list]);
  };
  const removeProfPhoto = (index) => setProfPreview((prev) => prev.filter((_, i) => i !== index));
  const saveProfPhotos = () => { setProfPhotos(profPreview.slice()); setShowProfModal(false); };
  const handleGalleryInput = async (files) => {
    if (!files || files.length === 0) return;
    const existing = profPhotos.slice();
    const remaining = Math.max(0, 20 - existing.length);
    const toRead = Array.from(files).slice(0, remaining);
    const list = [];
    for (const file of toRead) list.push(await toDataUrl(file));
    setProfPhotos([...existing, ...list]);
  };
  const removeGalleryPhoto = (index) => setProfPhotos((prev) => prev.filter((_, i) => i !== index));
  const removeCapturedPhoto = (key, index) => {
    setCaptureGroups((prev) => ({ ...prev, [key]: (prev[key] || []).filter((_, i) => i !== index) }));
  };
  const addCustomAmenity = () => {
    const value = customAmenityInput.trim();
    if (!value) return;
    const exists = ["Wi-Fi","Drinking water","Food","Power backup","Washing machine","Parking","CCTV", ...customAmenities]
      .some((a) => a.toLowerCase() === value.toLowerCase());
    if (exists) {
      setCustomAmenityInput("");
      return;
    }
    setCustomAmenities((prev) => [...prev, value]);
    setCustomAmenityInput("");
  };
  const removeCustomAmenity = (amenity) => {
    setCustomAmenities((prev) => prev.filter((a) => a !== amenity));
  };
  const validateStep = (step) => {
    const form = visitFormRef.current;
    if (!form) return true;
    const value = (name) => String(form.elements[name]?.value || "").trim();
    if (step === 2) {
      const requiredFields = ["name", "address", "ownerName", "contactPhone", "ownerEmail"];
      const missing = requiredFields.find((field) => !value(field));
      if (missing) { setStepError("Please fill all required property fields before continuing."); return false; }
    }
    if (step === 3 && profPhotos.length < 1) {
      setStepError("Please upload at least 1 gallery image to continue.");
      return false;
    }
    if (step === 4) {
      const requiredGroups = ["photo_building", "photo_room", "photo_bathroom", "photo_bed"];
      const missingGroup = requiredGroups.find((key) => (captureGroups[key] || []).length < 1);
      if (missingGroup) {
        setStepError("Please capture at least 1 image in each required live capture section.");
        return false;
      }
    }
    setStepError("");
    return true;
  };
  const nextStep = () => {
    if (!validateStep(currentStep)) return;
    setCurrentStep((prev) => Math.min(5, prev + 1));
  };
  const prevStep = () => { setStepError(""); setCurrentStep((prev) => Math.max(1, prev - 1)); };
  const handleWizardKeyDown = (e) => {
    if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
    }
  };

  const buildVisitPayload = (fd, overrideVisitId = "") => {
    const visitIdValue = overrideVisitId || fd.get("visitId") || visitId || `v_${Date.now()}`;
    const visitDate = new Date().toLocaleString();
    const capturedPhotos = Object.values(captureGroups || {}).flat();
    return {
      _id: visitIdValue, visitId: visitIdValue, submittedAt: new Date().toISOString(),
      staffName, staffId, propertyName: fd.get("name"), propertyType: fd.get("propertyType"),
      propertyId: fd.get("propertyId"), verifiedByCompany: fd.get("verifiedByCompany") || "true",
      locationCode: fd.get("locationCode") || locationCode, address: fd.get("address"),
      area: fd.get("area"), areaLocality: fd.get("areaLocality"), city: fd.get("city"),
      landmark: fd.get("landmark"), nearbyLocation: fd.get("nearbyLocation"),
      ownerName: fd.get("ownerName"), ownerEmail: fd.get("ownerEmail"), contactPhone: fd.get("contactPhone"),
      gender: fd.get("gender"),
      monthlyRent: Number(fd.get("monthlyRent") || 0), deposit: Number(fd.get("deposit") || 0),
      vacantRooms: Number(fd.get("vacantRooms") || 0),
      vacantBeds: Number(fd.get("vacantBeds") || 0),
      occupiedRooms: Number(fd.get("occupiedRooms") || 0),
      occupiedBeds: Number(fd.get("occupiedBeds") || 0),
      electricityCharges: Number(fd.get("electricityCharges") || 0),
      foodCharges: Number(fd.get("foodCharges") || 0), maintenanceCharges: Number(fd.get("maintenanceCharges") || 0),
      minStay: Number(fd.get("minStay") || 0), entryExit: fd.get("entryExit"), amenities: fd.getAll("amenities"),
      cleanlinessRating: Number(fd.get("cleanlinessRating") || cleanlinessRating || 0),
      ownerBehaviourPublic: fd.get("ownerBehaviourPublic") || ownerBehaviourPublic,
      studentReviewsRating: Number(fd.get("studentReviewsRating") || studentReviewsRating || 0),
      employeeRating: Number(fd.get("employeeRating") || employeeRating || 0),
      visitorsAllowed: fd.get("visitorsAllowed") || visitorsAllowed,
      cookingAllowed: fd.get("cookingAllowed") || cookingAllowed,
      smokingAllowed: fd.get("smokingAllowed") || smokingAllowed,
      petsAllowed: fd.get("petsAllowed") || petsAllowed,
      internalRemarks: fd.get("internalRemarks"), studentReviews: fd.get("studentReviews"),
      cleanlinessNote: fd.get("cleanlinessNote"), ownerBehaviour: fd.get("ownerBehaviour"),
      latitude: geo.lat || fd.get("latitude"), longitude: geo.lng || fd.get("longitude"),
      photos: capturedPhotos.length ? capturedPhotos : fieldPhotos,
      professionalPhotos: profPhotos, status: "submitted", visitDateDisplay: visitDate,
      bankAccountHolderName: fd.get("bankAccountHolderName") || "",
      bankAccountNumber: fd.get("bankAccountNumber") || "",
      bankIfscCode: fd.get("bankIfscCode") || "",
      bankName: fd.get("bankName") || "",
      bankBranchName: fd.get("bankBranchName") || "",
      bankUpiId: fd.get("bankUpiId") || ""
    };
  };

  const submitVisit = async () => {
    if (currentStep !== 5) {
      setStepError("Please complete all steps and submit only from Step 5 (Review & Submit).");
      setCurrentStep(5);
      return;
    }
    if (isSubmittingVisit) return;
    const formEl = visitFormRef.current;
    if (!formEl) return;
    setStepError("");
    setIsSubmittingVisit(true);
    const fd = new FormData(formEl);
    let payload = buildVisitPayload(fd);
    try {
      if (editingVisit?.visitId || editingVisit?._id) {
        await fetchJson(`/api/visits/${encodeURIComponent(editingVisit.visitId || editingVisit._id)}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        try {
          await fetchJson("/api/visits", { method: "POST", body: JSON.stringify(payload) });
        } catch (err) {
          const msg = String(err?.body || err?.message || "");
          if (msg.includes("E11000") || msg.toLowerCase().includes("duplicate key")) {
            const retryVisitId = `v_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
            setVisitId(retryVisitId);
            payload = buildVisitPayload(fd, retryVisitId);
            await fetchJson("/api/visits", { method: "POST", body: JSON.stringify(payload) });
          } else {
            throw err;
          }
        }
      }
      setShowModal(false); setEditingVisit(null); await loadVisits();
      setSubmitSuccessMsg(editingVisit ? "Visit report updated successfully." : "Visit report submitted successfully.");
    } catch (err) { window.alert(err?.body || err?.message || `Failed to ${editingVisit ? "update" : "submit"} visit`); }
    finally { setIsSubmittingVisit(false); }
  };

  const viewMap = (visit) => {
    if (!visit?.latitude || !visit?.longitude) { window.alert("No geo coordinates available."); return; }
    window.open(`https://www.google.com/maps?q=${visit.latitude},${visit.longitude}`, "_blank");
  };

  // ── Add Property ─────────────────────────────────────────────────────────────
  const openAddProperty = (visit) => { setAddPropVisit(visit); setShowAddProp(true); };
  const handleAddPropSuccess = (enquiry) => {
    setShowAddProp(false); setAddPropVisit(null);
    setAddedVisitIds((prev) => new Set([...prev, enquiry.visitId]));
    window.location.href = `/employee/enquiry?tab=owners&enquiryId=${encodeURIComponent(enquiry.enquiryId || "")}`;
  };

  const rows = useMemo(() => visits, [visits]);

  return (
    <div className="html-page">
      <div className="flex h-screen overflow-hidden">
        <aside className="sidebar w-72 flex-shrink-0 hidden md:flex flex-col z-20 overflow-y-auto custom-scrollbar">
          <div className="h-16 flex items-center px-6 border-b border-gray-800 sticky top-0 bg-[#111827] z-10">
            <div><img src="/website/images/whitelogo.jpeg" alt="Roomhy Logo" className="h-16 w-auto" /><span className="text-[10px] text-gray-500">AREA ADMIN</span></div>
          </div>
          <nav id="dynamicSidebarNav" className="flex-1 py-6 space-y-1"></nav>
        </aside>

        <div className="flex-1 flex flex-col overflow-hidden bg-[#f3f4f6]">
          <header className="bg-white h-16 flex items-center justify-between px-6 shadow-sm z-10">
            <div className="flex items-center text-sm">
              <span className="text-slate-500 font-medium">Management</span>
              <i data-lucide="chevron-right" className="w-4 h-4 mx-2 text-slate-400"></i>
              <span className="text-slate-800 font-semibold">Visit Reports</span>
            </div>
            <div className="flex items-center gap-4">
              <button className="text-slate-400 hover:text-slate-600"><i data-lucide="bell" className="w-5 h-5"></i></button>
              <div className="relative group">
                <button className="flex items-center gap-3 hover:bg-gray-50 p-1.5 rounded-full transition-colors">
                  <img src="https://i.pravatar.cc/150?u=areaadmin" alt="Admin" className="w-8 h-8 rounded-full border border-slate-200" />
                  <div className="text-left hidden sm:block">
                    <p className="text-xs font-semibold text-gray-700">{staffName || "Manager"}</p>
                    <p className="text-[10px] text-gray-500">Area Manager</p>
                  </div>
                  <i data-lucide="chevron-down" className="w-3 h-3 text-gray-400 hidden sm:block"></i>
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-8">
            <div className="max-w-[1600px] mx-auto">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-slate-800">Visit Reports</h1>
                  <p className="text-sm text-slate-500">Submit new property visits for Super Admin approval.</p>
                </div>
                <button onClick={openModal} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition">
                  <i data-lucide="plus" className="w-4 h-4"></i> Add Property Visit
                </button>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse excel-table">
                    <thead>
                      <tr>
                        <th>Visit ID</th><th>Visit Date & Time</th><th>Staff Name</th><th>Staff ID</th>
                        <th>Property Name</th><th>Property Type</th><th>Full Address</th><th>Area / Locality</th>
                        <th>Nearby Location</th><th>Landmark</th><th>Owner Name</th><th>Owner Contact</th>
                        <th>Owner Gmail</th><th>Gender</th><th>Vacant Rooms</th><th>Vacant Beds</th><th>Occupied Rooms</th><th>Occupied Beds</th><th>Student Reviews</th><th>Employee Rating</th>
                        <th>Amenities</th><th>Cleanliness</th><th>Owner Behaviour</th><th>Photo Count</th>
                        <th>Professional Photo</th><th>Geo Status</th><th>Map</th><th>Status</th>
                        <th>Add Property</th>{/* ← NEW COLUMN */}
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading && <tr><td colSpan={28} className="text-center py-8 text-gray-500">Loading...</td></tr>}
                      {!loading && errorMsg && <tr><td colSpan={28} className="text-center py-8 text-red-500">{errorMsg}</td></tr>}
                      {!loading && !errorMsg && rows.length === 0 && <tr><td colSpan={28} className="text-center py-8 text-gray-500">No visits found. Add one to start.</td></tr>}
                      {rows.map((visit) => {
                        const prop = visit.propertyInfo || {};
                        const photos = visit.photos || [];
                        const prof = visit.professionalPhotos || [];
                        const visitDateTime = new Date(visit.submittedAt || Date.now()).toLocaleString();
                        const statusText = visit.status || "submitted";
                        const visitRowId = visit.visitId || visit._id;
                        const alreadyAdded = addedVisitIds.has(visitRowId);
                        return (
                          <tr key={visit._id}>
                            <td className="text-xs font-mono">{visit._id}</td>
                            <td className="text-sm text-gray-600">{visitDateTime}</td>
                            <td className="text-sm text-gray-600">{visit.submittedBy || visit.staffName || "-"}</td>
                            <td className="text-sm text-gray-600">{visit.submittedById || visit.staffId || "-"}</td>
                            <td className="font-bold text-slate-700">{prop.name || visit.propertyName || "-"}</td>
                            <td className="text-sm text-gray-600">{prop.propertyType || visit.propertyType || "-"}</td>
                            <td className="text-sm text-gray-600">{visit.address || prop.address || "-"}</td>
                            <td className="text-sm text-gray-600">{prop.area || visit.area || "-"}</td>
                            <td className="text-sm text-gray-600">{visit.nearbyLocation || prop.nearbyLocation || "-"}</td>
                            <td className="text-sm text-gray-600">{visit.landmark || prop.landmark || "-"}</td>
                            <td className="text-sm text-gray-600">{prop.ownerName || visit.ownerName || "-"}</td>
                            <td className="text-sm text-gray-600">{prop.contactPhone || visit.contactPhone || "-"}</td>
                            <td className="text-sm text-gray-600">{prop.ownerEmail || visit.ownerEmail || "-"}</td>
                            <td className="text-sm text-gray-600">{visit.gender || "-"}</td>
                            <td className="text-sm text-gray-600 text-center">{visit.vacantRooms ?? prop.vacantRooms ?? "-"}</td>
                            <td className="text-sm text-gray-600 text-center">{visit.vacantBeds ?? prop.vacantBeds ?? "-"}</td>
                            <td className="text-sm text-gray-600 text-center">{visit.occupiedRooms ?? prop.occupiedRooms ?? "-"}</td>
                            <td className="text-sm text-gray-600 text-center">{visit.occupiedBeds ?? prop.occupiedBeds ?? "-"}</td>
                            <td className="text-center"><span className="text-lg font-bold text-amber-600">{visit.studentReviewsRating ? `${"★".repeat(Math.floor(visit.studentReviewsRating))}${"☆".repeat(5 - Math.floor(visit.studentReviewsRating))}` : "-"}</span></td>
                            <td className="text-center"><span className="text-lg font-bold text-emerald-600">{visit.employeeRating ? `${"★".repeat(Math.floor(visit.employeeRating))}${"☆".repeat(5 - Math.floor(visit.employeeRating))}` : "-"}</span></td>
                            <td className="text-sm text-gray-600">{(visit.amenities || []).slice(0, 3).join(", ") || "-"}</td>
                            <td className="text-sm text-gray-600 text-center">{visit.cleanlinessRating || "-"}</td>
                            <td className="text-sm text-gray-600 text-center">{visit.ownerBehaviourPublic || "-"}</td>
                            <td className="text-center">{photos.length}</td>
                            <td className="text-center">
                              {prof.length > 0 ? (
                                <div className="inline-flex items-center gap-2">
                                  <img src={prof[0]} className="w-12 h-12 object-cover rounded-full border" alt="Professional" />
                                  <span className="text-xs text-gray-600">({prof.length})</span>
                                </div>
                              ) : <span className="text-gray-400">-</span>}
                            </td>
                            <td className="text-center">{visit.latitude && visit.longitude ? "Verified" : "Not Verified"}</td>
                            <td className="text-center"><button onClick={() => viewMap(visit)} className="text-slate-600 hover:bg-slate-50 p-1 rounded text-xs">View Map</button></td>
                            <td className="text-sm text-gray-600">{statusText}</td>

                            {/* ── ADD PROPERTY COLUMN ── */}
                            <td className="text-center">
                              {alreadyAdded ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1.5 rounded-lg whitespace-nowrap">
                                  ✓ Added
                                </span>
                              ) : (
                                <button
                                  onClick={() => openAddProperty(visit)}
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 px-3 py-1.5 rounded-lg transition shadow-sm whitespace-nowrap"
                                >
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                                  Add Property
                                </button>
                              )}
                            </td>

                            <td className="text-center">
                              <div className="inline-flex items-center gap-2">
                                <button onClick={() => openEditModal(visit)} className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded text-xs font-medium">Edit</button>
                                <button onClick={() => deleteVisit(visit)} className="text-red-600 hover:bg-red-50 px-2 py-1 rounded text-xs font-medium">Delete</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* ── Original Visit Form Modal (100% unchanged) ── */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 backdrop-blur-sm p-3 sm:p-4">
          <div className="bg-[#f8fafc] rounded-2xl w-full max-w-5xl shadow-2xl max-h-[95vh] overflow-y-auto border border-slate-200">
            <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200 rounded-t-2xl px-4 sm:px-6 py-4">
              <div className="flex justify-between items-start gap-3 mb-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{editingVisit ? "Edit Property Visit" : "New Property Visit"}</h3>
                  <p className="text-sm text-slate-500 mt-0.5">Fill all sections to complete and submit the visit report.</p>
                </div>
                <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"><i data-lucide="x" className="w-5 h-5"></i></button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {["Basic Details", "Property Details", "Gallery", "Live Capture", "Review & Submit"].map((step, idx) => (
                  <div key={step} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${currentStep === idx + 1 ? "bg-purple-600 text-white" : "bg-purple-100 text-purple-700"}`}>{idx + 1}</span>
                    <span className="text-xs font-semibold text-slate-700">{step}</span>
                  </div>
                ))}
              </div>
            </div>
            <form ref={visitFormRef} key={editingVisit?.visitId || editingVisit?._id || "new-visit"} className="space-y-5 p-4 sm:p-6" onSubmit={(e) => e.preventDefault()} onKeyDown={handleWizardKeyDown}>
              <input type="hidden" name="visitId" value={visitId} />
              <input type="hidden" name="latitude" value={geo.lat} /><input type="hidden" name="longitude" value={geo.lng} />
              <input type="hidden" name="verifiedByCompany" value="true" /><input type="hidden" name="locationCode" value={locationCode} />
              <input type="hidden" name="cleanlinessRating" value={cleanlinessRating} />
              <input type="hidden" name="ownerBehaviourPublic" value={ownerBehaviourPublic} />
              <input type="hidden" name="studentReviewsRating" value={studentReviewsRating} />
              <input type="hidden" name="employeeRating" value={employeeRating} />
              {stepError ? <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 text-sm">{stepError}</div> : null}

              <div className={currentStep === 1 ? "bg-white border border-slate-200 rounded-2xl p-4 sm:p-5" : "hidden"}>
                <h4 className="text-base font-semibold text-slate-900 mb-1">Basic Details</h4>
                <p className="text-xs text-slate-500 mb-4">Auto-generated visit details and property classification.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input type="text" readOnly className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-slate-100 cursor-not-allowed" value={visitDateDisplay} placeholder="Visit Date & Time" />
                  <input type="text" name="staffName" readOnly className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-slate-100 cursor-not-allowed" value={staffName} placeholder="Staff Name" />
                  <input type="text" name="staffId" readOnly className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-slate-100 cursor-not-allowed" value={staffId} placeholder="Staff ID" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <div className="relative">
                    <input name="propertyId" type="text" readOnly className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-slate-100 cursor-not-allowed pr-24" value={propertyId} placeholder="Auto-generated Property ID" />
                    <button type="button" onClick={generatePropertyId} className="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg text-xs border border-slate-300" disabled={!!editingVisit}>Regenerate</button>
                  </div>
                  <select name="propertyType" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white" defaultValue={editingVisit?.propertyType || "PG"}>
                    <option value="PG">PG</option><option value="Hostel">Hostel</option><option value="Room">Room</option><option value="Flat">Flat</option>
                  </select>
                </div>
              </div>

              <div className={currentStep === 2 ? "bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3" : "hidden"}>
                <h4 className="text-base font-semibold text-slate-900">Property Details</h4>
                <input name="name" type="text" required defaultValue={editingVisit?.propertyName || ""} className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="Property Name" />
                <textarea name="address" rows="2" required defaultValue={editingVisit?.address || ""} className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="Full Address (Street, Area, City, Pin Code)"></textarea>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input name="ownerName" type="text" required defaultValue={editingVisit?.ownerName || ""} className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="Owner Name" />
                  <input name="contactPhone" type="tel" required defaultValue={editingVisit?.contactPhone || editingVisit?.ownerPhone || ""} className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="Owner Contact" />
                  <input name="ownerEmail" type="email" required defaultValue={editingVisit?.ownerEmail || ""} className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="Owner Gmail" />
                </div>
                <select name="gender" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white" defaultValue={editingVisit?.gender || ""}>
                  <option value="">Select Gender Preference</option>
                  <option value="Male Only">Male Only</option><option value="Female Only">Female Only</option><option value="Co-Ed">Co-Ed</option>
                </select>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input name="areaLocality" type="text" readOnly className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-slate-100 cursor-not-allowed" placeholder="Area / Locality" value={areaName} />
                  <input type="hidden" name="area" value={areaName} /><input type="hidden" name="city" value={modalCityName || resolvedCityName} />
                  <input name="landmark" type="text" defaultValue={editingVisit?.landmark || ""} className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="Nearby Landmark" />
                  <input name="nearbyLocation" type="text" defaultValue={editingVisit?.nearbyLocation || ""} className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="Nearby Location" />
                </div>
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {["Wi-Fi","Drinking water","Food","Power backup","Washing machine","Parking","CCTV"].map((a) => (
                      <label key={a} className="inline-flex items-center text-xs font-medium text-slate-700"><input type="checkbox" name="amenities" value={a} className="mr-2 accent-purple-600" defaultChecked={Array.isArray(editingVisit?.amenities) ? editingVisit.amenities.includes(a) : false} />{a}</label>
                    ))}
                    {customAmenities.map((a) => (
                      <label key={a} className="inline-flex items-center text-xs font-medium text-slate-700 group">
                        <input type="checkbox" name="amenities" value={a} className="mr-2 accent-purple-600" defaultChecked />
                        {a}
                        <button type="button" onClick={() => removeCustomAmenity(a)} className="ml-2 text-[10px] text-red-600 opacity-70 group-hover:opacity-100">remove</button>
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customAmenityInput}
                      onChange={(e) => setCustomAmenityInput(e.target.value)}
                      placeholder="Add extra amenity (e.g. RO water, Gym)"
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
                    />
                    <button type="button" onClick={addCustomAmenity} className="px-3 py-2 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700">+ Add Amenity</button>
                  </div>
                </div>
              </div>

              <div className={currentStep === 2 ? "bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3" : "hidden"}>
                <h4 className="text-base font-semibold text-slate-900">Rooms, Occupancy & Charges</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <input name="monthlyRent" type="number" min="0" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="Monthly Rent" />
                  <input name="deposit" type="number" min="0" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="Deposit" />
                  <input name="vacantRooms" type="number" min="0" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="Vacant Rooms" />
                  <input name="vacantBeds" type="number" min="0" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="Beds in Vacant Rooms" />
                  <input name="occupiedRooms" type="number" min="0" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="Occupied Rooms" />
                  <input name="occupiedBeds" type="number" min="0" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="Beds in Occupied Rooms" />
                  <input name="electricityCharges" type="number" min="0" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="Electricity Charges" />
                  <input name="foodCharges" type="number" min="0" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="Food Charges" />
                  <input name="maintenanceCharges" type="number" min="0" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="Maintenance Charges" />
                  <input name="minStay" type="number" min="0" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white sm:col-span-2 lg:col-span-1" placeholder="Min Stay (months)" />
                </div>
              </div>

              <div className={currentStep === 2 ? "bg-white border border-slate-200 rounded-2xl p-4 sm:p-5" : "hidden"}>
                <div className="font-semibold mb-3 text-slate-900">House Rules</div>
                <input name="entryExit" type="text" className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm mb-3 bg-white" placeholder="Entry / Exit timing" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { id: "visitorsAllowed", label: "Visitors Allowed", value: visitorsAllowed },
                    { id: "cookingAllowed", label: "Cooking Allowed", value: cookingAllowed },
                    { id: "smokingAllowed", label: "Smoking Allowed", value: smokingAllowed },
                    { id: "petsAllowed", label: "Pets Allowed", value: petsAllowed }
                  ].map((item) => (
                    <div key={item.id} className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                      <label className="text-xs font-semibold text-slate-600 block mb-2">{item.label}</label>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setToggleValue(item.id, "Yes")} className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border ${item.value === "Yes" ? "border-purple-500 bg-purple-50 text-purple-700" : "border-slate-300 text-slate-600 bg-white"}`}>Yes</button>
                        <button type="button" onClick={() => setToggleValue(item.id, "No")} className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border ${item.value === "No" ? "border-purple-500 bg-purple-50 text-purple-700" : "border-slate-300 text-slate-600 bg-white"}`}>No</button>
                      </div>
                      <input type="hidden" name={item.id} value={item.value} />
                    </div>
                  ))}
                </div>
              </div>
              <input type="hidden" name="visitorsAllowed" value={visitorsAllowed} />
              <input type="hidden" name="cookingAllowed" value={cookingAllowed} />
              <input type="hidden" name="smokingAllowed" value={smokingAllowed} />
              <input type="hidden" name="petsAllowed" value={petsAllowed} />
              <input type="hidden" name="internalRemarks" value="" />
              <input type="hidden" name="studentReviews" value="" />
              <input type="hidden" name="cleanlinessNote" value="" />
              <input type="hidden" name="ownerBehaviour" value="" />

              <div className={currentStep === 2 ? "bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3" : "hidden"}>
                <h4 className="text-base font-semibold text-slate-900">Owner Bank Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input name="bankAccountHolderName" type="text" defaultValue={editingVisit?.bankAccountHolderName || ""} className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="Account Holder Name" />
                  <input name="bankAccountNumber" type="text" defaultValue={editingVisit?.bankAccountNumber || ""} className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="Bank Account Number" />
                  <input name="bankIfscCode" type="text" defaultValue={editingVisit?.bankIfscCode || ""} className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="IFSC Code" />
                  <input name="bankName" type="text" defaultValue={editingVisit?.bankName || ""} className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="Bank Name" />
                  <input name="bankBranchName" type="text" defaultValue={editingVisit?.bankBranchName || ""} className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="Branch Name" />
                  <input name="bankUpiId" type="text" defaultValue={editingVisit?.bankUpiId || ""} className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white" placeholder="UPI ID (optional)" />
                </div>
              </div>

              <div className={currentStep === 3 ? "bg-white border border-slate-200 rounded-2xl p-4 sm:p-5" : "hidden"}>
                <h4 className="text-base font-semibold text-slate-900 mb-2">Gallery Upload</h4>
                <p className="text-xs text-slate-500 mb-4">Upload property photos from gallery. Minimum 1 image required.</p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleGalleryInput(e.target.files)}
                  className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-purple-600 file:px-4 file:py-2 file:text-white hover:file:bg-purple-700"
                />
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {profPhotos.map((src, idx) => (
                    <div key={idx} className="relative group">
                      <img src={src} className="w-full h-24 object-cover rounded-lg border border-slate-200" alt="" />
                      <button type="button" onClick={() => removeGalleryPhoto(idx)} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600 text-white text-xs hidden group-hover:block">✕</button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-3">{profPhotos.length} gallery image(s) selected</p>
              </div>

              <div className={currentStep === 4 ? "p-4 border border-purple-200 rounded-2xl bg-purple-50" : "hidden"}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center justify-center w-6 h-6 bg-purple-600 text-white rounded-full text-xs font-bold">4</span>
                  <h3 className="font-bold text-purple-900">Live Capture Images (Required)</h3>
                </div>
                <p className="text-xs text-purple-700 mb-3">Capture photos per required section. You can remove or retake anytime.</p>
                {[{ key: "photo_building", label: "Building Front (required)" }, { key: "photo_room", label: "Room Interior (required)" }, { key: "photo_bathroom", label: "Bathroom (required)" }, { key: "photo_bed", label: "Bed / Interior (required)" }].map((item) => {
                  const imgs = captureGroups[item.key] || [];
                  const last = imgs[imgs.length - 1];
                  return (
                    <div key={item.key} className="block text-xs border border-purple-100 rounded-xl p-2.5 bg-white mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{item.label}</span>
                        <button type="button" onClick={() => openCamera(item.key)} className="text-xs px-2.5 py-1.5 bg-purple-100 text-purple-700 rounded-lg">Capture</button>
                      </div>
                      <div className="w-full h-28 bg-gray-100 rounded border flex items-center justify-center text-gray-400 mb-2 overflow-hidden">
                        {last ? <img src={last} className="w-full h-full object-cover" alt="" /> : "No photo"}
                      </div>
                      <div className="flex gap-1 overflow-x-auto">
                        {imgs.map((src, idx) => (
                          <div key={idx} className="relative group">
                            <img src={src} className="w-10 h-10 object-cover rounded border" alt="" />
                            <button type="button" onClick={() => removeCapturedPhoto(item.key, idx)} className="absolute -top-1 -right-1 text-[10px] w-4 h-4 rounded-full bg-red-600 text-white hidden group-hover:block">x</button>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{imgs.length}/5 captures</p>
                    </div>
                  );
                })}
                <div className="mt-3">
                  <label className="block text-xs mb-1 font-medium text-gray-700">Additional Live Photos (optional, max 11)</label>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => openCamera("photo_extra")} className="text-xs px-3 py-2 bg-white border border-purple-200 text-purple-700 rounded-lg hover:bg-purple-100">Capture Extra</button>
                    <div className="flex gap-2 overflow-x-auto">
                      {(captureGroups.photo_extra || []).map((src, idx) => (
                        <div key={idx} className="relative group">
                          <img src={src} className="w-16 h-16 object-cover rounded border" alt="" />
                          <button type="button" onClick={() => removeCapturedPhoto("photo_extra", idx)} className="absolute -top-1 -right-1 text-[10px] w-4 h-4 rounded-full bg-red-600 text-white hidden group-hover:block">x</button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">{(captureGroups.photo_extra || []).length} selected</p>
                </div>
              </div>

              <div className={currentStep === 5 ? "bg-white border border-slate-200 rounded-2xl p-4 sm:p-5" : "hidden"}>
                <h4 className="text-base font-semibold text-slate-900 mb-3">Final Review</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50"><span className="text-slate-500">Property Name</span><p className="font-semibold text-slate-800">{visitFormRef.current?.elements?.name?.value || "-"}</p></div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50"><span className="text-slate-500">Property Type</span><p className="font-semibold text-slate-800">{visitFormRef.current?.elements?.propertyType?.value || "-"}</p></div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50"><span className="text-slate-500">Owner</span><p className="font-semibold text-slate-800">{visitFormRef.current?.elements?.ownerName?.value || "-"}</p></div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50"><span className="text-slate-500">Contact</span><p className="font-semibold text-slate-800">{visitFormRef.current?.elements?.contactPhone?.value || "-"}</p></div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50"><span className="text-slate-500">Owner Email</span><p className="font-semibold text-slate-800">{visitFormRef.current?.elements?.ownerEmail?.value || "-"}</p></div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50"><span className="text-slate-500">Gender Preference</span><p className="font-semibold text-slate-800">{visitFormRef.current?.elements?.gender?.value || "-"}</p></div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 md:col-span-2"><span className="text-slate-500">Address</span><p className="font-semibold text-slate-800">{visitFormRef.current?.elements?.address?.value || "-"}</p></div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50"><span className="text-slate-500">Area</span><p className="font-semibold text-slate-800">{visitFormRef.current?.elements?.areaLocality?.value || "-"}</p></div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50"><span className="text-slate-500">Nearby Location</span><p className="font-semibold text-slate-800">{visitFormRef.current?.elements?.nearbyLocation?.value || "-"}</p></div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50"><span className="text-slate-500">Landmark</span><p className="font-semibold text-slate-800">{visitFormRef.current?.elements?.landmark?.value || "-"}</p></div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50"><span className="text-slate-500">Monthly Rent</span><p className="font-semibold text-slate-800">{visitFormRef.current?.elements?.monthlyRent?.value || "0"}</p></div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50"><span className="text-slate-500">Deposit</span><p className="font-semibold text-slate-800">{visitFormRef.current?.elements?.deposit?.value || "0"}</p></div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50"><span className="text-slate-500">Vacant Rooms</span><p className="font-semibold text-slate-800">{visitFormRef.current?.elements?.vacantRooms?.value || "0"}</p></div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50"><span className="text-slate-500">Vacant Beds</span><p className="font-semibold text-slate-800">{visitFormRef.current?.elements?.vacantBeds?.value || "0"}</p></div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50"><span className="text-slate-500">Occupied Rooms</span><p className="font-semibold text-slate-800">{visitFormRef.current?.elements?.occupiedRooms?.value || "0"}</p></div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50"><span className="text-slate-500">Occupied Beds</span><p className="font-semibold text-slate-800">{visitFormRef.current?.elements?.occupiedBeds?.value || "0"}</p></div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50"><span className="text-slate-500">Electricity Charges</span><p className="font-semibold text-slate-800">{visitFormRef.current?.elements?.electricityCharges?.value || "0"}</p></div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50"><span className="text-slate-500">Food Charges</span><p className="font-semibold text-slate-800">{visitFormRef.current?.elements?.foodCharges?.value || "0"}</p></div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50"><span className="text-slate-500">Maintenance</span><p className="font-semibold text-slate-800">{visitFormRef.current?.elements?.maintenanceCharges?.value || "0"}</p></div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50"><span className="text-slate-500">Min Stay (months)</span><p className="font-semibold text-slate-800">{visitFormRef.current?.elements?.minStay?.value || "0"}</p></div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 md:col-span-2"><span className="text-slate-500">Amenities</span><p className="font-semibold text-slate-800">{visitFormRef.current ? Array.from(visitFormRef.current.querySelectorAll('input[name="amenities"]:checked')).map((el) => el.value).join(", ") || "-" : "-"}</p></div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50"><span className="text-slate-500">Visitors Allowed</span><p className="font-semibold text-slate-800">{visitorsAllowed}</p></div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50"><span className="text-slate-500">Cooking Allowed</span><p className="font-semibold text-slate-800">{cookingAllowed}</p></div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50"><span className="text-slate-500">Smoking Allowed</span><p className="font-semibold text-slate-800">{smokingAllowed}</p></div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50"><span className="text-slate-500">Pets Allowed</span><p className="font-semibold text-slate-800">{petsAllowed}</p></div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50"><span className="text-slate-500">Gallery Images</span><p className="font-semibold text-slate-800">{profPhotos.length}</p></div>
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50"><span className="text-slate-500">Live Captures</span><p className="font-semibold text-slate-800">{Object.values(captureGroups || {}).flat().length}</p></div>
                </div>
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-600 mb-2">Gallery Preview</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {profPhotos.map((src, idx) => <img key={`g-${idx}`} src={src} className="w-full h-16 object-cover rounded border border-slate-200" alt="" />)}
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-600 mb-2">Live Capture Preview</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {Object.values(captureGroups || {}).flat().map((src, idx) => <img key={`l-${idx}`} src={src} className="w-full h-16 object-cover rounded border border-slate-200" alt="" />)}
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 bg-[#f8fafc]/95 backdrop-blur border-t border-slate-200 pt-3 -mx-4 sm:-mx-6 px-4 sm:px-6 pb-1">
                <div className="flex gap-2">
                  {currentStep > 1 ? (
                    <button type="button" onClick={prevStep} className="px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold">Previous</button>
                  ) : null}
                  {currentStep < 5 ? (
                    <button type="button" onClick={nextStep} className="flex-1 bg-purple-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-purple-700 shadow-sm">Next</button>
                  ) : (
                    <button type="button" disabled={isSubmittingVisit} onClick={submitVisit} className="flex-1 bg-purple-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-purple-700 shadow-sm disabled:opacity-60">{isSubmittingVisit ? "Submitting..." : (editingVisit ? "Update Report" : "Submit Report")}</button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {showProfModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[65]">
          <div className="bg-white rounded-lg w-full max-w-lg p-4 shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold">Upload Professional Photos (up to 10)</h3>
              <button onClick={closeProfModal} className="text-gray-600 px-2 py-1">Close</button>
            </div>
            <div className="space-y-3">
              <div className="w-full min-h-[88px] bg-gray-50 rounded border p-2 grid grid-cols-4 gap-2">
                {profPreview.length === 0 ? <div className="col-span-4 text-xs text-gray-400">No photos selected</div> : profPreview.map((src, i) => (
                  <div key={i} className="relative w-full h-24 overflow-hidden rounded">
                    <img src={src} className="w-full h-full object-cover rounded" alt="" />
                    <button type="button" onClick={() => removeProfPhoto(i)} className="absolute top-1 right-1 bg-white/80 text-red-600 rounded-full p-1 text-xs">✕</button>
                  </div>
                ))}
              </div>
              <input type="file" accept="image/*" multiple onChange={(e) => handleProfInput(e.target.files)} className="mx-auto block" />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={saveProfPhotos} className="px-3 py-2 bg-blue-600 text-white rounded">Save Photos</button>
                <button type="button" onClick={closeProfModal} className="px-3 py-2 bg-gray-100 rounded">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {submitSuccessMsg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[90] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center"><i data-lucide="check-circle-2" className="w-8 h-8 text-green-600"></i></div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Report Submitted</h3>
            <p className="text-sm text-gray-600 mb-5">{submitSuccessMsg}</p>
            <button type="button" onClick={() => setSubmitSuccessMsg("")} className="w-full py-2.5 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700">OK</button>
          </div>
        </div>
      )}

      {showCamera && (
        <div className="fixed inset-0 bg-black z-[80]">
          <div className="w-full h-full bg-black text-white flex flex-col">
            <div className={cameraView === "capture" ? "h-full flex flex-col p-4 sm:p-6" : "hidden"}>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-lg">Capture Photo</h3>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={toggleCamera} className="text-xs px-3 py-2 bg-white/20 rounded">Switch Camera</button>
                  <button type="button" onClick={closeCamera} className="text-xs px-3 py-2 bg-white/20 rounded">Close</button>
                </div>
              </div>
              <div className="flex-1 bg-black flex items-center justify-center overflow-hidden rounded mb-3 relative min-h-[300px]">
                <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }}></video>
                <canvas ref={canvasRef} style={{ display: "none" }}></canvas>
                {cameraLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-sm">
                    <div className="text-center"><p className="mb-2">Initializing camera...</p><div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-white rounded-full animate-spin"></div></div>
                  </div>
                )}
              </div>
              {cameraError ? <div className="text-sm text-red-300 mb-2">{cameraError}</div> : null}
              {cameraLocation ? <div className="text-xs text-gray-200 mb-3"><strong>Location:</strong> {cameraLocation}</div> : null}
              <div className="flex items-center justify-end"><button type="button" onClick={capturePhoto} className="px-5 py-3 bg-purple-600 text-white rounded">Capture</button></div>
            </div>
            <div className={cameraView === "preview" ? "h-full flex flex-col p-4 sm:p-6" : "hidden"}>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-lg">Photo Preview</h3>
                <button type="button" onClick={closeCamera} className="text-xs px-3 py-2 bg-white/20 rounded">Close</button>
              </div>
              <div className="flex-1 bg-black flex items-center justify-center overflow-hidden rounded mb-3 min-h-[300px]">
                {capturedPreview ? <img src={capturedPreview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
              </div>
              {previewLocation ? <div className="text-xs text-gray-200 mb-3"><strong>Location:</strong> {previewLocation}</div> : null}
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={deleteCapture} className="px-4 py-3 bg-red-600 text-white rounded">Delete</button>
                <button type="button" onClick={recapturePhoto} className="px-4 py-3 bg-gray-600 text-white rounded">Recapture</button>
                <button type="button" onClick={confirmCapture} className="px-4 py-3 bg-green-600 text-white rounded">Keep Photo</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Property Modal ── */}
      {showAddProp && addPropVisit && (
        <AddPropertyModal
          visit={addPropVisit}
          staffName={staffName}
          staffId={staffId}
          areaName={resolvedAreaName || areaName}
          onClose={() => { setShowAddProp(false); setAddPropVisit(null); }}
          onSuccess={handleAddPropSuccess}
        />
      )}

      {/* ── Success Modal ── */}
    </div>
  );
}
