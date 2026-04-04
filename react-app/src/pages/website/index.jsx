import React, { useEffect } from "react";
import WebsiteFooter from "../../components/website/WebsiteFooter";
import templateHtml from "./index.template.html?raw";
import { useHtmlPage } from "../../utils/htmlPage";
import { buildOrganizationJsonLd, buildSeoConfig, buildWebsiteJsonLd } from "../../utils/websiteSeo";
import { useWebsiteCommon } from "../../utils/websiteUi";

const parseAttributes = (input = "") => {
  const attrs = {};
  const regex = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let match;

  while ((match = regex.exec(input))) {
    const key = match[1];
    if (!key || key === "/" || key.endsWith("/")) {
      continue;
    }
    const value = match[2] ?? match[3] ?? match[4];
    attrs[key] = value ?? true;
  }

  return attrs;
};

const withWebsiteAssetPrefix = (value) => {
  if (!value || typeof value !== "string") return value;
  if (
    value.startsWith("/") ||
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("mailto:") ||
    value.startsWith("tel:") ||
    value.startsWith("#") ||
    value.startsWith("data:")
  ) {
    return value;
  }

  if (
    value.startsWith("assets/") ||
    value.startsWith("js/") ||
    value.startsWith("images/") ||
    value.startsWith("css/")
  ) {
    return `/website/${value}`;
  }

  return value;
};

const rewriteBodyAssetPaths = (html) =>
  html.replace(
    /\b(href|src)=("([^"]+)"|'([^']+)')/gi,
    (full, attr, wrappedValue, doubleQuoted, singleQuoted) => {
      const originalValue = doubleQuoted ?? singleQuoted ?? "";
      const rewrittenValue = withWebsiteAssetPrefix(originalValue);
      if (rewrittenValue === originalValue) return full;
      const quote = doubleQuoted != null ? '"' : "'";
      return `${attr}=${quote}${rewrittenValue}${quote}`;
    }
  );

const serializeAttributes = (attrs = {}) =>
  Object.entries(attrs)
    .filter(([, value]) => value !== false && value != null)
    .map(([key, value]) => (value === true ? key : `${key}="${String(value).replace(/"/g, "&quot;")}"`))
    .join(" ");

const optimizeImageSrc = (src, { width = 960, quality = 72 } = {}) => {
  if (!src || typeof src !== "string") return src;

  if (src.includes("images.unsplash.com/")) {
    const normalized = src.replace("auto:format", "auto=format");
    try {
      const url = new URL(normalized);
      url.searchParams.set("auto", "format");
      url.searchParams.set("fit", "crop");
      url.searchParams.set("q", String(quality));
      url.searchParams.set("w", String(width));
      return url.toString();
    } catch {
      return normalized;
    }
  }

  if (src.includes("res.cloudinary.com/") && src.includes("/upload/")) {
    const transform = `f_auto,q_auto,w_${width}`;
    if (src.includes("/upload/f_auto")) return src;
    return src.replace("/upload/", `/upload/${transform}/`);
  }

  return src;
};

const optimizeImageTag = (tag) => {
  const match = tag.match(/^<img\b([^>]*)>$/i);
  if (!match) return tag;

  const attrs = parseAttributes(match[1] || "");
  const alt = String(attrs.alt || "").toLowerCase();
  const className = String(attrs.class || "");
  const isLogo = alt.includes("logo");
  const isHeroPrimary = alt.includes("hero background 1");
  const isBackgroundVisual = isHeroPrimary || /^bg[123]$/.test(alt) || alt.includes("hero background");
  const isCardImage = ["hostel", "pg", "apartment", "list your property"].includes(alt);

  let width = 800;
  let height = 600;

  if (isLogo) {
    width = 180;
    height = 40;
  } else if (isBackgroundVisual || className.includes("object-cover")) {
    width = 1600;
    height = 900;
  } else if (isCardImage) {
    width = 880;
    height = 520;
  }

  attrs.decoding = "async";

  if (isHeroPrimary) {
    attrs.fetchpriority = "high";
    attrs.loading = "eager";
    attrs.src = optimizeImageSrc(attrs.src, { width: 1280, quality: 70 });
  } else {
    attrs.fetchpriority = "low";
    attrs.loading = "lazy";
    attrs.src = optimizeImageSrc(attrs.src, {
      width: isLogo ? 240 : isBackgroundVisual ? 960 : 900,
      quality: 68,
    });
  }

  if (!attrs.width) attrs.width = width;
  if (!attrs.height) attrs.height = height;

  if (isBackgroundVisual) {
    attrs.sizes = "100vw";
  } else if (isCardImage) {
    attrs.sizes = "(max-width: 768px) 100vw, 33vw";
  } else if (isLogo) {
    attrs.sizes = "180px";
  }

  return `<img ${serializeAttributes(attrs)}>`;
};

