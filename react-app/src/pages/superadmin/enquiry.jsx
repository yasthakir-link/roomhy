import React, { useEffect, useMemo, useRef, useState } from "react";
import { useHtmlPage } from "../../utils/htmlPage";

const getApiUrl = () =>
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5001"
    : "https://api.roomhy.com";

const navSections = [
  {
    label: "Overview",
    items: [{ href: "/superadmin/superadmin", icon: "layout-dashboard", text: "Dashboard", key: "superadmin" }]
  },
  {
    label: "Management",
    items: [
      { href: "/superadmin/manager", icon: "map-pin", text: "Teams", key: "manager" },
      { href: "/superadmin/owner", icon: "briefcase", text: "Property Owners", key: "owner" },
      { href: "/superadmin/properties", icon: "home", text: "Properties", key: "properties" },
      { href: "/superadmin/tenant", icon: "users", text: "Tenants", key: "tenant" },
      { href: "/superadmin/new_signups", icon: "file-badge", text: "New Signups", key: "new_signups" }
    ]
  },
  {
    label: "Operations",
    items: [
      { href: "/superadmin/websiteenq", icon: "folder-open", text: "Web Enquiry", key: "websiteenq" },
      { href: "/superadmin/enquiry", icon: "help-circle", text: "Enquiries", key: "enquiry" },
      { href: "/superadmin/booking", icon: "calendar-check", text: "Bookings", key: "booking" },
      { href: "/superadmin/reviews", icon: "star", text: "Reviews", key: "reviews" },
      { href: "/superadmin/complaint-history", icon: "alert-circle", text: "Complaint History", key: "complaint-history" },
      { href: "/superadmin/superchat", icon: "message-circle", text: "All Chats", key: "chat-analytics" }
    ]
  },
  {
    label: "Website",
    items: [{ href: "/superadmin/website", icon: "globe", text: "Live Properties", key: "website" }]
  }
];

const toStorageSafeVisit = (visit) => {
  if (!visit || typeof visit !== "object") return visit;

  const propertyInfo = visit.propertyInfo && typeof visit.propertyInfo === "object"
    ? {
        ...visit.propertyInfo,
        photos: [],
        professionalPhotos: [],
        imageBase64: "",
        image: "",
        photo_building: [],
        photo_room: [],
        photo_bathroom: [],
        photo_bed: [],
        photo_extra: []
      }
    : visit.propertyInfo;

  return {
    ...visit,
    photos: [],
    professionalPhotos: [],
    fieldPhotos: [],
    profPhotos: [],
    imageBase64: "",
    image: "",
    studentReviews: typeof visit.studentReviews === "string" ? visit.studentReviews.slice(0, 500) : visit.studentReviews,
    internalRemarks: typeof visit.internalRemarks === "string" ? visit.internalRemarks.slice(0, 500) : visit.internalRemarks,
    cleanlinessNote: typeof visit.cleanlinessNote === "string" ? visit.cleanlinessNote.slice(0, 500) : visit.cleanlinessNote,
    ownerBehaviour: typeof visit.ownerBehaviour === "string" ? visit.ownerBehaviour.slice(0, 500) : visit.ownerBehaviour,
    propertyInfo
  };
};

