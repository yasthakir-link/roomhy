import React, { useEffect, useMemo, useState } from "react";
import PropertyOwnerLayout from "../../components/propertyowner/PropertyOwnerLayout";
import { useHtmlPage } from "../../utils/htmlPage";
import {
  clearOwnerRuntimeSession,
  deleteTenantRecord,
  downloadCsv,
  fetchAllTenants,
  fetchPropertyMap,
  formatDate,
  getOwnerRuntimeSession,
  normalizeTenant
} from "../../utils/propertyowner";

export default function Tenantrec() {
  useHtmlPage({
    title: "Roomhy - Tenant Records",
    bodyClass: "text-slate-800",
    htmlAttrs: { lang: "en" },
    metas: [{ charset: "UTF-8" }],
    links: [
      {
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
        rel: "stylesheet"
      },
      { rel: "stylesheet", href: "/propertyowner/assets/css/tenantrec.css" }
    ],
    scripts: [{ src: "https://cdn.tailwindcss.com" }, { src: "https://unpkg.com/lucide@latest" }],
    inlineScripts: []
  });

  const [owner, setOwner] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [selectedTenant, setSelectedTenant] = useState(null);

  useEffect(() => {
    if (window.lucide?.createIcons) window.lucide.createIcons();
  }, [tenants, loading, search, selectedTenant]);

  const loadTenants = async (session) => {
    setLoading(true);
    setErrorMsg("");
    try {
      const [list, propertyMap] = await Promise.all([fetchAllTenants(), fetchPropertyMap()]);
      const ownerId = String(session.loginId || "").toUpperCase();
      const filtered = list
        .map((tenant) => normalizeTenant(tenant, propertyMap))
        .filter((tenant) => {
          const ownerLogin =
            tenant.propertyObj?.ownerLoginId ||
            tenant.ownerLoginId ||
            tenant.propertyObj?.owner ||
            tenant.owner;
          return ownerLogin ? String(ownerLogin).toUpperCase() === ownerId : true;
        });
      setTenants(filtered);
    } catch (err) {
      setErrorMsg(err?.body || err?.message || "Failed to load tenant records.");
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
    loadTenants(session);
  }, []);

  const visibleTenants = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tenants;
    return tenants.filter((tenant) =>
      [
        tenant.displayName,
        tenant.loginId,
        tenant.phone,
        tenant.email,
        tenant.propertyTitle,
        tenant.roomNumber
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [tenants, search]);

  const exportToExcel = () => {
    downloadCsv(
      "tenant-records.csv",
      visibleTenants.map((tenant) => ({
        "Tenant Identity": tenant.displayName,
        "Login ID": tenant.loginId,
        "Phone": tenant.phone,
        "Email": tenant.email,
        "Property": tenant.propertyTitle,
        "Room": tenant.roomNumber,
        "Rent": tenant.rent,
        "Location Code": tenant.locationCode,
        "Move In Date": formatDate(tenant.moveInDate),
        "Move Out Date": formatDate(tenant.moveOutDate),
        Status: tenant.status,
        "KYC Status": tenant.kycStatus
      }))
    );
  };

  const moveOutTenant = (loginId) => {
    setTenants((prev) =>
      prev.map((tenant) =>
        tenant.loginId === loginId ? { ...tenant, status: "moved out", moveOutDate: new Date().toISOString() } : tenant
      )
    );
  };

  const permanentlyDeleteTenant = async (tenant) => {
    if (!window.confirm("Permanently delete this record? This cannot be undone.")) return;
    try {
      const deleteId = tenant._id || tenant.id;
      if (deleteId) {
        await deleteTenantRecord(deleteId);
      }
      setTenants((prev) => prev.filter((item) => item.key !== tenant.key));
    } catch (err) {
      setErrorMsg(err?.body || err?.message || "Failed to delete tenant.");
    }
  };

  const formatDetailValue = (value) => {
    if (value === null || typeof value === "undefined" || value === "") return "-";
    if (value instanceof Date) return formatDate(value);
    if (Array.isArray(value)) return value.length ? JSON.stringify(value, null, 2) : "-";
    if (typeof value === "object") {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return "-";
      }
    }
    return String(value);
  };

  const humanizeKey = (key) =>
    String(key || "")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^./, (char) => char.toUpperCase());

  const renderValueNode = (value) => {
    if (value === null || typeof value === "undefined" || value === "") {
      return <span className="text-slate-400">-</span>;
    }
    if (typeof value === "boolean") {
      return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${value ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>
          {value ? "Yes" : "No"}
        </span>
      );
    }
    if (Array.isArray(value)) {
      if (!value.length) return <span className="text-slate-400">-</span>;
      return (
        <div className="flex flex-wrap gap-2">
          {value.map((item, index) => (
            <span key={index} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
              {typeof item === "object" ? formatDetailValue(item) : String(item)}
            </span>
          ))}
        </div>
      );
    }
    if (typeof value === "object") {
      const entries = Object.entries(value).filter(([, child]) => child !== null && typeof child !== "undefined" && child !== "");
      if (!entries.length) return <span className="text-slate-400">-</span>;
      return (
        <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          {entries.map(([childKey, childValue]) => (
            <div key={childKey} className="grid grid-cols-1 gap-1 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{humanizeKey(childKey)}</span>
              <div className="text-sm text-slate-700 whitespace-pre-wrap break-words">{renderValueNode(childValue)}</div>
            </div>
          ))}
        </div>
      );
    }
    return <span className="whitespace-pre-wrap break-words text-slate-700">{formatDetailValue(value)}</span>;
  };

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const buildPrintableHtml = (tenant) => {
    const entries = Object.entries(tenant || {}).filter(([key, value]) =>
      !["key"].includes(key) && typeof value !== "function"
    );
    const buildPrintableValueHtml = (value) => {
      if (value === null || typeof value === "undefined" || value === "") return '<span style="color:#94a3b8;">-</span>';
      if (typeof value === "boolean") {
        return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:${value ? "#dcfce7" : "#e2e8f0"};color:${value ? "#15803d" : "#475569"};">${value ? "Yes" : "No"}</span>`;
      }
      if (Array.isArray(value)) {
        if (!value.length) return '<span style="color:#94a3b8;">-</span>';
        return `<div style="display:flex;flex-wrap:wrap;gap:6px;">${value
          .map((item) => `<span style="display:inline-block;background:#f1f5f9;color:#334155;border-radius:999px;padding:4px 10px;font-size:12px;">${escapeHtml(typeof item === "object" ? formatDetailValue(item) : String(item))}</span>`)
          .join("")}</div>`;
      }
      if (typeof value === "object") {
        const childEntries = Object.entries(value).filter(([, child]) => child !== null && typeof child !== "undefined" && child !== "");
        if (!childEntries.length) return '<span style="color:#94a3b8;">-</span>';
        return `
          <div style="border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;padding:12px;">
            ${childEntries
              .map(
                ([childKey, childValue]) => `
                  <div style="display:grid;grid-template-columns:180px minmax(0,1fr);gap:12px;padding:6px 0;border-bottom:1px solid #e2e8f0;">
                    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#64748b;">${escapeHtml(humanizeKey(childKey))}</div>
                    <div style="font-size:13px;color:#334155;white-space:pre-wrap;word-break:break-word;">${buildPrintableValueHtml(childValue)}</div>
                  </div>
                `
              )
              .join("")}
          </div>
        `;
      }
      return escapeHtml(formatDetailValue(value));
    };
    const rows = entries
      .map(
        ([key, value]) => `
          <tr>
            <td style="padding:10px 12px;border:1px solid #e5e7eb;background:#f8fafc;font-weight:600;vertical-align:top;width:220px;">${escapeHtml(key)}</td>
            <td style="padding:10px 12px;border:1px solid #e5e7eb;white-space:pre-wrap;word-break:break-word;">${buildPrintableValueHtml(value)}</td>
          </tr>
        `
      )
      .join("");

    return `
      <html>
        <head>
          <title>Tenant Details - ${tenant?.displayName || tenant?.name || "Tenant"}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1 { margin: 0 0 8px; font-size: 24px; }
            p { margin: 0 0 18px; color: #6b7280; }
            table { width: 100%; border-collapse: collapse; font-size: 14px; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h1>Tenant Details</h1>
          <p>${tenant?.displayName || tenant?.name || "Tenant"}${tenant?.loginId ? ` | ${tenant.loginId}` : ""}</p>
          <table>${rows}</table>
          <script>window.onload = function () { window.print(); window.onafterprint = function () { window.close(); }; };</script>
        </body>
      </html>
    `;
  };

  const printTenantDetails = (tenant) => {
    const popup = window.open("", "_blank", "noopener,noreferrer,width=900,height=900");
    if (!popup) {
      window.alert("Please allow popups to print tenant details.");
      return;
    }
    popup.document.open();
    popup.document.write(buildPrintableHtml(tenant));
    popup.document.close();
  };

  return (
    <PropertyOwnerLayout
      owner={owner}
      title="Tenant Records"
      navVariant="default"
      headerRight={(
        <div className="relative hidden md:block">
          <input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Tenant, ID, Phone..." className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none w-64" />
          <i data-lucide="search" className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"></i>
        </div>
      )}
      notificationCount={visibleTenants.filter((tenant) => String(tenant.kycStatus).toLowerCase() !== "verified").length}
      onLogout={() => {
        clearOwnerRuntimeSession();
        window.location.href = "/propertyowner/ownerlogin";
      }}
      contentClassName="max-w-[1600px] mx-auto"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Detailed Tenant Records</h1>
          <p className="text-sm text-slate-500 mt-1">View full history, login credentials, guardian info, and status.</p>
        </div>
        <button type="button" onClick={exportToExcel} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium shadow-sm flex items-center">
          <i data-lucide="download" className="w-4 h-4 mr-2"></i>
          Export List
        </button>
      </div>

      <div className="relative mb-4 md:hidden">
        <input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Tenant, ID, Phone..." className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none w-full" />
        <i data-lucide="search" className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"></i>
      </div>

      {errorMsg ? <div className="text-sm text-red-600 mb-4">{errorMsg}</div> : null}

      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full data-table" id="tenantTable">
            <thead>
              <tr>
                <th>Tenant Identity</th>
                <th>Login Credentials</th>
                <th>Personal Details</th>
                <th>Room &amp; Rent</th>
                <th>Location Code</th>
                <th>Move In / Out</th>
                <th>Status</th>
                <th>KYC Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="all-tenants-body">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-500">Loading tenant records...</td>
                </tr>
              ) : null}
              {!loading && visibleTenants.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-500">No tenant records found.</td>
                </tr>
              ) : null}
              {!loading && visibleTenants.map((tenant) => (
                <tr key={tenant.key}>
                  <td>
                    <div className="font-semibold text-gray-900">{tenant.displayName}</div>
                    <div className="text-xs text-gray-500">{tenant.phone}</div>
                  </td>
                  <td>
                    <div className="font-medium text-gray-800">{tenant.loginId}</div>
                    <div className="text-xs text-gray-500">{tenant.email}</div>
                  </td>
                  <td>
                    <div>{tenant.gender || "-"}</div>
                    <div className="text-xs text-gray-500">{tenant.guardianName || tenant.address || "-"}</div>
                  </td>
                  <td>
                    <div className="font-medium">{tenant.roomNumber}</div>
                    <div className="text-xs text-gray-500">{tenant.rent}</div>
                    <div className="text-xs text-gray-500">{tenant.propertyTitle}</div>
                  </td>
                  <td>{tenant.locationCode}</td>
                  <td>
                    <div className="text-xs text-gray-700">{`In: ${formatDate(tenant.moveInDate)}`}</div>
                    <div className="text-xs text-red-600">{`Out: ${formatDate(tenant.moveOutDate)}`}</div>
                  </td>
                  <td>
                    <span className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${String(tenant.status).toLowerCase().includes("move") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                      {tenant.status}
                    </span>
                  </td>
                  <td>
                    <span className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${String(tenant.kycStatus).toLowerCase() === "verified" ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
                      {tenant.kycStatus}
                    </span>
                  </td>
                  <td>
                    <div className="flex justify-end items-center gap-2">
                      <button type="button" onClick={() => setSelectedTenant(tenant)} className="flex items-center gap-1 text-xs bg-purple-600 text-white hover:bg-purple-700 px-3 py-1.5 rounded transition shadow-sm">
                        View Details
                      </button>
                      <button type="button" onClick={() => moveOutTenant(tenant.loginId)} className="flex items-center gap-1 text-xs bg-white border border-red-200 text-red-600 hover:bg-red-50 px-2 py-1 rounded transition shadow-sm">
                        Move Out
                      </button>
                      <button type="button" onClick={() => permanentlyDeleteTenant(tenant)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded transition" title="Permanently Delete">
                        <i data-lucide="trash-2" className="w-4 h-4"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTenant ? (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedTenant(null)}
        >
          <div
            className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 p-5 border-b border-slate-200">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Tenant Details</h3>
                <p className="text-sm text-slate-500 mt-1">{selectedTenant.displayName || selectedTenant.name || "-"}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => printTenantDetails(selectedTenant)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-black"
                >
                  <i data-lucide="printer" className="w-4 h-4"></i>
                  Print
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTenant(null)}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                  aria-label="Close details"
                >
                  <i data-lucide="x" className="w-5 h-5"></i>
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Basic Info</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <p><span className="font-medium text-slate-700">Name:</span> {selectedTenant.displayName || "-"}</p>
                    <p><span className="font-medium text-slate-700">Login ID:</span> {selectedTenant.loginId || "-"}</p>
                    <p><span className="font-medium text-slate-700">Phone:</span> {selectedTenant.phone || "-"}</p>
                    <p><span className="font-medium text-slate-700">Email:</span> {selectedTenant.email || "-"}</p>
                    <p><span className="font-medium text-slate-700">Gender:</span> {selectedTenant.gender || "-"}</p>
                    <p><span className="font-medium text-slate-700">Status:</span> {selectedTenant.status || "-"}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Property Info</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <p><span className="font-medium text-slate-700">Property:</span> {selectedTenant.propertyTitle || "-"}</p>
                    <p><span className="font-medium text-slate-700">Room:</span> {selectedTenant.roomNumber || "-"}</p>
                    <p><span className="font-medium text-slate-700">Rent:</span> {selectedTenant.rent || "-"}</p>
                    <p><span className="font-medium text-slate-700">Location Code:</span> {selectedTenant.locationCode || "-"}</p>
                    <p><span className="font-medium text-slate-700">Move In:</span> {formatDate(selectedTenant.moveInDate)}</p>
                    <p><span className="font-medium text-slate-700">Move Out:</span> {formatDate(selectedTenant.moveOutDate)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                  <p className="text-sm font-semibold text-slate-800">All Stored Fields</p>
                  <p className="text-xs text-slate-500 mt-1">This shows every value available in the tenant record.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <tbody>
                      {Object.entries(selectedTenant)
                        .filter(([key, value]) => key !== "key" && typeof value !== "function")
                        .map(([key, value]) => (
                          <tr key={key} className="border-t border-slate-100">
                            <td className="w-56 bg-slate-50 px-4 py-3 align-top font-medium text-slate-700">{humanizeKey(key)}</td>
                            <td className="px-4 py-3 whitespace-pre-wrap break-words text-slate-600">{renderValueNode(value)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </PropertyOwnerLayout>
  );
}