const optimizeBodyImages = (html) =>
  html.replace(/<img\b[^>]*>/gi, (tag) => optimizeImageTag(tag));

const extractTagAttributes = (tagName, source) => {
  const match = source.match(new RegExp(`<${tagName}\\b([^>]*)>`, "i"));
  return parseAttributes(match?.[1] || "");
};

const extractHeadTagEntries = (tagName, source) => {
  const regex = new RegExp(`<${tagName}\\b([^>]*)>`, "gi");
  return Array.from(source.matchAll(regex), (match) => parseAttributes(match[1] || ""));
};

const extractWrappedTagEntries = (tagName, source) => {
  const regex = new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  return Array.from(source.matchAll(regex), (match) => ({
    attrs: parseAttributes(match[1] || ""),
    content: match[2]?.trim() || "",
  }));
};

const extractBodyContent = (source) => {
  const match = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!match) return "";

  const cleanedBody = match[1]
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(
      /\bon(click|mouseover|mouseout)="([^"]*window\.location\.href\s*=\s*'([^']+)'.*?)"/gi,
      (full, eventName, handler, target) =>
        full.replace(target, withWebsiteAssetPrefix(target))
    )
    .replace(
      /\bon(click|mouseover|mouseout)='([^']*window\.location\.href\s*=\s*"([^"]+)".*?)'/gi,
      (full, eventName, handler, target) =>
        full.replace(target, withWebsiteAssetPrefix(target))
    )
    .replace(
      /\bonclick="globalLogout\(\)"/gi,
      'onclick="globalLogout()"'
    );

  return optimizeBodyImages(rewriteBodyAssetPaths(cleanedBody)).trim();
};

const PERFORMANCE_STYLES = `
  .html-page main > section {
    content-visibility: auto;
    contain-intrinsic-size: 900px;
  }

  .html-page #top-cities-categories,
  .html-page #offerings,
  .html-page #hero-image-wrapper,
  .html-page #contact-us {
    content-visibility: visible;
    contain-intrinsic-size: auto;
  }

  @media (max-width: 768px), (prefers-reduced-motion: reduce) {
    .html-page .animate-kenburns,
    .html-page .animate-slide-in,
    .html-page .animate-slide-left-infinite,
    .html-page .animate-slide-right-infinite,
    .html-page .animate-dash-flow-dotted,
    .html-page .animate-light-dot-move,
    .html-page .animate-pulse-pop,
    .html-page .animate-float-subtle {
      animation: none !important;
    }

    .html-page [class*="transition-"] {
      transition-duration: 0.01ms !important;
    }

    .html-page .animate-slide-in,
    .html-page .card-animate {
      opacity: 1 !important;
      transform: none !important;
    }
  }
`;

const title = templateHtml.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "";
const htmlAttrs = extractTagAttributes("html", templateHtml);
const bodyAttrs = extractTagAttributes("body", templateHtml);
const metas = extractHeadTagEntries("meta", templateHtml);
const links = extractHeadTagEntries("link", templateHtml).map((link) => ({
  ...link,
  href: withWebsiteAssetPrefix(link.href),
}));
const scriptEntries = extractWrappedTagEntries("script", templateHtml);
const scriptSequence = scriptEntries.map((entry) => {
  if (entry.attrs.src) {
    return {
      type: "external",
      attrs: {
        ...entry.attrs,
        src: withWebsiteAssetPrefix(entry.attrs.src),
      },
    };
  }

  return {
    type: "inline",
    content: entry.content,
  };
});
const scripts = scriptEntries
  .filter((entry) => entry.attrs.src)
  .map((entry) => ({
    ...entry.attrs,
    src: withWebsiteAssetPrefix(entry.attrs.src),
  }));
const inlineScripts = scriptEntries
  .filter((entry) => !entry.attrs.src)
  .map((entry) => entry.content)
  .filter(Boolean);
const styles = extractWrappedTagEntries("style", templateHtml)
  .map((entry) => entry.content)
  .filter(Boolean);
const bodyHtml = extractBodyContent(templateHtml);

