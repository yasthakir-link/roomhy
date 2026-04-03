import React, { useEffect, useMemo, useState } from "react";
import { getWebsiteApiUrl } from "../../utils/websiteSession";

const rootStyle = {
  marginTop: "4rem",
  background: "#0a0a0a",
  color: "#f5f5f5",
  borderTop: "1px solid #2a2a2a",
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
};

const headingStyle = {
  margin: 0,
  fontSize: "11px",
  fontWeight: 800,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "#a3a3a3"
};

const linkStyle = {
  color: "#f5f5f5",
  textDecoration: "none",
  fontSize: "14px",
  lineHeight: 1.6,
  opacity: 0.82
};

const cityButtonStyle = {
  width: "100%",
  background: "transparent",
  color: "#f5f5f5",
  border: "1px solid #262626",
  borderRadius: "16px",
  padding: "0.95rem 1rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: 700,
  transition: "all 0.2s ease"
};

const areaLinkStyle = {
  color: "#d4d4d4",
  textDecoration: "none",
  fontSize: "13px",
  lineHeight: 1.55,
  display: "block",
  padding: "0.15rem 0"
};

function normalizeCityName(city) {
  return String(city?.name || city?.cityName || city?.city || "").trim();
}

function normalizeAreaCity(area) {
  return String(
    area?.cityName ||
    area?.city?.name ||
    area?.city?.cityName ||
    area?.city ||
    ""
  ).trim();
}

function groupAreasByCity(cities, areas) {
  return cities.map((city) => {
    const cityId = String(city?._id || city?.id || "");
    const cityName = normalizeCityName(city);
    const matchedAreas = areas.filter((area) => {
      const areaCityId = String(area?.cityId || area?.city?._id || area?.city?.id || "");
      const areaCityName = normalizeAreaCity(area);
      return (cityId && areaCityId && areaCityId === cityId) || (cityName && areaCityName.toLowerCase() === cityName.toLowerCase());
    });

    return {
      id: cityId || cityName,
      name: cityName || "City",
      state: String(city?.state || "").trim(),
      areas: matchedAreas
        .map((area) => ({
          id: String(area?._id || area?.id || area?.name || Math.random()),
          name: String(area?.name || area?.areaName || "").trim()
        }))
        .filter((area) => area.name)
    };
  }).filter((city) => city.name);
}

function FooterLinks({ heading, links }) {
  return (
    <div>
      <h4 style={headingStyle}>{heading}</h4>
      <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.65rem" }}>
        {links.map(({ href, label }) => (
          <a
            key={`${heading}-${label}`}
            href={href}
            style={linkStyle}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.82"; }}
          >
            {label}
          </a>
        ))}
      </div>
    </div>
  );
}

