import React from "react";
import WebsiteFooter from "../../components/website/WebsiteFooter";
import aboutTemplateHtml from "../../templates/about.website1.html?raw";
import { useHtmlPage } from "../../utils/htmlPage";

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
  if (!bodyMatch) return "";
  return bodyMatch[1]
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "");
};

const bodyHtml = rewriteAssetPaths(extractBodyHtml(aboutTemplateHtml));

export default function WebsiteAbout() {
  useHtmlPage({
    title: "About Roomhy - Our Mission, Vision, and Values",
    bodyClass: "text-gray-800 flex flex-col min-h-screen",
    htmlAttrs: { lang: "en", class: "scroll-smooth" },
    metas: [
      { charset: "UTF-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" }
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: true },
      {
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Lexend:wght@400;500;600;700;800&display=swap",
        rel: "stylesheet"
      },
      {
        rel: "stylesheet",
        href: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css"
      },
      { rel: "stylesheet", href: "/website/assets/css/about.css" }
    ],
    headScripts: [
      { src: "https://cdn.tailwindcss.com" },
      { src: "https://unpkg.com/lucide@latest" }
    ],
    inlineScripts: [
      `
      window.API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:5001'
        : 'https://api.roomhy.com';
      `,
      `
      tailwind.config = {
        theme: {
          extend: {
            fontFamily: {
              sans: ['Inter', 'sans-serif'],
              lexend: ['Lexend', 'sans-serif']
            },
            keyframes: {
              kenburns: {
                '0%': { transform: 'scale(1) translate(0, 0)' },
                '100%': { transform: 'scale(1.1) translate(-2%, 2%)' }
              },
              'slide-left': {
                '0%': { transform: 'translateX(0%)' },
                '100%': { transform: 'translateX(-50%)' }
              },
              'slide-right': {
                '0%': { transform: 'translateX(-50%)' },
                '100%': { transform: 'translateX(0%)' }
              },
              slideIn: {
                from: { opacity: '0', transform: 'translateY(40px)' },
                to: { opacity: '1', transform: 'translateY(0)' }
              },
              float: {
                '0%': { transform: 'translateY(0px)' },
                '50%': { transform: 'translateY(-10px)' },
                '100%': { transform: 'translateY(0px)' }
              },
              pulseGlow: {
                '0%, 100%': {
                  transform: 'scale(1)',
                  boxShadow: '0 0 15px rgba(168, 85, 247, 0.3)'
                },
                '50%': {
                  transform: 'scale(1.1)',
                  boxShadow: '0 0 25px rgba(168, 85, 247, 0.7)'
                }
              }
            },
            animation: {
              kenburns: 'kenburns 30s ease-in-out infinite alternate',
              'slide-left-infinite': 'slide-left 40s linear infinite',
              'slide-right-infinite': 'slide-right 40s linear infinite',
              'slide-in': 'slideIn 0.7s ease-out forwards',
              float: 'float 6s ease-in-out infinite',
              'pulse-glow': 'pulseGlow 3s ease-in-out infinite'
            }
          }
        }
      };
      `
    ],
    scripts: [{ src: "/website/assets/js/about.js" }]
  });

  return (
    <div className="html-page">
      <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      <WebsiteFooter />
    </div>
  );
}
