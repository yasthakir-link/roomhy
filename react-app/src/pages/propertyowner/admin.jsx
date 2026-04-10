import React, { useEffect, useMemo, useRef, useState } from "react";
import { fetchJson } from "../../utils/api";
import PropertyOwnerLayout from "../../components/propertyowner/PropertyOwnerLayout";
import { useHtmlPage } from "../../utils/htmlPage";
import {
  clearOwnerRuntimeSession,
  fetchOwnerTenants,
  fetchBookingRequestsForOwner,
  normalizeBooking,
  formatDate,
  getOwnerRuntimeSession
} from "../../utils/propertyowner";

const readJson = (key, fallback) => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const isPlaceholderTenantName = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return !normalized || normalized === "occupied" || normalized === "tenant" || normalized === "unknown";
};

const toLegacyBeds = (room) => {
  if (Array.isArray(room?.beds)) return room.beds;
  const bedCount = Number(room?.beds || room?.capacity || room?.totalBeds || room?.bedCount || 0);
  return Array.from({ length: bedCount > 0 ? bedCount : 0 }, (_, index) => {
    const assignment = room?.bedAssignments?.[index] || room?.bedsInfo?.[index] || null;
    return assignment && (assignment.tenantName || assignment.name || assignment.loginId || assignment.tenantId)
      ? {
          status: "occupied",
          tenantId: assignment.tenantId || assignment.loginId || assignment._id || assignment.id || null,
          tenantName: assignment.tenantName || assignment.name || "Tenant"
        }
      : { status: "available", tenantId: null, tenantName: null };
  });
};

const isBedOccupied = (bed) => {
  if (!bed) return false;
  const status = String(bed.status || "").trim().toLowerCase();
  if (status === "available" || status === "vacant" || status === "empty") return false;
  if (status === "occupied" && (bed?.tenantId || bed?.loginId || !isPlaceholderTenantName(bed?.tenantName || bed?.name))) {
    return true;
  }
  return Boolean(
    bed?.tenantId ||
    bed?.loginId ||
    (bed?.tenantName && !isPlaceholderTenantName(bed.tenantName)) ||
    (bed?.name && !isPlaceholderTenantName(bed.name))
  );
};

const summarizeOccupancy = (rooms = []) => {
  const summary = {
    vacantRooms: 0,
    occupiedRooms: 0,
    vacantBeds: 0,
    occupiedBeds: 0,
    totalRooms: 0
  };

  (Array.isArray(rooms) ? rooms : []).forEach((room) => {
    const beds = toLegacyBeds(room);
    const occupiedBeds = beds.filter((bed) => isBedOccupied(bed)).length;
    const vacantBeds = Math.max(0, beds.length - occupiedBeds);
    summary.totalRooms += 1;
    summary.occupiedBeds += occupiedBeds;
    summary.vacantBeds += vacantBeds;
    if (occupiedBeds > 0) summary.occupiedRooms += 1;
    else summary.vacantRooms += 1;
  });

  return summary;
};