export default function WebsiteFooter() {
  const [cities, setCities] = useState([]);
  const [areas, setAreas] = useState([]);
  const [openCity, setOpenCity] = useState("");
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 980 : false
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLocations = async () => {
      try {
        setLoading(true);
        const apiBase = getWebsiteApiUrl();
        const [cityRes, areaRes] = await Promise.all([
          fetch(`${apiBase}/api/locations/cities`),
          fetch(`${apiBase}/api/locations/areas`)
        ]);

        const cityPayload = cityRes.ok ? await cityRes.json() : { data: [] };
        const areaPayload = areaRes.ok ? await areaRes.json() : { data: [] };
        setCities(Array.isArray(cityPayload?.data) ? cityPayload.data : []);
        setAreas(Array.isArray(areaPayload?.data) ? areaPayload.data : []);
      } catch (error) {
        console.error("Footer location fetch failed:", error);
        setCities([]);
        setAreas([]);
      } finally {
        setLoading(false);
      }
    };

    loadLocations();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onResize = () => setIsMobile(window.innerWidth < 980);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const cityAreaGroups = useMemo(() => groupAreasByCity(cities, areas), [cities, areas]);

  useEffect(() => {
    if (!openCity && cityAreaGroups.length) {
      setOpenCity(cityAreaGroups[0].id);
    }
  }, [cityAreaGroups, openCity]);

  const topGridStyle = {
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "1.45fr 1.6fr 1fr 1fr 1fr",
    gap: isMobile ? "2rem" : "2.25rem",
    padding: isMobile ? "2.25rem 1.25rem" : "3.5rem 3rem 2.75rem",
    borderBottom: "1px solid #202020"
  };

  return (
    <footer data-roomhy-shared-footer="1" style={rootStyle}>
      <div style={topGridStyle}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "14px", border: "1px solid #3a3a3a", background: "#ffffff", color: "#000000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", fontWeight: 900 }}>
              R
            </div>
            <div>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, letterSpacing: "-0.03em", color: "#ffffff" }}>Roomhy</div>
              <div style={{ fontSize: "12px", color: "#a3a3a3", letterSpacing: "0.08em", textTransform: "uppercase" }}>Black Label Stays</div>
            </div>
          </div>
          <p style={{ margin: 0, maxWidth: "280px", color: "#cfcfcf", fontSize: "14px", lineHeight: 1.8 }}>
            Clean, broker-free stays across verified locations. Explore cities and discover areas listed by the Roomhy team.
          </p>
        </div>

        <div>
          <h4 style={headingStyle}>Cities & Areas</h4>
          <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.7rem" }}>
            {!loading && cityAreaGroups.length === 0 && (
              <div style={{ color: "#a3a3a3", fontSize: "13px", lineHeight: 1.7 }}>Locations will appear here once added in superadmin.</div>
            )}

            {cityAreaGroups.map((city) => {
              const isOpen = openCity === city.id;
              return (
                <div key={city.id}>
                  <button
                    type="button"
                    onClick={() => setOpenCity((prev) => prev === city.id ? "" : city.id)}
                    style={{
                      ...cityButtonStyle,
                      background: isOpen ? "#ffffff" : "transparent",
                      color: isOpen ? "#0a0a0a" : "#f5f5f5",
                      borderColor: isOpen ? "#ffffff" : "#262626"
                    }}
                  >
                    <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.1rem" }}>
                      <span>{city.name}</span>
                      {city.state ? (
                        <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.68 }}>
                          {city.state}
                        </span>
                      ) : null}
                    </span>
                    <span style={{ fontSize: "18px", lineHeight: 1, transform: isOpen ? "rotate(45deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}>+</span>
                  </button>

                  {isOpen && (
                    <div style={{ marginTop: "0.6rem", padding: "0.35rem 0 0.25rem 1rem", borderLeft: "1px solid #3a3a3a" }}>
                      {city.areas.length > 0 ? (
                        city.areas.map((area) => (
                          <a
                            key={area.id}
                            href={`/website/ourproperty?city=${encodeURIComponent(city.name)}&area=${encodeURIComponent(area.name)}`}
                            style={areaLinkStyle}
                            onMouseEnter={(e) => { e.currentTarget.style.color = "#ffffff"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = "#d4d4d4"; }}
                          >
                            {area.name}
                          </a>
                        ))
                      ) : (
                        <a
                          href={`/website/ourproperty?city=${encodeURIComponent(city.name)}`}
                          style={areaLinkStyle}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "#ffffff"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "#d4d4d4"; }}
                        >
                          View properties in {city.name}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <FooterLinks
          heading="Explore"
          links={[
            { label: "Find a PG", href: "/website/ourproperty?type=PG" },
            { label: "Hostels", href: "/website/ourproperty?type=Hostel" },
            { label: "Apartments", href: "/website/ourproperty?type=Apartment" },
            { label: "Fast Bidding", href: "/website/fast-bidding" },
            { label: "List Property", href: "/website/list" }
          ]}
        />

        <FooterLinks
          heading="Company"
          links={[
            { label: "About Us", href: "/website/about" },
            { label: "Contact Us", href: "/website/contact" },
            { label: "Privacy Policy", href: "/website/privacy" },
            { label: "Terms of Service", href: "/website/terms" },
            { label: "Refund Policy", href: "/website/refund" }
          ]}
        />

        <FooterLinks
          heading="Account"
          links={[
            { label: "Sign Up", href: "/website/signup" },
         
            { label: "Favorites", href: "/website/fav" },
            { label: "My Stays", href: "/website/mystays" },
            { label: "Profile", href: "/website/profile" }
          ]}
        />
      </div>

      <div
        style={{
          padding: isMobile ? "1.25rem" : "1.5rem 3rem",
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "flex-start" : "center",
          justifyContent: "space-between",
          gap: "0.9rem",
          background: "#050505"
        }}
      >
        <p style={{ margin: 0, fontSize: "12px", color: "#9f9f9f", letterSpacing: "0.04em" }}>
          © {new Date().getFullYear()} Roomhy. All rights reserved.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
          {["Instagram", "Facebook", "Twitter", "LinkedIn"].map((item) => (
            <a
              key={item}
              href="#"
              style={{ color: "#d4d4d4", textDecoration: "none", fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#ffffff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#d4d4d4"; }}
            >
              {item}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