export default function WebsiteIndex() {
  useWebsiteCommon();

  const seo = buildSeoConfig({
    title: "Roomhy | Student Rentals, PG, Hostels and Coliving in India",
    description:
      "Find verified PGs, hostels, coliving spaces and student rentals on Roomhy. Compare locations, rent, beds and availability without brokerage.",
    path: "/website/index",
    keywords: [
      "student rental website",
      "pg for rent",
      "hostel near college",
      "rooms for rent",
      "coliving in india",
      "broker free rentals",
      "roomhy"
    ],
    jsonLd: [buildOrganizationJsonLd(), buildWebsiteJsonLd()]
  });

  useHtmlPage({
    title: "Roomhy | Student Rentals, PG, Hostels and Coliving in India",
    bodyClass: bodyAttrs.class === true ? "" : bodyAttrs.class || "",
    htmlAttrs,
    metas: [...metas, ...seo.metas],
    links: [
      { rel: "preconnect", href: "https://res.cloudinary.com", crossorigin: true },
      { rel: "preconnect", href: "https://images.unsplash.com", crossorigin: true },
      { rel: "preconnect", href: "https://cdnjs.cloudflare.com", crossorigin: true },
      { rel: "preconnect", href: "https://unpkg.com", crossorigin: true },
      ...links,
      ...seo.links
    ],
    headScripts: seo.headScripts,
    scripts,
    styles: [...styles, PERFORMANCE_STYLES],
    inlineScripts,
    scriptSequence,
  });

  useEffect(() => {
    const KNOWN_CITIES = [
      "Indore",
      "Kota",
      "Sikar",
      "Bengaluru",
      "Bangalore",
      "Mumbai",
      "Delhi",
      "Pune",
      "Hyderabad",
      "Agra",
      "Jaipur",
      "Lucknow",
      "Bhopal",
      "Surat",
      "Vadodara",
      "Patna",
      "Kanpur",
      "Nagpur",
      "Visakhapatnam",
      "Chennai"
    ];
    const CITY_ALIAS = { BANGALORE: "Bengaluru" };
    const TYPE_KEYWORDS = [
      ["paying guest", "pg"],
      ["hostel", "hostel"],
      ["apartment", "apartment"],
      ["flat", "apartment"],
      ["pg", "pg"]
    ];

    const parseSearch = (raw) => {
      const q = String(raw || "").toLowerCase().trim();
      let city = null;
      let type = null;

      for (const entry of KNOWN_CITIES) {
        if (q.includes(entry.toLowerCase())) {
          city = CITY_ALIAS[entry.toUpperCase()] || entry;
          break;
        }
      }

      for (const [keyword, mappedType] of TYPE_KEYWORDS) {
        if (q.includes(keyword)) {
          type = mappedType;
          break;
        }
      }

      return { city, type };
    };

    const doSearch = () => {
      const input = document.getElementById("hero-search-input");
      if (!input) return;
      const raw = String(input.value || "").trim();
      if (!raw) return;

      const result = parseSearch(raw);
      const params = new URLSearchParams();
      if (result.city) params.set("city", result.city);
      if (result.type) params.set("type", result.type);
      if (!result.city && !result.type) params.set("search", raw);
      window.location.href = `/website/ourproperty?${params.toString()}`;
    };

    const btn = document.getElementById("hero-search-btn");
    const input = document.getElementById("hero-search-input");
    if (!btn || !input) return undefined;

    const onClick = () => doSearch();
    const onKeyDown = (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        doSearch();
      }
    };

    btn.addEventListener("click", onClick);
    input.addEventListener("keydown", onKeyDown);
    return () => {
      btn.removeEventListener("click", onClick);
      input.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    const normalizeCityName = (value = "") => {
      const cleaned = String(value || "").trim();
      if (!cleaned) return "";
      const lower = cleaned.toLowerCase();
      if (lower === "bangalore") return "Bengaluru";
      return cleaned;
    };

    const redirectToCityProperties = (cityName) => {
      const normalizedCity = normalizeCityName(cityName);
      if (!normalizedCity) return;
      const params = new URLSearchParams();
      params.set("city", normalizedCity);
      window.location.href = `/website/ourproperty?${params.toString()}`;
    };

    const handleCityClick = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const slider = document.getElementById("cities-category-slider");
      const sliderItem = slider ? target.closest("button, a, [data-city], .city-card, .city-filter-item, .top-city-card") : null;
      if (sliderItem && slider && slider.contains(sliderItem)) {
        event.preventDefault();
        const cityName =
          sliderItem.getAttribute("data-city") ||
          sliderItem.getAttribute("data-name") ||
          sliderItem.querySelector("h3, h4, h5, span, p")?.textContent ||
          sliderItem.textContent;
        redirectToCityProperties(cityName);
        return;
      }

      const footerLink = target.closest('a[href*="ourproperty.html?city="], a[href*="/website/ourproperty?city="]');
      if (footerLink instanceof HTMLAnchorElement) {
        event.preventDefault();
        try {
          const href = footerLink.getAttribute("href") || "";
          const url = new URL(href, window.location.origin);
          redirectToCityProperties(url.searchParams.get("city") || footerLink.textContent || "");
        } catch {
          redirectToCityProperties(footerLink.textContent || "");
        }
      }
    };

    document.addEventListener("click", handleCityClick);
    return () => document.removeEventListener("click", handleCityClick);
  }, []);

  return (
    <div className="html-page">
      <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      <WebsiteFooter />
    </div>
  );
}
