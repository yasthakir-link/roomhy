import React, { useState, useEffect } from "react";

const getApiBase = () => {
  if (typeof window === "undefined") return "";
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = window.location.port;
  const baseUrl = port ? `${protocol}//${hostname}:${port}` : `${protocol}//${hostname}`;
  return baseUrl;
};

// Black & White theme styles for professional look
const footerStyle = {
  backgroundColor: "#ffffff",
  color: "#4a4a4a",
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  borderTop: "2px solid #000000",
  marginTop: "4rem",
  boxShadow: "0 -1px 3px rgba(0, 0, 0, 0.08)"
};

const desktopGridStyle = {
  display: "grid",
  gridTemplateColumns: "1.5fr 1.2fr 1.2fr 1.2fr 1.2fr 1.2fr",
  gap: "48px",
  padding: "72px 64px 60px",
  borderBottom: "1px solid #e5e5e5"
};

const mobileGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: "32px",
  padding: "40px 24px 32px",
  borderBottom: "1px solid #e5e5e5"
};

const headingStyle = {
  color: "#000000",
  fontSize: "12px",
  fontWeight: "700",
  margin: "0 0 24px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  opacity: 0.85
};

const cityButtonBaseStyle = {
  background: "none",
  border: "none",
  padding: "8px 0",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  fontSize: "13px",
  transition: "all 0.2s ease",
  fontWeight: "500"
};

const areaLinkStyle = {
  fontSize: "13px",
  textDecoration: "none",
  transition: "all 0.15s ease",
  display: "block",
  lineHeight: "1.6",
  color: "#666666"
};

