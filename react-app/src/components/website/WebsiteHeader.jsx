import React from "react";
import templateHtml from "../../pages/website/index.template.html?raw";

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

const rewriteAssetPaths = (html) =>
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

const extractBodyHtml = (source) => {
  const bodyMatch = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch ? bodyMatch[1] : "";
};

const extractHeaderHtml = (source) => {
  const bodyContent = extractBodyHtml(source);
  if (!bodyContent) return "";
  const headerMatch = bodyContent.match(/<header[\s\S]*?<\/header>/i);
  return headerMatch ? rewriteAssetPaths(headerMatch[0]).trim() : "";
};

const extractMobileMenuHtml = (source) => {
  const bodyContent = extractBodyHtml(source);
  if (!bodyContent) return { overlay: "", menu: "" };

  const overlayMatch = bodyContent.match(/<div[^>]*id="menu-overlay"[^>]*>[\s\S]*?<\/div>/i);

  let menuHtml = "";
  const menuStartMatch = bodyContent.match(/<div[^>]*id="mobile-menu"[^>]*>/i);
  if (menuStartMatch) {
    const startIndex = bodyContent.indexOf(menuStartMatch[0]);
    let depth = 0;
    let endIndex = startIndex;
    for (let i = startIndex; i < bodyContent.length; i += 1) {
      if (bodyContent.slice(i, i + 4).toLowerCase() === "<div") {
        depth += 1;
      } else if (bodyContent.slice(i, i + 6).toLowerCase() === "</div>") {
        depth -= 1;
        if (depth === 0) {
          endIndex = i + 6;
          break;
        }
      }
    }
    if (endIndex > startIndex) {
      menuHtml = bodyContent.slice(startIndex, endIndex);
    }
  }

  return {
    overlay: overlayMatch ? rewriteAssetPaths(overlayMatch[0]).trim() : "",
    menu: rewriteAssetPaths(menuHtml).trim()
  };
};

export const headerHtml = extractHeaderHtml(templateHtml);
export const { overlay: menuOverlayHtml, menu: mobileMenuHtml } = extractMobileMenuHtml(templateHtml);

export default function WebsiteHeader() {
  if (!headerHtml) return null;

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: headerHtml }} />
      {menuOverlayHtml ? <div dangerouslySetInnerHTML={{ __html: menuOverlayHtml }} /> : null}
      {mobileMenuHtml ? <div dangerouslySetInnerHTML={{ __html: mobileMenuHtml }} /> : null}
    </>
  );
}