export default function Admin() {
  useHtmlPage({
    title: "Roomhy - Owner Dashboard",
    bodyClass: "text-slate-800",
    htmlAttrs: { lang: "en" },
    metas: [
      { charset: "UTF-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" }
    ],
    links: [
      { href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap", rel: "stylesheet" },
      { rel: "stylesheet", href: "/propertyowner/assets/css/admin.css" }
    ],
    scripts: [{ src: "https://cdn.tailwindcss.com" }, { src: "https://unpkg.com/lucide@latest" }],
    inlineScripts: []
  });

  const [owner, setOwner] = useState(null);
  const [roomsCount, setRoomsCount] = useState(0);
  const [tenantsCount, setTenantsCount] = useState(0);
  const [rentTotal, setRentTotal] = useState(0);
  const [enquiries, setEnquiries] = useState([]);
  const [dashboardNotifications, setDashboardNotifications] = useState([]);
  const [occupancySummary, setOccupancySummary] = useState({
    vacantRooms: 0,
    occupiedRooms: 0,
    vacantBeds: 0,
    occupiedBeds: 0,
    totalRooms: 0
  });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const seenBidIdsRef = useRef(new Set());
  const initialBidSyncRef = useRef(true);
  const audioContextRef = useRef(null);

  const notificationCount = useMemo(
    () => dashboardNotifications.length,
    [dashboardNotifications]
  );

  useEffect(() => {
    if (window?.lucide?.createIcons) window.lucide.createIcons();
  }, [owner, enquiries, dashboardNotifications, loading]);

  const playBidAlertSound = () => {
    if (typeof window === "undefined") return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(980, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.2);
      gain.gain.setValueAtTime(0.9, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } catch (error) {
      console.warn("Failed to play bid alert sound:", error?.message || error);
    }
  };

  const buildBidNotification = (booking) => {
    const bidderName = booking.userName || booking.name || booking.fullName || "Someone";
    const propertyName = booking.propertyName || booking.property_name || "your property";
    const budget = booking.budgetRange && booking.budgetRange !== "-" ? ` Budget ${booking.budgetRange}.` : ".";
    return {
      key: `bid-${booking.key}`,
      title: "New bid interest",
      message: `${bidderName} is interested in ${propertyName}${budget}`,
      createdAt: booking.submittedAt || booking.createdAt || new Date().toISOString()
    };
  };

  const buildEnquiryNotification = (item) => ({
    key: `enquiry-${item._id || item.id || item.visitId || Math.random().toString(36).slice(2)}`,
    title: item.propertyName || item.property?.name || "Enquiry",
    message: `${item.name || item.tenantName || "Tenant"} | ${item.status || "pending"}`,
    createdAt: item.createdAt || new Date().toISOString()
  });

  const loadDashboard = async (loginId) => {
    setLoading(true);
    setErrorMsg("");
    try {
      const [ownerRes, roomsRes, tenantsRes, rentRes, enquiryRes] = await Promise.all([
        fetchJson(`/api/owners/${encodeURIComponent(loginId)}`).catch(() => null),
        fetchJson(`/api/owners/${encodeURIComponent(loginId)}/rooms`),
        fetchOwnerTenants(loginId),
        fetchJson(`/api/owners/${encodeURIComponent(loginId)}/rent`),
        fetchJson(`/api/owners/${encodeURIComponent(loginId)}/enquiries`)
      ]);
      setOwner((prev) => ({ ...prev, ...(ownerRes || {}) }));
      const roomList = Array.isArray(roomsRes?.rooms) && roomsRes.rooms.length > 0
        ? roomsRes.rooms
        : readJson("roomhy_rooms", []).filter((room) => {
            const candidateOwner = String(room?.ownerLoginId || room?.ownerId || room?.owner || "").toUpperCase();
            return !candidateOwner || candidateOwner === String(loginId || "").toUpperCase();
          });
      setRoomsCount(roomList.length);
      setOccupancySummary(summarizeOccupancy(roomList));
      setTenantsCount((Array.isArray(tenantsRes) ? tenantsRes : tenantsRes?.tenants || []).length);
      setRentTotal(rentRes?.totalRent || 0);
      const enquiryList = Array.isArray(enquiryRes) ? enquiryRes : enquiryRes?.enquiries || [];
      setEnquiries(enquiryList);

      let bookingRequestList = [];
      try {
        bookingRequestList = await fetchBookingRequestsForOwner(loginId);
      } catch (_) {
        bookingRequestList = readJson("roomhy_booking_requests", []).filter((item) => {
          const candidateOwner = String(item?.owner_id || item?.ownerId || item?.owner_login_id || item?.ownerLoginId || item?.owner || "").toUpperCase();
          return !candidateOwner || candidateOwner === String(loginId || "").toUpperCase();
        });
      }

      const normalizedBookings = (Array.isArray(bookingRequestList) ? bookingRequestList : [])
        .map((item) => normalizeBooking(item))
        .filter((item) => String(item.request_type || item.type || "").toLowerCase() === "bid");
      const activeBidRequests = normalizedBookings.filter((item) => ["pending", "submitted"].includes(String(item.status || "pending").toLowerCase()));

      const nextBidIds = new Set(activeBidRequests.map((item) => String(item.key || item._id || item.id || "")));
      if (initialBidSyncRef.current) {
        seenBidIdsRef.current = nextBidIds;
        initialBidSyncRef.current = false;
      } else {
        const newBidRequests = activeBidRequests.filter((item) => {
          const key = String(item.key || item._id || item.id || "");
          return key && !seenBidIdsRef.current.has(key);
        });
        if (newBidRequests.length > 0) {
          playBidAlertSound();
        }
        newBidRequests.forEach((item) => {
          const key = String(item.key || item._id || item.id || "");
          if (key) seenBidIdsRef.current.add(key);
        });
      }

      const bidNotifications = activeBidRequests.map(buildBidNotification);
      const enquiryNotifications = enquiryList
        .filter((item) => ["pending", "hold"].includes(String(item.status || "").toLowerCase()))
        .map(buildEnquiryNotification);
      setDashboardNotifications([...bidNotifications, ...enquiryNotifications]);
    } catch (err) {
      setErrorMsg(err?.body || err?.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const session = getOwnerRuntimeSession();
    if (!session?.loginId) {
      window.location.href = "/propertyowner/ownerlogin";
      return;
    }
    setOwner(session);
    loadDashboard(session.loginId);
    const timer = window.setInterval(() => {
      loadDashboard(session.loginId);
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const handleEnquiryAction = async (enquiryId, status) => {
    try {
      await fetchJson(`/api/owners/enquiries/${encodeURIComponent(enquiryId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      if (owner?.loginId) {
        await loadDashboard(owner.loginId);
      }
    } catch (err) {
      setErrorMsg(err?.body || err?.message || "Failed to update enquiry.");
    }
  };

  const chartTotal = Math.max(
    Number(roomsCount || 0),
    Number(occupancySummary.totalRooms || 0),
    Number((occupancySummary.occupiedRooms || 0) + (occupancySummary.vacantRooms || 0))
  );
  const occupiedRooms = Math.min(Number(occupancySummary.occupiedRooms || 0), chartTotal);
  const notOccupiedRooms = Math.max(chartTotal - occupiedRooms, 0);
  const occupiedPercent = chartTotal ? Math.round((occupiedRooms / chartTotal) * 100) : 0;
  const notOccupiedPercent = chartTotal ? Math.round((notOccupiedRooms / chartTotal) * 100) : 0;
  const pieStyle = chartTotal
    ? {
        background: `conic-gradient(#a855f7 0% ${occupiedPercent}%, #e5e7eb ${occupiedPercent}% 100%)`
      }
    : {
        background: "conic-gradient(#cbd5e1 0% 100%)"
      };

  return (
    <PropertyOwnerLayout
      owner={owner}
      title="Dashboard"
      navVariant="default"
      notificationCount={notificationCount}
      notifications={dashboardNotifications}
      onLogout={() => {
        clearOwnerRuntimeSession();
        window.location.href = "/propertyowner/ownerlogin";
      }}
      contentClassName="max-w-7xl mx-auto"
    >
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome back, {owner?.name || "Owner"}!</h1>
          <p className="text-sm text-slate-500 mt-1">Here's what's happening with your properties today.</p>
        </div>
      </div>

      {errorMsg ? <div className="text-sm text-red-600 mb-4">{errorMsg}</div> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-xl shadow-lg text-white relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-orange-100 text-sm font-medium">Tenants</p>
            <h3 className="text-3xl font-bold mt-2">{loading ? "0" : tenantsCount}</h3>
          </div>
          <div className="absolute right-4 top-4 opacity-20 group-hover:scale-110 transition-transform duration-300">
            <i data-lucide="users" className="w-12 h-12"></i>
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-xl shadow-lg text-white relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-purple-100 text-sm font-medium">Rooms</p>
            <h3 className="text-3xl font-bold mt-2">{loading ? "0" : roomsCount}</h3>
          </div>
          <div className="absolute right-4 top-4 opacity-20 group-hover:scale-110 transition-transform duration-300">
            <i data-lucide="bed-double" className="w-12 h-12"></i>
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-xl shadow-lg text-white relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-green-100 text-sm font-medium">Rent Collected</p>
            <h3 className="text-3xl font-bold mt-2">{`Rs ${loading ? "0" : rentTotal}`}</h3>
          </div>
          <div className="absolute right-4 top-4 opacity-20 group-hover:scale-110 transition-transform duration-300">
            <i data-lucide="indian-rupee" className="w-12 h-12"></i>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="owner-occupancy-card bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="owner-occupancy-header flex justify-between items-center mb-6">
            <h3 className="font-bold text-gray-800">Occupancy Overview</h3>
            <select className="text-xs border-gray-300 rounded text-gray-600">
              <option>This Month</option>
              <option>Last Month</option>
            </select>
          </div>
          <div
            className="owner-occupancy-grid grid grid-cols-1 gap-6 items-center"
            style={{ gridTemplateColumns: "minmax(0, 280px) minmax(0, 1fr)" }}
          >
            <div className="owner-occupancy-chart-wrap flex items-center justify-center">
              <div className="owner-occupancy-donut relative h-64 w-64">
                <div className="absolute inset-0 rounded-full shadow-inner" style={pieStyle}></div>
                <div className="owner-occupancy-donut-center absolute inset-[22%] rounded-full bg-white border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center px-4">
                  <p className="text-[11px] uppercase tracking-wider text-gray-400">Owner Rooms</p>
                  <p className="text-2xl font-bold text-gray-900">{chartTotal || 0}</p>
                  <p className="text-xs text-gray-500">total from data</p>
                </div>
              </div>
            </div>
            <div className="owner-occupancy-details space-y-4">
              <div className="owner-occupancy-stats grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-purple-100 bg-purple-50 p-4">
                  <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Occupied</p>
                  <p className="mt-2 text-2xl font-bold text-purple-900">{occupiedRooms}</p>
                  <p className="text-xs text-purple-600">{occupiedPercent}% of rooms</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Not Occupied</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">{notOccupiedRooms}</p>
                  <p className="text-xs text-gray-500">{notOccupiedPercent}% of rooms</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Total</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{chartTotal || 0}</p>
                  <p className="text-xs text-slate-500">rooms tracked</p>
                </div>
              </div>
              <div className="owner-occupancy-legend flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-purple-500"></span>
                  <span className="text-gray-600">Occupied rooms</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-gray-300"></span>
                  <span className="text-gray-600">Not occupied rooms</span>
                </div>
              </div>
              <p className="owner-occupancy-note text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-4">
                This pie chart shows owner room data at a glance, so you can quickly see how many rooms are occupied and how many are not occupied.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PropertyOwnerLayout>
  );
}
