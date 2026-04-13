import React, { useEffect } from "react";
import WebsiteFooter from "../../components/website/WebsiteFooter";
import aboutTemplateHtml from "../../templates/about.website1.html?raw";
import { useHtmlPage } from "../../utils/htmlPage";
import { logoutWebsite } from "../../utils/websiteSession";
import { useWebsiteMenu } from "../../utils/websiteUi";

const parseAttributes = (input = "") => {
  const attrs = {};
  const regex = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let match;

  while ((match = regex.exec(input))) {
    const key = match[1];
    if (!key || key === "/" || key.endsWith("/")) continue;
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

const optimizeImageSrc = (src, { width = 960, quality = 70 } = {}) => {
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
  const isLogo = alt.includes("logo");
  const isHeroPrimary = alt.includes("hero background 1");
  const isHeroImage = alt.includes("hero background") || /^hero background \d+$/.test(alt);

  attrs.decoding = "async";

  if (isHeroPrimary) {
    attrs.loading = "eager";
    attrs.fetchpriority = "high";
    attrs.src = optimizeImageSrc(attrs.src, { width: 1280, quality: 70 });
    attrs.width = attrs.width || 1600;
    attrs.height = attrs.height || 900;
    attrs.sizes = attrs.sizes || "100vw";
  } else {
    attrs.loading = "lazy";
    attrs.fetchpriority = "low";
    attrs.src = optimizeImageSrc(attrs.src, {
      width: isLogo ? 240 : isHeroImage ? 960 : 900,
      quality: 68
    });
    attrs.width = attrs.width || (isLogo ? 180 : 1200);
    attrs.height = attrs.height || (isLogo ? 40 : 800);
    if (isHeroImage) attrs.sizes = attrs.sizes || "100vw";
  }

  return `<img ${serializeAttributes(attrs)}>`;
};

const optimizeBodyImages = (html) =>
  html.replace(/<img\b[^>]*>/gi, (tag) => optimizeImageTag(tag));

const buildDeferredScriptLoader = (src, delay = 0) => `
  (function() {
    var loadScript = function() {
      if (document.querySelector('script[src="${src}"]')) return;
      var el = document.createElement('script');
      el.src = '${src}';
      el.async = true;
      document.head.appendChild(el);
    };
    if ('requestIdleCallback' in window) {
      requestIdleCallback(function() {
        ${delay > 0 ? `setTimeout(loadScript, ${delay});` : "loadScript();"}
      }, { timeout: 1500 });
    } else {
      setTimeout(loadScript, ${Math.max(1, delay)});
    }
  })();
`;

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
    .replace(/<footer[\s\S]*?<\/footer>/gi, "");

  return optimizeBodyImages(rewriteBodyAssetPaths(cleanedBody)).trim();
};

const ABOUT_PERFORMANCE_STYLES = `
  .html-page main > section {
    content-visibility: auto;
    contain-intrinsic-size: 900px;
  }

  .html-page #welcome,
  .html-page #features,
  .html-page #hero-image-wrapper {
    content-visibility: visible;
    contain-intrinsic-size: auto;
  }

  @media (max-width: 768px), (prefers-reduced-motion: reduce) {
    .html-page .animate-kenburns,
    .html-page .animate-slide-in,
    .html-page .animate-float,
    .html-page .animate-slide-left-infinite,
    .html-page .animate-slide-right-infinite,
    .html-page .pulse-icon {
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

const htmlAttrs = extractTagAttributes("html", aboutTemplateHtml);
const bodyAttrs = extractTagAttributes("body", aboutTemplateHtml);
const metas = extractHeadTagEntries("meta", aboutTemplateHtml);
const links = extractHeadTagEntries("link", aboutTemplateHtml).map((link) => ({
  ...link,
  href: withWebsiteAssetPrefix(link.href),
})).filter((link) => !String(link.href || "").includes("cdnjs.cloudflare.com/ajax/libs/font-awesome"));
const scriptEntries = extractWrappedTagEntries("script", aboutTemplateHtml);
const scriptSequence = scriptEntries.map((entry) => {
  if (entry.attrs.src) {
    const src = withWebsiteAssetPrefix(entry.attrs.src);
    if (src === "/website/assets/js/about.js") {
      return {
        type: "inline",
        content: buildDeferredScriptLoader(src, 300),
      };
    }
    return {
      type: "external",
      attrs: {
        ...entry.attrs,
        src,
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
const styles = extractWrappedTagEntries("style", aboutTemplateHtml)
  .map((entry) => entry.content)
  .filter(Boolean);
const bodyHtml = extractBodyContent(aboutTemplateHtml);

export default function WebsiteAbout() {
  useWebsiteMenu();

  useEffect(() => {
    window.globalLogout = () => logoutWebsite("login");
    return () => {
      if (window.globalLogout) {
        delete window.globalLogout;
      }
    };
  }, []);

  useHtmlPage({
    title: "About Roomhy - Our Mission, Vision, and Values",
    bodyClass: bodyAttrs.class === true ? "" : bodyAttrs.class || "",
    htmlAttrs,
    metas,
    links: [
      { rel: "preconnect", href: "https://res.cloudinary.com", crossorigin: true },
      { rel: "preconnect", href: "https://images.unsplash.com", crossorigin: true },
      { rel: "preconnect", href: "https://unpkg.com", crossorigin: true },
      { rel: "preconnect", href: "https://api.roomhy.com", crossorigin: true },
      ...links
    ],
    scripts,
    styles: [...styles, ABOUT_PERFORMANCE_STYLES],
    inlineScripts,
    scriptSequence,
  });

  return (
    <div className="html-page">
      <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      <WebsiteFooter />
    </div>
  );
}
