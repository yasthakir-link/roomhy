export const getApiBase = () => {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1"
    ? "http://localhost:5001"
    : "https://api.roomhy.com";
};

export const getAuthHeader = () => {
  if (typeof window === "undefined") return {};
  let token = "";
  try {
    token = sessionStorage.getItem("token") || localStorage.getItem("token") || "";
  } catch (_) {
    token = "";
  }
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const fetchJson = async (path, options = {}) => {
  const base = getApiBase();
  const url = path.startsWith("http") ? path : `${base}${path}`;
  const method = String(options.method || "GET").toUpperCase();
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 12000;
  const retryAttempts = Number.isFinite(options.retryAttempts)
    ? Math.max(0, options.retryAttempts)
    : (method === "GET" ? 2 : 0);
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
    ...getAuthHeader()
  };

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  let lastError;
  for (let attempt = 0; attempt <= retryAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, method, headers, signal: controller.signal });
      clearTimeout(timer);

      const text = await res.text();
      let parsed;
      try {
        parsed = text ? JSON.parse(text) : {};
      } catch (_) {
        parsed = text;
      }

      if (!res.ok) {
        const messageFromBody =
          typeof parsed === "string"
            ? parsed
            : (parsed && typeof parsed === "object" && (parsed.message || parsed.error))
              ? String(parsed.message || parsed.error)
              : "";
        const err = new Error(messageFromBody || `Request failed: ${res.status} ${res.statusText}`);
        err.status = res.status;
        err.body = messageFromBody || (typeof parsed === "string" ? parsed : JSON.stringify(parsed || {}));
        err.rawBody = parsed;
        throw err;
      }
      return parsed;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      const status = Number(err?.status || 0);
      const retriableStatus = status === 429 || status === 502 || status === 503 || status === 504;
      const retriableNetwork = err?.name === "AbortError" || err instanceof TypeError;
      const shouldRetry = attempt < retryAttempts && (retriableStatus || retriableNetwork);
      if (!shouldRetry) break;
      await wait((attempt + 1) * 400);
    }
  }

  throw lastError;
};