export default function SuperadminEnquiry() {
  useHtmlPage({
    title: "Roomhy - Admin Enquiry",
    bodyClass: "bg-gray-50 text-slate-800",
    htmlAttrs: { lang: "en" },
    metas: [
      { charset: "UTF-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" }
    ],
    bases: [],
    links: [
      {
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
        rel: "stylesheet"
      },
      { rel: "stylesheet", href: "/superadmin/assets/css/enquiry.css" }
    ],
    styles: [],
    scripts: [
      { src: "https://cdn.tailwindcss.com" },
      { src: "https://unpkg.com/lucide@latest" },
      { src: "https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js" }
    ],
    inlineScripts: []
  });

  const apiUrl = getApiUrl();
  const [visits, setVisits] = useState([]);
  const [propertyUnderOwner, setPropertyUnderOwner] = useState([]);
  const [activeTab, setActiveTab] = useState("visits");
  const [currentApprovingId, setCurrentApprovingId] = useState(null);
  const [showApprove, setShowApprove] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [generatedCreds, setGeneratedCreds] = useState({ loginId: "--", password: "--" });
  const [galleryImages, setGalleryImages] = useState([]);
  const [showGallery, setShowGallery] = useState(false);
  const [showVisitDetails, setShowVisitDetails] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [detailsOwnerFresh, setDetailsOwnerFresh] = useState(null);
  const [ownerByLogin, setOwnerByLogin] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotif, setShowNotif] = useState(false);
  const [actionModal, setActionModal] = useState({
    open: false,
    type: "hold",
    visitId: "",
    reason: "",
    action: "edit"
  });
  const [kycLinkSending, setKycLinkSending] = useState(null); // visitId being processed
  const pollRef = useRef(null);

  useEffect(() => {
    window.lucide?.createIcons();
  }, [visits, propertyUnderOwner, activeTab, showApprove, showSuccess, showGallery, showVisitDetails, notifications, showNotif, actionModal, kycLinkSending]);

  useEffect(() => {
    fetchEnquiries();
    fetchPropertyUnderOwner();
    startPolling();
    const interval = setInterval(fetchEnquiries, 15000);
    return () => {
      clearInterval(interval);
      stopPolling();
    };
  }, []);

  const startPolling = () => {
    stopPolling();
    pollRef.current = setInterval(fetchNotifications, 5000);
    fetchNotifications();
  };

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/notifications?unread=true&toLoginId=superadmin`);
      const payload = await res.json();
      const list = Array.isArray(payload) ? payload : (Array.isArray(payload.notifications) ? payload.notifications : []);
      setNotifications(list);
      setUnreadCount(list.length);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  const markAllRead = async () => {
    try {
      await fetch(`${apiUrl}/api/notifications/mark-all-read`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toLoginId: "superadmin", toRole: "superadmin" })
      });
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const clearAll = async () => {
    try {
      await fetch(`${apiUrl}/api/notifications/delete-read?toLoginId=superadmin`, { method: "DELETE" });
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error("Error clearing notifications:", error);
    }
  };

  const mergeVisitsByIdentity = (primary = [], secondary = []) => {
    const map = new Map();
    [...(primary || []), ...(secondary || [])].forEach((visit) => {
      if (!visit) return;
      const key = visit._id || visit.visitId;
      if (!key) return;
      map.set(key, { ...(map.get(key) || {}), ...visit });
    });
    return Array.from(map.values());
  };

  const persistLocalVisits = (list) => {
    const safeList = (Array.isArray(list) ? list : []).map(toStorageSafeVisit);
    const payload = JSON.stringify(safeList);

    try {
      localStorage.setItem("roomhy_visits", payload);
    } catch (error) {
      console.warn("Failed to persist roomhy_visits in localStorage:", error);
      try {
        localStorage.removeItem("roomhy_visits");
      } catch (_) {}
    }

    try {
      sessionStorage.setItem("roomhy_visits", payload);
    } catch (error) {
      console.warn("Failed to persist roomhy_visits in sessionStorage:", error);
      try {
        sessionStorage.removeItem("roomhy_visits");
      } catch (_) {}
    }
  };

  const loadLocalVisits = () => {
    let localList = [];
    let sessionList = [];
    try {
      localList = JSON.parse(localStorage.getItem("roomhy_visits") || "[]");
    } catch (_) {}
    try {
      sessionList = JSON.parse(sessionStorage.getItem("roomhy_visits") || "[]");
    } catch (_) {}
    return mergeVisitsByIdentity(localList, sessionList);
  };

  const fetchEnquiries = async () => {
    let list = [];
    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token") || "";
      const response = await fetch(`${apiUrl}/api/visits/pending`, {
        method: "GET",
        headers: token ? { Authorization: token } : {}
      });
      if (!response.ok) throw new Error("API error");
      const data = await response.json();
      const allVisits = data.visits || data || [];
      list = allVisits.filter((v) => ["submitted", "pending", "pending_review"].includes(v.status));
    } catch (_) {
      list = loadLocalVisits();
    }
    list = list.filter((v) => ["pending", "submitted"].includes(v.status));
    setVisits(list);
  };

  const fetchPropertyUnderOwner = async () => {
    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token") || "";
      const ownerResponse = await fetch(`${apiUrl}/api/owners`, {
        headers: token ? { Authorization: token } : {}
      });
      if (!ownerResponse.ok) throw new Error("Failed to load owners");

      const ownerPayload = await ownerResponse.json();
      const owners = Array.isArray(ownerPayload?.owners) ? ownerPayload.owners : [];
      const ownerMap = {};
      owners.forEach((owner) => {
        if (owner?.loginId) ownerMap[owner.loginId] = owner;
      });
      setOwnerByLogin(ownerMap);
      const rows = (
        await Promise.all(
          owners
            .filter((owner) => owner?.loginId)
            .map(async (owner) => {
              try {
                const propertyResponse = await fetch(`${apiUrl}/api/owners/${encodeURIComponent(owner.loginId)}/properties`, {
                  headers: token ? { Authorization: token } : {}
                });
                if (!propertyResponse.ok) return [];
                const propertyPayload = await propertyResponse.json();
                const properties = Array.isArray(propertyPayload?.properties) ? propertyPayload.properties : [];
                return properties.map((property) => ({
                  ownerLoginId: owner.loginId,
                  ownerName: owner.name || owner.profile?.name || property.ownerName || "-",
                  ownerEmail: owner.email || owner.profile?.email || property.ownerEmail || "-",
                  propertyId: property._id,
                  propertyTitle: property.title || "-",
                  propertyType: property.propertyType || "-",
                  address: property.address || "-",
                  area: property.area || "-",
                  city: property.city || owner.city || owner.profile?.city || "-",
                  locationCode: property.locationCode || "-",
                  monthlyRent: property.monthlyRent ?? 0,
                  vacantRooms: property.vacantRooms ?? owner.vacantRooms ?? 0,
                  vacantBeds: property.vacantBeds ?? owner.vacantBeds ?? 0,
                  occupiedRooms: property.occupiedRooms ?? owner.occupiedRooms ?? 0,
                  occupiedBeds: property.occupiedBeds ?? owner.occupiedBeds ?? 0,
                  status: property.status || "-",
                  createdAt: property.createdAt
                }));
              } catch (_) {
                return [];
              }
            })
        )
      ).flat();

      setPropertyUnderOwner(rows);
    } catch (error) {
      console.error("Error fetching property under owner data:", error);
      setPropertyUnderOwner([]);
      setOwnerByLogin({});
    }
  };

  const statusCounts = useMemo(() => {
    const list = loadLocalVisits();
    return {
      approved: list.filter((v) => v.status === "approved").length,
      hold: list.filter((v) => v.status === "hold").length,
      rejected: list.filter((v) => v.status === "rejected").length
    };
  }, [visits]);

  const openApproveModal = (visitId) => {
    setCurrentApprovingId(visitId);
    setShowApprove(true);
  };

  const confirmApproval = async (shouldUpload) => {
    if (!currentApprovingId) return;
    const loginId = `ROOMHY${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
    const password = Math.random().toString(36).slice(-8);
    let finalLoginId = loginId;
    let finalPassword = password;
    let backendApprovedVisit = null;

    let localVisits = loadLocalVisits();
    const idx = localVisits.findIndex((v) => v._id === currentApprovingId || v.visitId === currentApprovingId);
    const visitData = idx !== -1 ? localVisits[idx] : { _id: currentApprovingId, visitId: currentApprovingId };

    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token") || "";
      const response = await fetch(`${apiUrl}/api/visits/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: token } : {})
        },
        body: JSON.stringify({
          visitId: currentApprovingId,
          status: "approved",
          isLiveOnWebsite: shouldUpload,
          loginId,
          tempPassword: password,
          ownerName:
            visitData.ownerName ||
            visitData.propertyInfo?.ownerName ||
            visitData.owner ||
            visitData.contactPerson ||
            visitData.name ||
            visitData.submittedBy ||
            "Owner",
          name:
            visitData.ownerName ||
            visitData.propertyInfo?.ownerName ||
            visitData.owner ||
            visitData.contactPerson ||
            visitData.name ||
            visitData.submittedBy ||
            "Owner"
        })
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Approve failed");
      }
      finalLoginId = data?.credentials?.loginId || finalLoginId;
      finalPassword = data?.credentials?.tempPassword || finalPassword;
      backendApprovedVisit = data?.visit || null;
    } catch (err) {
      console.warn("Backend sync failed:", err);
      window.alert(err?.message || "Property approval failed. MongoDB save did not complete.");
      return;
    }

    if (idx !== -1) {
      const resolvedOwnerName =
        localVisits[idx].ownerName ||
        localVisits[idx].propertyInfo?.ownerName ||
        localVisits[idx].owner ||
        localVisits[idx].contactPerson ||
        localVisits[idx].name ||
        localVisits[idx].submittedBy ||
        "Owner";
      localVisits[idx].status = "approved";
      localVisits[idx].isLiveOnWebsite = shouldUpload;
      localVisits[idx].generatedCredentials = { loginId: finalLoginId, tempPassword: finalPassword };
      localVisits[idx].ownerName = resolvedOwnerName;
      persistLocalVisits(localVisits);
    } else {
      const backendVisitId =
        backendApprovedVisit?.visitId || backendApprovedVisit?._id || currentApprovingId;
      localVisits = mergeVisitsByIdentity(localVisits, [
        backendApprovedVisit
          ? {
              ...backendApprovedVisit,
              _id: backendVisitId,
              visitId: backendVisitId,
              status: "approved",
              isLiveOnWebsite: shouldUpload,
              generatedCredentials: { loginId: finalLoginId, tempPassword: finalPassword }
            }
          : {
              _id: currentApprovingId,
              visitId: currentApprovingId,
              status: "approved",
              isLiveOnWebsite: shouldUpload,
              approvedAt: new Date().toISOString(),
              submittedAt: new Date().toISOString(),
              generatedCredentials: { loginId: finalLoginId, tempPassword: finalPassword }
            }
      ]);
      persistLocalVisits(localVisits);
    }

    setGeneratedCreds({ loginId: finalLoginId, password: finalPassword });
    setShowApprove(false);
    setShowSuccess(true);
    setCurrentApprovingId(null);
    fetchEnquiries();
    fetchPropertyUnderOwner();
  };

  const openActionModal = (type, visitId) => {
    setActionModal({
      open: true,
      type,
      visitId,
      reason: "",
      action: type === "reject" ? "reupload" : "edit"
    });
  };

  const closeActionModal = () => {
    setActionModal({
      open: false,
      type: "hold",
      visitId: "",
      reason: "",
      action: "edit"
    });
  };

  const submitActionModal = async () => {
    if (!actionModal.visitId) return;
    if (!actionModal.reason.trim()) {
      window.alert(actionModal.type === "reject" ? "Please enter reason for reject." : "Please enter reason for hold.");
      return;
    }

    try {
      const endpoint = actionModal.type === "reject" ? `${apiUrl}/api/visits/reject` : `${apiUrl}/api/visits/hold`;
      const body =
        actionModal.type === "reject"
          ? {
              visitId: actionModal.visitId,
              rejectReason: actionModal.reason.trim(),
              rejectAction: actionModal.action
            }
          : {
              visitId: actionModal.visitId,
              holdReason: actionModal.reason.trim(),
              holdAction: actionModal.action
            };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (data.success) {
        window.alert(actionModal.type === "reject" ? "Visit rejected successfully" : "Visit held successfully");
        closeActionModal();
        fetchEnquiries();
        fetchPropertyUnderOwner();
      } else {
        window.alert((actionModal.type === "reject" ? "Error rejecting visit: " : "Error holding visit: ") + data.message);
      }
    } catch (error) {
      console.error(`Error ${actionModal.type} visit:`, error);
      window.alert((actionModal.type === "reject" ? "Error rejecting visit: " : "Error holding visit: ") + error.message);
    }
  };

  const viewGallery = (photos) => {
    setGalleryImages(Array.isArray(photos) ? photos : []);
    setShowGallery(true);
  };

  const closeGallery = () => {
    setShowGallery(false);
    setGalleryImages([]);
  };

  const openMap = (id) => {
    const list = loadLocalVisits();
    const v = list.find((x) => x._id === id || x.visitId === id);
    if (!v || !v.latitude || !v.longitude) {
      alert("No geo-location available for this visit.");
      return;
    }
    const url = `https://www.google.com/maps?q=${v.latitude},${v.longitude}`;
    window.open(url, "_blank");
  };
  const sendKycLink = async (visitId) => {
    if (!visitId || kycLinkSending) return;
    setKycLinkSending(visitId);
    try {
      const token = sessionStorage.getItem("token") || localStorage.getItem("token") || "";
      const res = await fetch(`${apiUrl}/api/visits/${encodeURIComponent(visitId)}/send-kyc-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) }
      });
      const data = await res.json();
      if (data.success) {
        window.alert("KYC link sent to owner's email successfully.");
        fetchEnquiries();
      } else {
        window.alert("Failed to send KYC link: " + (data.message || "Unknown error"));
      }
    } catch (err) {
      window.alert("Error sending KYC link: " + err.message);
    } finally {
      setKycLinkSending(null);
    }
  };

  const openVisitDetails = async (visit) => {
    setSelectedVisit(visit || null);
    setDetailsOwnerFresh(null);
    setShowVisitDetails(true);
    const loginId = visit?.generatedCredentials?.loginId || visit?.ownerLoginId || visit?.ownerId;
    if (loginId) {
      try {
        const token = sessionStorage.getItem("token") || localStorage.getItem("token") || "";
        const res = await fetch(`${apiUrl}/api/owners/${encodeURIComponent(loginId)}`, {
          headers: token ? { Authorization: token } : {}
        });
        if (res.ok) {
          const data = await res.json();
          setDetailsOwnerFresh(data);
        }
      } catch (_) {}
    }
  };
  const closeVisitDetails = () => {
    setShowVisitDetails(false);
    setSelectedVisit(null);
    setDetailsOwnerFresh(null);
  };

  const exportVisitsExcel = () => {
    if (!window.XLSX) {
      alert("Excel export library not loaded.");
      return;
    }
    const rows = visits.map((v) => ({
      VisitId: v.visitId || v._id,
      Property: v.propertyName || v.propertyInfo?.name || "-",
      Owner: v.ownerName || v.propertyInfo?.ownerName || "-",
      Status: v.status || "-"
    }));
    const ws = window.XLSX.utils.json_to_sheet(rows);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Visits");
    const date = new Date().toISOString().split("T")[0];
    window.XLSX.writeFile(wb, `Roomhy_Visits_${date}.xlsx`);
  };

  const currentPage = "enquiry";
  const detailsOwnerLoginId = selectedVisit?.generatedCredentials?.loginId || selectedVisit?.ownerLoginId || selectedVisit?.ownerId || "";
  // Prefer fresh fetch; fall back to cached ownerByLogin map
  const detailsOwnerRecord = detailsOwnerFresh || (detailsOwnerLoginId ? ownerByLogin[detailsOwnerLoginId] : null);
  const detailsAadhaar = detailsOwnerRecord?.checkinAadhaarNumber || detailsOwnerRecord?.aadharNumber || detailsOwnerRecord?.aadhaarNumber || selectedVisit?.kycAadhaarNumber || "-";
  const detailsPhone = detailsOwnerRecord?.checkinPhone || detailsOwnerRecord?.checkinAadhaarLinkedPhone || detailsOwnerRecord?.phone || selectedVisit?.kycPhone || "-";
  // KYC is done via digital-checkin/ownerprofile which writes to Owner record
  const ownerKycDone = detailsAadhaar !== "-" || !!(
    detailsOwnerRecord?.kycStatus === "verified" ||
    detailsOwnerRecord?.kycStatus === "completed"
  );
  const detailsKycStatus = ownerKycDone ? "completed" : (selectedVisit?.kycStatus || "not_sent");
  const detailsIsKycDone = detailsKycStatus === "completed";
  const detailsIsKycSent = detailsKycStatus === "sent";
  const detailsIsKycInProgress = detailsIsKycSent;

  return (
    <div className="html-page">
      <div className="flex h-screen overflow-hidden">
        <aside className="sidebar w-72 flex-shrink-0 hidden md:flex flex-col z-20 overflow-y-auto custom-scrollbar">
          <div className="h-16 flex items-center px-6 border-b border-gray-800 sticky top-0 bg-[#111827] z-10">
            <div className="flex items-center gap-3">
              <div><img src="/website/images/whitelogo.jpeg" alt="Roomhy Logo" className="h-16 w-auto" /><span className="text-[10px] text-gray-500">SUPER ADMIN</span></div>
            </div>
          </div>
          <nav className="flex-1 py-6 space-y-1">
            {navSections.map((section) => (
              <div key={section.label}>
                <div className="px-6 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">{section.label}</div>
                {section.items.map((item) => (
                  <a key={item.href} href={item.href} className={`sidebar-link ${item.key === currentPage ? "active" : ""}`}>
                    <i data-lucide={item.icon} className="w-5 h-5 mr-3"></i> {item.text}
                  </a>
                ))}
              </div>
            ))}
            <div className="mt-6 px-6 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Finance</div>
            <div className="group">
              <div className="sidebar-link justify-between">
                <div className="flex items-center"><i data-lucide="wallet" className="w-5 h-5 mr-3"></i> Finance</div>
                <i data-lucide="chevron-down" className="w-4 h-4 transition-transform duration-200"></i>
              </div>
              <div id="finance-submenu" className="submenu">
                <a href="/superadmin/rentcollection" className="sidebar-link text-sm hover:text-white">Rent Collections</a>
                <a href="/superadmin/platform" className="sidebar-link text-sm hover:text-white">Commissions</a>
                <a href="/superadmin/refund" className="sidebar-link text-sm hover:text-white">Refunds</a>
              </div>
            </div>
            <div className="mt-6 px-6 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">System</div>
            <a href="/superadmin/location" className="sidebar-link"><i data-lucide="globe" className="w-5 h-5 mr-3"></i> Locations</a>
          </nav>
        </aside>
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          <header className="bg-white h-16 shadow-sm flex items-center justify-between px-8 border-b border-gray-200">
            <div className="flex items-center gap-4">
              <button className="md:hidden text-slate-500"><i data-lucide="menu" className="w-6 h-6"></i></button>
              <h1 className="text-xl font-bold text-gray-800">Pending Approvals</h1>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => { fetchEnquiries(); fetchPropertyUnderOwner(); }} className="text-sm text-purple-600 hover:underline flex items-center gap-1">
                <i data-lucide="refresh-cw" className="w-3 h-3"></i> Refresh
              </button>
              <button onClick={exportVisitsExcel} className="text-sm text-gray-600 hover:underline flex items-center gap-1">
                <i data-lucide="download" className="w-3 h-3"></i> Export
              </button>
              <div className="relative">
                <button onClick={() => setShowNotif((v) => !v)} className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <i data-lucide="bell" className="w-5 h-5"></i>
                  {unreadCount > 0 ? (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  ) : null}
                </button>
                {showNotif ? (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg py-2 ring-1 ring-black ring-opacity-5 z-50">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <h3 className="font-semibold text-gray-800">Notifications</h3>
                      <div className="flex gap-2">
                        <button onClick={markAllRead} className="text-xs text-purple-600 hover:text-purple-800">Mark all read</button>
                        <button onClick={clearAll} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
                      </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-gray-400">
                          <i data-lucide="bell-off" className="w-12 h-12 mx-auto mb-2 opacity-50"></i>
                          <p>No notifications yet</p>
                        </div>
                      ) : (
                        notifications.slice(0, 20).map((n) => {
                          const ts = new Date(n.createdAt || Date.now()).toLocaleString();
                          const title =
                            n.type === "new_booking" ? "New Booking" :
                            n.type === "new_enquiry" ? "New Enquiry" :
                            n.type === "new_signup" ? "New Signup" : "Notification";
                          const body =
                            n.type === "new_booking"
                              ? `Property: ${n.meta?.propertyName || "Unknown"} | Guest: ${n.meta?.guestName || n.meta?.userName || "Unknown"}`
                              : n.type === "new_enquiry"
                                ? `${n.meta?.userName || "Someone"} enquired about ${n.meta?.propertyName || "a property"}`
                                : n.type === "new_signup"
                                  ? `${n.meta?.firstName || n.meta?.userName || "A user"} signed up (${n.meta?.email || "no email"})`
                                  : n.from || "New notification";
                          return (
                            <div key={n._id} className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0">
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 mt-1"><i data-lucide="bell" className="w-5 h-5 text-gray-500"></i></div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900">{title}</p>
                                  <p className="text-xs text-gray-600 mt-1">{body}</p>
                                  <p className="text-xs text-gray-400 mt-2">{ts}</p>
                                </div>
                                {!n.read ? <span className="flex-shrink-0 w-2 h-2 bg-purple-500 rounded-full"></span> : null}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-8 bg-white">
            <div className="max-w-[1600px] mx-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="status-card bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-6 flex items-center justify-between">
                    <div><p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Approved</p><h3 className="text-3xl font-bold text-gray-900 mt-1">{statusCounts.approved}</h3></div>
                    <div className="bg-green-50 p-4 rounded-full"><i data-lucide="check-circle" className="w-8 h-8 text-green-600"></i></div>
                  </div>
                  <div className="h-1 bg-green-500"></div>
                </div>
                <div className="status-card bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-6 flex items-center justify-between">
                    <div><p className="text-sm font-medium text-gray-500 uppercase tracking-wider">On Hold</p><h3 className="text-3xl font-bold text-gray-900 mt-1">{statusCounts.hold}</h3></div>
                    <div className="bg-orange-50 p-4 rounded-full"><i data-lucide="pause-circle" className="w-8 h-8 text-orange-600"></i></div>
                  </div>
                  <div className="h-1 bg-orange-500"></div>
                </div>
                <div className="status-card bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-6 flex items-center justify-between">
                    <div><p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Rejected</p><h3 className="text-3xl font-bold text-gray-900 mt-1">{statusCounts.rejected}</h3></div>
                    <div className="bg-red-50 p-4 rounded-full"><i data-lucide="x-circle" className="w-8 h-8 text-red-600"></i></div>
                  </div>
                  <div className="h-1 bg-red-500"></div>
                </div>
              </div>

              <div className="flex border-b border-gray-200 bg-white rounded-t-lg px-4 pt-4">
                <button onClick={() => setActiveTab("visits")} className={`px-6 py-3 font-semibold transition-all ${activeTab === "visits" ? "text-purple-600 border-b-2 border-purple-600" : "text-gray-500 border-b-2 border-transparent"}`}>Visit Reports</button>
                <button onClick={() => setActiveTab("properties")} className={`px-6 py-3 font-semibold transition-all ${activeTab === "properties" ? "text-purple-600 border-b-2 border-purple-600" : "text-gray-500 border-b-2 border-transparent"}`}>Property Under Owner</button>
              </div>

              {activeTab === "visits" ? (
                <div className="bg-white rounded-b-lg shadow border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase border-b">
                        <tr>
                          <th className="px-4 py-3">Visit ID</th>
                          <th className="px-4 py-3">Visit Date & Time</th>
                          <th className="px-4 py-3">Staff Name</th>
                          <th className="px-4 py-3">Staff ID</th>
                          <th className="px-4 py-3">Property Name</th>
                          <th className="px-4 py-3">Property Type</th>
                          <th className="px-4 py-3">Full Address</th>
                          <th className="px-4 py-3">Area / Locality</th>
                          <th className="px-4 py-3">Landmark</th>
                          <th className="px-4 py-3">Nearby Location</th>
                          <th className="px-4 py-3">Owner Name</th>
                          <th className="px-4 py-3">Owner Contact</th>
                          <th className="px-4 py-3">Owner Gmail</th>
                          <th className="px-4 py-3">Gender</th>
                          <th className="px-4 py-3">Vacant Rooms</th>
                          <th className="px-4 py-3">Vacant Beds</th>
                          <th className="px-4 py-3">Occupied Rooms</th>
                          <th className="px-4 py-3">Occupied Beds</th>
                          <th className="px-4 py-3">Student Reviews</th>
                          <th className="px-4 py-3">Employee Rating</th>
                          <th className="px-4 py-3 text-center">Monthly Rent</th>
                          <th className="px-4 py-3">Amenities</th>
                          <th className="px-4 py-3">Cleanliness</th>
                          <th className="px-4 py-3">Owner Behaviour</th>
                          <th className="px-4 py-3">Field Photos</th>
                          <th className="px-4 py-3">Prof. Photos</th>
                          <th className="px-4 py-3">Geo Status</th>
                          <th className="px-4 py-3">Map</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">KYC Status</th>
                          <th className="px-4 py-3">Login ID</th>
                          <th className="px-4 py-3">Password</th>
                          <th className="px-4 py-3 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {visits.length === 0 ? (
                          <tr><td colSpan={33} className="px-6 py-12 text-center text-gray-400">No pending reports found.</td></tr>
                        ) : (
                          visits.map((v) => {
                            const prop = v.propertyInfo || {};
                            const fieldPhotos = v.photos || [];
                            const profPhotos = v.professionalPhotos || [];
                            const amenities = (prop.amenities || v.amenities || []).length ? (prop.amenities || v.amenities).join(", ") : "-";
                            const cleanliness = v.cleanlinessRating || v.cleanliness || "-";
                            const ownerBehaviour = v.ownerBehaviourPublic || v.ownerBehaviour || "-";
                            const geoOk = v.latitude && v.longitude ? "OK" : "No Geo";
                            const loginId = v.generatedCredentials ? v.generatedCredentials.loginId || "-" : "-";
                            const password = v.generatedCredentials ? v.generatedCredentials.tempPassword || "-" : "-";

                            const kyc = v.kycStatus || "not_sent";
                            const kycDone = kyc === "completed";
                            const kycSent = kyc === "sent";
                            const kycCanApprove = kycDone;
                            const kycBadge = kycDone
                              ? { label: "Completed", cls: "bg-green-100 text-green-700" }
                              : kycSent
                              ? { label: "Sent", cls: "bg-yellow-100 text-yellow-700" }
                              : { label: "Not Sent", cls: "bg-gray-100 text-gray-500" };
                            const isSendingKyc = kycLinkSending === (v.visitId || v._id);

                            return (
                              <tr key={v._id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 text-xs font-mono text-gray-600">{v.visitId || v._id?.slice(-8).toUpperCase()}</td>
                                <td className="px-4 py-3 text-sm text-gray-600">{v.submittedAt ? new Date(v.submittedAt).toLocaleString() : "-"}</td>
                                <td className="px-4 py-3 text-sm font-semibold text-slate-700">{v.staffName || prop.staffName || "-"}</td>
                                <td className="px-4 py-3 text-sm">{v.staffId || prop.staffId || "-"}</td>
                                <td className="px-4 py-3"><div className="text-sm font-bold text-slate-700">{v.propertyName || prop.name || "-"}</div></td>
                                <td className="px-4 py-3">{v.propertyType || prop.propertyType || "-"}</td>
                                <td className="px-4 py-3">{v.address || prop.address || "-"}</td>
                                <td className="px-4 py-3">{v.area || prop.area || "-"}</td>
                                <td className="px-4 py-3">{v.landmark || prop.landmark || "-"}</td>
                                <td className="px-4 py-3">{v.nearbyLocation || prop.nearbyLocation || "-"}</td>
                                <td className="px-4 py-3">{v.ownerName || prop.ownerName || "-"}</td>
                                <td className="px-4 py-3">{v.contactPhone || prop.contactPhone || "-"}</td>
                                <td className="px-4 py-3">{v.ownerEmail || prop.ownerEmail || "-"}</td>
                                <td className="px-4 py-3">{v.gender || "-"}</td>
                                <td className="px-4 py-3 text-center">{v.vacantRooms || prop.vacantRooms || 0}</td>
                                <td className="px-4 py-3 text-center">{v.vacantBeds || prop.vacantBeds || 0}</td>
                                <td className="px-4 py-3 text-center">{v.occupiedRooms || prop.occupiedRooms || 0}</td>
                                <td className="px-4 py-3 text-center">{v.occupiedBeds || prop.occupiedBeds || 0}</td>
                                <td className="px-4 py-3 text-center bg-amber-50 border-x border-amber-200">
                                  <div className="flex items-center justify-center">
                                    <span className="text-lg font-bold text-amber-600">{v.studentReviewsRating ? "\u2605".repeat(Math.floor(v.studentReviewsRating)) + "\u2606".repeat(5 - Math.floor(v.studentReviewsRating)) : "-"}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center bg-emerald-50 border-x border-emerald-200">
                                  <div className="flex items-center justify-center">
                                    <span className="text-lg font-bold text-emerald-600">{v.employeeRating ? "\u2605".repeat(Math.floor(v.employeeRating)) + "\u2606".repeat(5 - Math.floor(v.employeeRating)) : "-"}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center font-bold">{"\u20B9"}{v.monthlyRent || prop.monthlyRent || 0}</td>
                                <td className="px-4 py-3 text-sm">{amenities}</td>
                                <td className="px-4 py-3">{cleanliness}</td>
                                <td className="px-4 py-3">{ownerBehaviour}</td>
                                <td className="px-4 py-3">
                                  <button onClick={() => viewGallery(fieldPhotos)} className="text-[10px] text-purple-600 bg-purple-50 px-2 py-1 rounded border border-purple-200 font-medium hover:bg-purple-100 transition">{fieldPhotos.length}</button>
                                </td>
                                <td className="px-4 py-3">
                                  <button onClick={() => viewGallery(profPhotos)} className="text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-200 font-medium hover:bg-blue-100 transition">{profPhotos.length}</button>
                                </td>
                                <td className="px-4 py-3">{geoOk}</td>
                                <td className="px-4 py-3">
                                  <button onClick={() => openMap(v.visitId || v._id)} className="text-xs px-2 py-1 bg-gray-50 rounded border text-gray-600 hover:bg-gray-100" disabled={!(v.latitude && v.longitude)}>Map</button>
                                </td>
                                <td className="px-4 py-3">{v.status || "-"}</td>
                                <td className="px-4 py-3">
                                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${kycBadge.cls}`}>{kycBadge.label}</span>
                                </td>
                                <td className="px-4 py-3 font-mono text-sm text-purple-700">{loginId}</td>
                                <td className="px-4 py-3 font-mono text-sm">{password}</td>
                                <td className="px-4 py-3 text-center">
                                  <div className="flex items-center justify-center gap-2 flex-wrap">
                                    <button onClick={() => openVisitDetails(v)} className="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-xs font-semibold" title="View Details">View Details</button>
                                    <button
                                      onClick={() => sendKycLink(v.visitId || v._id)}
                                      disabled={isSendingKyc || kycDone}
                                      className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${kycDone ? "bg-gray-100 text-gray-400 cursor-not-allowed" : isSendingKyc ? "bg-blue-50 text-blue-400 cursor-wait" : "bg-blue-100 text-blue-700 hover:bg-blue-200"}`}
                                      title={kycDone ? "KYC already completed" : "Send KYC link to owner"}
                                    >
                                      {isSendingKyc ? "Sending..." : kycDone ? "KYC Done" : kycSent ? "Resend KYC" : "Send KYC"}
                                    </button>
                                    <button
                                      onClick={() => kycCanApprove ? openApproveModal(v.visitId || v._id) : null}
                                      disabled={!kycCanApprove}
                                      className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${kycCanApprove ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
                                      title={kycCanApprove ? "Approve property" : "Send KYC link first before approving"}
                                    >
                                      Approve
                                    </button>
                                    <button onClick={() => openActionModal("reject", v.visitId || v._id)} className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-xs font-semibold" title="Reject">Reject</button>
                                    <button onClick={() => openActionModal("hold", v.visitId || v._id)} className="px-3 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors text-xs font-semibold" title="Hold">Hold</button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-b-lg shadow border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase border-b">
                        <tr>
                          <th className="px-6 py-4">Owner Login ID</th>
                          <th className="px-6 py-4">Owner Name</th>
                          <th className="px-6 py-4">Property Name</th>
                          <th className="px-6 py-4">Type</th>
                          <th className="px-6 py-4">Address</th>
                          <th className="px-6 py-4">Area</th>
                          <th className="px-6 py-4">City</th>
                          <th className="px-6 py-4">Location Code</th>
                          <th className="px-6 py-4">Rent/mo</th>
                          <th className="px-6 py-4">Vacant Rooms</th>
                          <th className="px-6 py-4">Vacant Beds</th>
                          <th className="px-6 py-4">Occupied Rooms</th>
                          <th className="px-6 py-4">Occupied Beds</th>
                          <th className="px-6 py-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {propertyUnderOwner.length === 0 ? (
                          <tr><td colSpan={12} className="px-6 py-12 text-center text-gray-400">No property-under-owner records found.</td></tr>
                        ) : (
                          propertyUnderOwner.map((property) => (
                            <tr key={`${property.ownerLoginId}-${property.propertyId}`} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm font-mono text-purple-700">{property.ownerLoginId}</td>
                              <td className="px-6 py-4 text-sm">{property.ownerName}</td>
                              <td className="px-6 py-4 text-sm font-semibold text-slate-700">{property.propertyTitle}</td>
                              <td className="px-6 py-4 text-sm">{property.propertyType}</td>
                              <td className="px-6 py-4 text-sm">{property.address}</td>
                              <td className="px-6 py-4 text-sm">{property.area}</td>
                              <td className="px-6 py-4 text-sm">{property.city}</td>
                              <td className="px-6 py-4 text-sm font-mono">{property.locationCode}</td>
                              <td className="px-6 py-4 text-sm font-bold">{"\u20B9"}{property.monthlyRent || 0}</td>
                              <td className="px-6 py-4 text-sm font-semibold">{property.vacantRooms || 0}</td>
                              <td className="px-6 py-4 text-sm font-semibold">{property.vacantBeds || 0}</td>
                              <td className="px-6 py-4 text-sm font-semibold">{property.occupiedRooms || 0}</td>
                              <td className="px-6 py-4 text-sm font-semibold">{property.occupiedBeds || 0}</td>
                              <td className="px-6 py-4 text-sm">{property.status}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
      {showApprove ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full text-center shadow-xl">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3"><i data-lucide="upload-cloud" className="w-6 h-6 text-blue-600"></i></div>
            <h3 className="text-lg font-bold text-gray-900">Approve Property</h3>
            <p className="text-sm text-gray-600 mb-6">Would you like to upload this property to the website?</p>
            <div className="flex gap-3">
              <button onClick={() => confirmApproval(true)} className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition font-medium">Yes, Upload</button>
              <button onClick={() => confirmApproval(false)} className="flex-1 bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400 transition font-medium">No, Keep Offline</button>
            </div>
          </div>
        </div>
      ) : null}

      {showSuccess ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full text-center shadow-xl">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3"><i data-lucide="check" className="w-6 h-6 text-green-600"></i></div>
            <h3 className="text-lg font-bold text-gray-900">Approved!</h3>
            <p className="text-sm text-gray-500 mb-4">Credentials generated successfully.</p>
            <div className="bg-gray-50 p-3 rounded text-left mb-4 border border-gray-200">
              <div className="text-xs text-gray-500">Login ID:</div><div className="font-mono font-bold text-purple-600">{generatedCreds.loginId}</div>
              <div className="text-xs text-gray-500 mt-2">Password:</div><div className="font-mono font-bold text-slate-600">{generatedCreds.password}</div>
            </div>
            <button onClick={() => { setShowSuccess(false); fetchEnquiries(); }} className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 transition">Close</button>
          </div>
        </div>
      ) : null}

      {actionModal.open ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">
              {actionModal.type === "reject" ? "Reject Property" : "Hold Property"}
            </h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">
              {actionModal.type === "reject"
                ? "Enter reason for reject and choose what should happen next."
                : "Enter reason for hold and choose the next step."}
            </p>
            <textarea
              rows={4}
              value={actionModal.reason}
              onChange={(event) => setActionModal((prev) => ({ ...prev, reason: event.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder={actionModal.type === "reject" ? "Reason for reject" : "Reason for hold"}
            />
            <div className="mt-4">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {actionModal.type === "reject" ? "Next Step" : "Action"}
              </label>
              <div className="mt-2 flex gap-2">
                {actionModal.type === "reject" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setActionModal((prev) => ({ ...prev, action: "reupload" }))}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium ${actionModal.action === "reupload" ? "border-red-500 bg-red-50 text-red-700" : "border-gray-300 text-gray-600"}`}
                    >
                      Reupload
                    </button>
                    <button
                      type="button"
                      onClick={() => setActionModal((prev) => ({ ...prev, action: "cancel" }))}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium ${actionModal.action === "cancel" ? "border-gray-700 bg-gray-100 text-gray-700" : "border-gray-300 text-gray-600"}`}
                    >
                      Cancel Property
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setActionModal((prev) => ({ ...prev, action: "edit" }))}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium ${actionModal.action === "edit" ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-300 text-gray-600"}`}
                    >
                      Ask to Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setActionModal((prev) => ({ ...prev, action: "none" }))}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium ${actionModal.action === "none" ? "border-gray-700 bg-gray-100 text-gray-700" : "border-gray-300 text-gray-600"}`}
                    >
                      Hold Only
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={closeActionModal} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition">Close</button>
              <button
                onClick={submitActionModal}
                className={`flex-1 py-2 rounded-lg text-white transition ${actionModal.type === "reject" ? "bg-red-600 hover:bg-red-700" : "bg-orange-600 hover:bg-orange-700"}`}
              >
                {actionModal.type === "reject" ? "Reject" : "Hold"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showGallery ? (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] backdrop-blur-sm" onClick={closeGallery}>
          <div className="relative w-full max-w-4xl p-4" onClick={(e) => e.stopPropagation()}>
            <button onClick={closeGallery} className="absolute -top-10 right-0 text-white"><i data-lucide="x" className="w-8 h-8"></i></button>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[80vh] overflow-y-auto p-4">
              {galleryImages.length > 0 ? galleryImages.map((src, idx) => (
                <img key={`${src}-${idx}`} src={src} className="w-full h-48 object-cover rounded-xl shadow-lg border border-gray-200" />
              )) : (
                <p className="text-white text-center py-20">No images available for this section.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {showVisitDetails && selectedVisit ? (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4" onClick={closeVisitDetails}>
          <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Visit Report Details</h3>
                <p className="text-xs text-gray-500">Visit ID: {selectedVisit.visitId || selectedVisit._id || "-"}</p>
              </div>
              <button onClick={closeVisitDetails} className="text-gray-400 hover:text-gray-700"><i data-lucide="x" className="w-6 h-6"></i></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="border rounded-xl p-3"><p className="text-gray-500">Property Name</p><p className="font-semibold">{selectedVisit.propertyName || selectedVisit.propertyInfo?.name || "-"}</p></div>
                <div className="border rounded-xl p-3"><p className="text-gray-500">Type</p><p className="font-semibold">{selectedVisit.propertyType || selectedVisit.propertyInfo?.propertyType || "-"}</p></div>
                <div className="border rounded-xl p-3"><p className="text-gray-500">Status</p><p className="font-semibold">{selectedVisit.status || "-"}</p></div>
                <div className="border rounded-xl p-3"><p className="text-gray-500">Owner</p><p className="font-semibold">{selectedVisit.ownerName || "-"}</p></div>
                <div className="border rounded-xl p-3"><p className="text-gray-500">Contact</p><p className="font-semibold">{selectedVisit.contactPhone || "-"}</p></div>
                <div className="border rounded-xl p-3"><p className="text-gray-500">Email</p><p className="font-semibold">{selectedVisit.ownerEmail || "-"}</p></div>
                <div className="border rounded-xl p-3 md:col-span-2"><p className="text-gray-500">Address</p><p className="font-semibold">{selectedVisit.address || "-"}</p></div>
                <div className="border rounded-xl p-3"><p className="text-gray-500">Area / City</p><p className="font-semibold">{selectedVisit.area || "-"} {selectedVisit.city ? `, ${selectedVisit.city}` : ""}</p></div>
                <div className="border rounded-xl p-3"><p className="text-gray-500">Landmark</p><p className="font-semibold">{selectedVisit.landmark || "-"}</p></div>
                <div className="border rounded-xl p-3"><p className="text-gray-500">Nearby Location</p><p className="font-semibold">{selectedVisit.nearbyLocation || "-"}</p></div>
                <div className="border rounded-xl p-3"><p className="text-gray-500">Monthly Rent</p><p className="font-semibold">₹{selectedVisit.monthlyRent || 0}</p></div>
                <div className="border rounded-xl p-3"><p className="text-gray-500">Deposit</p><p className="font-semibold">₹{selectedVisit.deposit || 0}</p></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="border rounded-xl p-3"><p className="text-gray-500">Vacant Rooms</p><p className="font-semibold">{selectedVisit.vacantRooms || 0}</p></div>
                <div className="border rounded-xl p-3"><p className="text-gray-500">Vacant Beds</p><p className="font-semibold">{selectedVisit.vacantBeds || 0}</p></div>
                <div className="border rounded-xl p-3"><p className="text-gray-500">Occupied Rooms</p><p className="font-semibold">{selectedVisit.occupiedRooms || 0}</p></div>
                <div className="border rounded-xl p-3"><p className="text-gray-500">Occupied Beds</p><p className="font-semibold">{selectedVisit.occupiedBeds || 0}</p></div>
              </div>
              <div className="border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <p className="text-sm font-semibold text-gray-800">Owner KYC Verification</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${detailsIsKycDone ? "bg-green-100 text-green-700" : detailsIsKycSent ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>
                      {detailsIsKycDone ? "Completed" : detailsIsKycSent ? "Link Sent" : "Not Sent"}
                    </span>
                    {!detailsIsKycDone && selectedVisit && (
                      <button
                        onClick={() => { sendKycLink(selectedVisit.visitId || selectedVisit._id); }}
                        disabled={kycLinkSending === (selectedVisit.visitId || selectedVisit._id)}
                        className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50"
                      >
                        {kycLinkSending === (selectedVisit.visitId || selectedVisit._id) ? "Sending..." : detailsIsKycSent ? "Resend KYC Link" : "Send KYC Link"}
                      </button>
                    )}
                  </div>
                </div>
                {!detailsIsKycDone && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                    KYC must be completed before this property can be approved.
                  </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="border rounded-lg p-3"><p className="text-gray-500">Owner Login ID</p><p className="font-semibold font-mono text-purple-700">{detailsOwnerLoginId || "-"}</p></div>
                  <div className="border rounded-lg p-3"><p className="text-gray-500">KYC Status</p><p className="font-semibold capitalize">{detailsKycStatus.replace("_", " ")}</p></div>
                  <div className="border rounded-lg p-3"><p className="text-gray-500">KYC Link Sent At</p><p className="font-semibold">{selectedVisit?.kycSentAt ? new Date(selectedVisit.kycSentAt).toLocaleString() : "-"}</p></div>
                  <div className="border rounded-lg p-3"><p className="text-gray-500">Aadhaar Number</p><p className="font-semibold">{detailsAadhaar}</p></div>
                  <div className="border rounded-lg p-3"><p className="text-gray-500">KYC Phone</p><p className="font-semibold">{detailsPhone}</p></div>
                </div>
              </div>
              {/* Bank Details */}
              <div className="border rounded-xl p-4">
                <p className="font-semibold text-gray-700 mb-3">Owner Bank Details</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div className="border rounded-lg p-3"><p className="text-gray-500">Account Holder</p><p className="font-semibold">{selectedVisit.bankAccountHolderName || detailsOwnerRecord?.checkinAccountHolderName || "-"}</p></div>
                  <div className="border rounded-lg p-3"><p className="text-gray-500">Account Number</p><p className="font-semibold">{selectedVisit.bankAccountNumber || detailsOwnerRecord?.checkinBankAccountNumber || "-"}</p></div>
                  <div className="border rounded-lg p-3"><p className="text-gray-500">IFSC Code</p><p className="font-semibold">{selectedVisit.bankIfscCode || detailsOwnerRecord?.checkinIfscCode || "-"}</p></div>
                  <div className="border rounded-lg p-3"><p className="text-gray-500">Bank Name</p><p className="font-semibold">{selectedVisit.bankName || detailsOwnerRecord?.checkinBankName || "-"}</p></div>
                  <div className="border rounded-lg p-3"><p className="text-gray-500">Branch Name</p><p className="font-semibold">{selectedVisit.bankBranchName || detailsOwnerRecord?.checkinBranchName || "-"}</p></div>
                  <div className="border rounded-lg p-3"><p className="text-gray-500">UPI ID</p><p className="font-semibold">{selectedVisit.bankUpiId || detailsOwnerRecord?.checkinUpiId || "-"}</p></div>
                </div>
              </div>

              {(detailsOwnerRecord?.checkinOwnerPhoto || detailsOwnerRecord?.checkinBankProof || detailsOwnerRecord?.checkinAadhaarImage) && (
                <div className="border rounded-xl p-4">
                  <p className="font-semibold text-gray-700 mb-3">Owner Documents</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {detailsOwnerRecord?.checkinOwnerPhoto && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Owner Photo</p>
                        <img src={detailsOwnerRecord.checkinOwnerPhoto} className="w-36 h-36 object-cover rounded-lg border shadow-sm" alt="Owner Photo" />
                        {detailsOwnerRecord.checkinOwnerPhotoName && <p className="text-xs text-gray-400 mt-1">{detailsOwnerRecord.checkinOwnerPhotoName}</p>}
                      </div>
                    )}
                    {detailsOwnerRecord?.checkinBankProof && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Bank Verification Proof</p>
                        {String(detailsOwnerRecord.checkinBankProofType || "").includes("pdf") ? (
                          <a href={detailsOwnerRecord.checkinBankProof} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 underline text-sm border border-blue-200 px-3 py-2 rounded-lg hover:bg-blue-50">
                            <i data-lucide="file-text" className="w-4 h-4"></i> View PDF
                          </a>
                        ) : (
                          <img src={detailsOwnerRecord.checkinBankProof} className="w-48 h-36 object-cover rounded-lg border shadow-sm" alt="Bank Proof" />
                        )}
                        {detailsOwnerRecord.checkinBankProofName && <p className="text-xs text-gray-400 mt-1">{detailsOwnerRecord.checkinBankProofName}</p>}
                      </div>
                    )}
                    {detailsOwnerRecord?.checkinAadhaarImage && (
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Aadhaar Card</p>
                        <img src={detailsOwnerRecord.checkinAadhaarImage} className="w-48 h-36 object-contain rounded-lg border shadow-sm bg-gray-50" alt="Aadhaar Card" />
                        {detailsOwnerRecord.checkinAadhaarImageName && <p className="text-xs text-gray-400 mt-1">{detailsOwnerRecord.checkinAadhaarImageName}</p>}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="border rounded-xl p-4">
                <p className="text-gray-500 text-sm mb-2">Amenities</p>
                <p className="font-medium text-sm">{(selectedVisit.amenities || []).length ? selectedVisit.amenities.join(", ") : "-"}</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="border rounded-xl p-3"><p className="text-gray-500">Student Rating</p><p className="font-semibold">{selectedVisit.studentReviewsRating || "-"}</p></div>
                <div className="border rounded-xl p-3"><p className="text-gray-500">Employee Rating</p><p className="font-semibold">{selectedVisit.employeeRating || "-"}</p></div>
                <div className="border rounded-xl p-3"><p className="text-gray-500">Cleanliness</p><p className="font-semibold">{selectedVisit.cleanlinessRating || "-"}</p></div>
                <div className="border rounded-xl p-3"><p className="text-gray-500">Owner Behaviour</p><p className="font-semibold">{selectedVisit.ownerBehaviourPublic || selectedVisit.ownerBehaviour || "-"}</p></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Field Photos ({(selectedVisit.photos || []).length})</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(selectedVisit.photos || []).map((src, idx) => (
                      <img key={`fp-${idx}`} src={src} className="w-full h-24 object-cover rounded-lg border" alt="" />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Professional Photos ({(selectedVisit.professionalPhotos || []).length})</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(selectedVisit.professionalPhotos || []).map((src, idx) => (
                      <img key={`pp-${idx}`} src={src} className="w-full h-24 object-cover rounded-lg border" alt="" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