export default function WebsiteFooter() {
  const [cities, setCities] = useState([]);
  const [areas, setAreas] = useState([]);
  const [selectedCity, setSelectedCity] = useState(null);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 960 : false
  );
  const [loading, setLoading] = useState(true);

  // Fetch cities and areas on mount
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const apiBase = getApiBase();
        const [citiesRes, areasRes] = await Promise.all([
          fetch(`${apiBase}/api/locations/cities`),
          fetch(`${apiBase}/api/locations/areas`)
        ]);

        if (citiesRes.ok && areasRes.ok) {
          const citiesData = await citiesRes.json();
          const areasData = await areasRes.json();
          
          setCities(citiesData?.data || []);
          setAreas(areasData?.data || []);
        }
      } catch (error) {
        console.error("Error fetching locations:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLocations();
  }, []);

  // Handle window resize
  React.useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 960);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Get areas for a specific city
  const getAreasForCity = (cityId) => {
    return areas.filter((area) => area.cityId === cityId || area.city === cityId);
  };

  // Get city name by ID
  const getCityName = (cityId) => {
    return cities.find((c) => c._id === cityId)?.name || cityId;
  };

  return (
    <footer data-roomhy-shared-footer="1" style={footerStyle}>
      <div style={isMobile ? mobileGridStyle : desktopGridStyle}>
        {/* Brand Section */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "4px",
                backgroundColor: "#000000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              <span style={{ color: "#ffffff", fontSize: "22px", fontWeight: "800" }}>R</span>
            </div>
            <span style={{ color: "#000000", fontSize: "18px", fontWeight: "800", letterSpacing: "-0.5px" }}>
              Roomhy
            </span>
          </div>
          <p
            style={{
              color: "#666666",
              fontSize: "13px",
              lineHeight: "1.8",
              margin: 0,
              maxWidth: "240px",
              fontWeight: "400"
            }}
          >
            Find your perfect room, hostel, or apartment across major Indian cities.
          </p>
        </div>

        {/* Cities with Areas Dropdown */}
        {!loading && cities.length > 0 && (
          <div>
            <h4 style={headingStyle}>Cities & Areas</h4>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
              {cities.slice(0, 8).map((city) => {
                const isOpen = selectedCity === city._id;
                const cityAreas = getAreasForCity(city._id);

                return (
                  <li key={city._id}>
                    <button
                      onClick={() => setSelectedCity((prev) => (prev === city._id ? null : city._id))}
                      style={{
                        ...cityButtonBaseStyle,
                        color: isOpen ? "#000000" : "#4a4a4a"
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            backgroundColor: isOpen ? "#000000" : "#cccccc",
                            transition: "all 0.2s ease",
                            flexShrink: 0
                          }}
                        />
                        <span style={{ fontWeight: isOpen ? "600" : "500" }}>{city.name}</span>
                      </span>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        style={{
                          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.3s ease",
                          flexShrink: 0
                        }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {isOpen && cityAreas.length > 0 && (
                      <ul
                        style={{
                          listStyle: "none",
                          margin: "8px 0 12px 14px",
                          padding: "8px 0 8px 12px",
                          borderLeft: "2px solid #000000",
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px"
                        }}
                      >
                        {cityAreas.slice(0, 5).map((area) => (
                          <li key={area._id}>
                            <a
                              href={`/website/ourproperty?city=${encodeURIComponent(city.name)}&area=${encodeURIComponent(
                                area.name
                              )}`}
                              style={areaLinkStyle}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = "#000000";
                                e.currentTarget.style.fontWeight = "600";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = "#666666";
                                e.currentTarget.style.fontWeight = "400";
                              }}
                            >
                              {area.name}
                            </a>
                          </li>
                        ))}
                        {cityAreas.length > 5 && (
                          <li>
                            <a
                              href={`/website/ourproperty?city=${encodeURIComponent(city.name)}`}
                              style={{
                                ...areaLinkStyle,
                                color: "#000000",
                                fontSize: "12px",
                                fontWeight: "600",
                                marginTop: "4px"
                              }}
                            >
                              View all {cityAreas.length} areas →
                            </a>
                          </li>
                        )}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <NavCol
          heading="Pages"
          links={[
            { label: "Find a PG", href: "/website/ourproperty?type=PG" },
            { label: "Hostels", href: "/website/ourproperty?type=Hostel" },
            { label: "Apartments", href: "/website/ourproperty?type=Apartment" },
            { label: "Fast Bidding", href: "/website/fast-bidding" },
            { label: "List Property", href: "/website/list" },
            { label: "About Us", href: "/website/about" }
          ]}
        />

        <NavCol
          heading="Company"
          links={[
            { label: "Contact Us", href: "/website/contact" },
            { label: "Support", href: "#" },
            { label: "Blog", href: "#" },
            { label: "Careers", href: "#" },
            { label: "FAQ", href: "#" }
          ]}
        />

        <NavCol
          heading="Legal"
          links={[
            { label: "Privacy Policy", href: "/website/privacy" },
            { label: "Terms of Service", href: "/website/terms" },
            { label: "Cookie Policy", href: "#" },
            { label: "Sitemap", href: "/sitemap.xml" }
          ]}
        />

        <NavCol
          heading="Account"
          links={[
            { label: "Sign Up", href: "/website/signup" },
            { label: "Login", href: "/website/login" },
            { label: "List Property", href: "/website/signuprole" },
            { label: "My Bookings", href: "/website/mystays-bookings" },
            { label: "Profile", href: "/website/profile" }
          ]}
        />
      </div>

      {/* Bottom Section */}
      <div
        style={{
          padding: isMobile ? "32px 24px" : "48px 64px",
          backgroundColor: "#f5f5f5",
          borderTop: "1px solid #e5e5e5",
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          justifyContent: "space-between",
          alignItems: isMobile ? "flex-start" : "center",
          gap: isMobile ? "20px" : "0"
        }}
      >
        <p
          style={{
            margin: 0,
            color: "#666666",
            fontSize: "13px",
            fontWeight: "400"
          }}
        >
          © {new Date().getFullYear()} Roomhy. All rights reserved.
        </p>
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          <a href="#" style={{ color: "#4a4a4a", textDecoration: "none", fontSize: "13px", transition: "color 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.color = "#000000"} onMouseLeave={(e) => e.currentTarget.style.color = "#4a4a4a"}>
            Facebook
          </a>
          <a href="#" style={{ color: "#4a4a4a", textDecoration: "none", fontSize: "13px", transition: "color 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.color = "#000000"} onMouseLeave={(e) => e.currentTarget.style.color = "#4a4a4a"}>
            Instagram
          </a>
          <a href="#" style={{ color: "#4a4a4a", textDecoration: "none", fontSize: "13px", transition: "color 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.color = "#000000"} onMouseLeave={(e) => e.currentTarget.style.color = "#4a4a4a"}>
            Twitter
          </a>
          <a href="#" style={{ color: "#4a4a4a", textDecoration: "none", fontSize: "13px", transition: "color 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.color = "#000000"} onMouseLeave={(e) => e.currentTarget.style.color = "#4a4a4a"}>
            LinkedIn
          </a>
        </div>
      </div>
    </footer>
  );
}

function NavCol({ heading, links }) {
  return (
    <div>
      <h4 style={headingStyle}>{heading}</h4>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
        {links.map(({ label, href }) => (
          <li key={label}>
            <a
              href={href}
              style={{
                color: "#4a4a4a",
                fontSize: "13px",
                textDecoration: "none",
                transition: "all 0.2s ease",
                fontWeight: "400",
                display: "inline-block"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#000000";
                e.currentTarget.style.fontWeight = "600";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#4a4a4a";
                e.currentTarget.style.fontWeight = "400";
              }}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
