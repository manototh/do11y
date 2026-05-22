(function() {
	//#region src/do11y.ts
	const VERSION = "0.0.5";
	const _alreadyLoaded = !!window.__axiomDo11yInitialized;
	window.__axiomDo11yInitialized = true;
	const config = {
		axiomHost: "AXIOM_DOMAIN",
		axiomDataset: "DATASET_NAME",
		axiomToken: "API_TOKEN",
		debug: false,
		flushInterval: 5e3,
		maxBatchSize: 10,
		trackOutboundLinks: true,
		trackInternalLinks: true,
		trackScrollDepth: true,
		scrollThresholds: [
			25,
			50,
			75,
			90
		],
		allowedDomains: null,
		respectDNT: true,
		maxRetries: 2,
		retryDelay: 1e3,
		rateLimitMs: 100,
		framework: "mintlify",
		trackSectionVisibility: true,
		sectionVisibleThreshold: 3,
		trackTabSwitches: true,
		trackTocClicks: true,
		trackExpandCollapse: true,
		trackFeedback: true,
		tabContainerSelector: null,
		tocSelector: null,
		feedbackSelector: null,
		searchSelector: null,
		copyButtonSelector: null,
		codeBlockSelector: null,
		navigationSelector: null,
		footerSelector: null,
		contentSelector: null
	};
	const FRAMEWORK_PRESETS = {
		mintlify: {
			searchSelector: "#search-bar-entry, #search-bar-entry-mobile, [class*=\"search\"]",
			copyButtonSelector: "[class*=\"copy\"], button[aria-label*=\"copy\" i]",
			codeBlockSelector: "pre, [class*=\"code\"]",
			navigationSelector: "nav, [role=\"navigation\"], #navbar, #sidebar, [class*=\"nav\"], [class*=\"sidebar\"]",
			footerSelector: "footer, [role=\"contentinfo\"], [class*=\"footer\"]",
			contentSelector: "main, article, [role=\"main\"], [class*=\"content\"]",
			tabContainerSelector: "[role=\"tablist\"], [class*=\"tab\"]",
			tocSelector: "#table-of-contents, [data-testid=\"table-of-contents\"], [class*=\"table-of-contents\"], [class*=\"toc\"]",
			feedbackSelector: "[class*=\"feedback\"], [class*=\"helpful\"]"
		},
		docusaurus: {
			searchSelector: ".DocSearch, .DocSearch-Button",
			copyButtonSelector: "button.clean-btn[aria-label*=\"copy\" i], button[class*=\"copyButton\"]",
			codeBlockSelector: "pre, [class*=\"code\"]",
			navigationSelector: "nav, [role=\"navigation\"], .navbar, .sidebar, [class*=\"nav\"], [class*=\"sidebar\"]",
			footerSelector: "footer, [role=\"contentinfo\"], [class*=\"footer\"]",
			contentSelector: "main, article, [role=\"main\"], [class*=\"content\"]",
			tabContainerSelector: ".tabs[role=\"tablist\"], [class*=\"tabs\"]",
			tocSelector: ".table-of-contents, [class*=\"toc\"]",
			feedbackSelector: "[class*=\"feedback\"], [class*=\"helpful\"]"
		},
		nextra: {
			searchSelector: ".nextra-search input, input[placeholder*=\"search\" i], button[aria-label*=\"search\" i]",
			copyButtonSelector: "button[class*=\"copy\"], button[aria-label*=\"copy\" i], button[title*=\"copy\" i]",
			codeBlockSelector: "pre, [class*=\"code\"]",
			navigationSelector: "nav, [role=\"navigation\"], [class*=\"nav\"], [class*=\"sidebar\"]",
			footerSelector: "footer, [role=\"contentinfo\"], [class*=\"footer\"]",
			contentSelector: "main, article, [role=\"main\"], [class*=\"content\"]",
			tabContainerSelector: "[role=\"tablist\"], [class*=\"tab\"]",
			tocSelector: ".nextra-toc, [class*=\"toc\"]",
			feedbackSelector: "[class*=\"feedback\"], [class*=\"helpful\"]"
		},
		gitbook: {
			searchSelector: "[data-testid*=\"search\"], button[aria-label*=\"search\" i]",
			copyButtonSelector: "[class*=\"copy\"], button[aria-label*=\"copy\" i]",
			codeBlockSelector: "pre, code, [class*=\"code\"]",
			navigationSelector: "nav, [role=\"navigation\"], [class*=\"nav\"], [class*=\"sidebar\"]",
			footerSelector: "footer, [role=\"contentinfo\"], [class*=\"footer\"]",
			contentSelector: "main, article, [role=\"main\"], [class*=\"content\"]",
			tabContainerSelector: "[role=\"tablist\"], [class*=\"tab\"]",
			tocSelector: "[class*=\"table-of-contents\"], [class*=\"toc\"], [class*=\"page-outline\"]",
			feedbackSelector: "[class*=\"feedback\"], [class*=\"helpful\"], [class*=\"rating\"]"
		},
		"mkdocs-material": {
			searchSelector: ".md-search__input",
			copyButtonSelector: ".md-clipboard, .md-code__button[title=\"Copy to clipboard\"]",
			codeBlockSelector: "pre, code, [class*=\"code\"]",
			navigationSelector: "nav, [role=\"navigation\"], .md-nav, .md-sidebar",
			footerSelector: "footer, [role=\"contentinfo\"], .md-footer",
			contentSelector: "main, article, [role=\"main\"], .md-content",
			tabContainerSelector: ".tabbed-labels, .md-typeset .tabbed-set",
			tocSelector: ".md-sidebar--secondary .md-nav, [class*=\"toc\"]",
			feedbackSelector: "[class*=\"feedback\"], [class*=\"helpful\"]"
		},
		vitepress: {
			searchSelector: ".VPNavBarSearch button, .VPNavBarSearchButton, #local-search",
			copyButtonSelector: ".vp-code-copy, button.copy[title*=\"Copy\"]",
			codeBlockSelector: "pre, [class*=\"code\"]",
			navigationSelector: "nav, [role=\"navigation\"], .VPNav, .VPSidebar, [class*=\"nav\"], [class*=\"sidebar\"]",
			footerSelector: "footer, [role=\"contentinfo\"], .VPFooter, [class*=\"footer\"]",
			contentSelector: "main, article, [role=\"main\"], .VPContent, [class*=\"content\"]",
			tabContainerSelector: ".vp-code-group .tabs, [role=\"tablist\"]",
			tocSelector: ".VPDocAsideOutline, [class*=\"toc\"]",
			feedbackSelector: "[class*=\"feedback\"], [class*=\"helpful\"]"
		}
	};
	const SELECTOR_KEYS = [
		"searchSelector",
		"copyButtonSelector",
		"codeBlockSelector",
		"navigationSelector",
		"footerSelector",
		"contentSelector",
		"tabContainerSelector",
		"tocSelector",
		"feedbackSelector"
	];
	/**
	* Apply framework-specific selectors to the config.
	* For 'custom', uses whatever the user set in config; for named
	* frameworks, loads the preset and lets explicit config values override.
	*/
	function applyFrameworkSelectors() {
		const preset = FRAMEWORK_PRESETS[config.framework];
		if (preset) SELECTOR_KEYS.forEach((key) => {
			if (!config[key]) config[key] = preset[key];
		});
		else if (config.framework !== "custom") {
			if (config.debug) console.warn(`[Axiom Do11y] Unknown framework "${config.framework}". Falling back to generic selectors. Supported: ` + Object.keys(FRAMEWORK_PRESETS).join(", ") + ", custom");
		}
		const fallback = FRAMEWORK_PRESETS.mintlify;
		if (!fallback) return;
		SELECTOR_KEYS.forEach((key) => {
			if (!config[key]) config[key] = fallback[key];
		});
	}
	function shouldDisableTracking() {
		if (config.respectDNT && (navigator.doNotTrack === "1" || navigator.doNotTrack === "yes" || window.doNotTrack === "1")) {
			if (config.debug) console.log("[Axiom Do11y] Disabled: Do Not Track is enabled");
			return true;
		}
		if (config.allowedDomains && config.allowedDomains.length > 0) {
			const currentDomain = window.location.hostname;
			if (!config.allowedDomains.some((domain) => {
				return currentDomain === domain || currentDomain.endsWith("." + domain);
			})) {
				if (config.debug) console.log("[Axiom Do11y] Disabled: Domain not allowed:", currentDomain);
				return true;
			}
		}
		return false;
	}
	/**
	* Validate a CSS selector string supplied through user configuration.
	* Returns the selector unchanged if it is syntactically valid, or null
	* if it is not. This prevents CSS selector injection from attacker-
	* controlled config values (window.Do11yConfig / meta tags) reaching
	* querySelectorAll / closest calls.
	*/
	function validateSelector(selector) {
		if (!selector || typeof selector !== "string") return null;
		try {
			document.querySelector(selector);
			return selector;
		} catch {
			if (config.debug) console.warn("[Axiom Do11y] Invalid CSS selector rejected:", selector);
			return null;
		}
	}
	function sanitizeText(text, maxLength) {
		if (!text || typeof text !== "string") return null;
		const limit = maxLength ?? 100;
		let sanitized = text;
		sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]");
		sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[phone]");
		sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[redacted]");
		sanitized = sanitized.replace(/\b(?:\d[ -]?){13,19}\b/g, "[card]");
		sanitized = sanitized.replace(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[token]");
		sanitized = sanitized.replace(/\bxa[a-z]{2}-[A-Za-z0-9_-]{20,}/g, "[token]");
		sanitized = sanitized.replace(/\b[0-9a-fA-F]{32,}\b/g, "[redacted]");
		return sanitized.trim().substring(0, limit);
	}
	function generateSessionId() {
		if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
		if (window.crypto && typeof window.crypto.getRandomValues === "function") {
			const arr = new Uint8Array(16);
			window.crypto.getRandomValues(arr);
			arr[6] = arr[6] & 15 | 64;
			arr[8] = arr[8] & 63 | 128;
			const hex = Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
			return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
		}
		return "no-crypto-00-0000-0000-000000000000";
	}
	function isValidSessionData(value) {
		if (!value || typeof value !== "object") return false;
		const v = value;
		return typeof v.id === "string" && v.id.length > 0 && typeof v.startTime === "string" && Array.isArray(v.pageSequence) && typeof v.pageCount === "number";
	}
	function getSession() {
		let session = null;
		try {
			const stored = sessionStorage.getItem("axiom_docs_session");
			if (stored) {
				const parsed = JSON.parse(stored);
				if (isValidSessionData(parsed)) session = parsed;
			}
		} catch {}
		if (!session) {
			session = {
				id: generateSessionId(),
				startTime: (/* @__PURE__ */ new Date()).toISOString(),
				pageSequence: [],
				pageCount: 0,
				referrerCategory: null,
				aiPlatform: null
			};
			saveSession(session);
		}
		return session;
	}
	function saveSession(session) {
		try {
			sessionStorage.setItem("axiom_docs_session", JSON.stringify(session));
		} catch {}
	}
	function updatePageSequence(path) {
		const session = getSession();
		session.pageCount++;
		session.pageSequence.push({
			path,
			timestamp: (/* @__PURE__ */ new Date()).toISOString(),
			index: session.pageCount
		});
		if (session.pageSequence.length > 50) session.pageSequence = session.pageSequence.slice(-50);
		saveSession(session);
		return session;
	}
	function getBrowserContext() {
		return {
			viewportCategory: categorizeViewport(),
			browserFamily: getBrowserFamily(),
			deviceType: getDeviceType(),
			language: (navigator.language || "").split("-")[0] || "unknown",
			timezoneOffset: (/* @__PURE__ */ new Date()).getTimezoneOffset() / 60
		};
	}
	function categorizeViewport() {
		const width = window.innerWidth;
		if (width < 640) return "mobile";
		if (width < 1024) return "tablet";
		if (width < 1440) return "desktop";
		return "large-desktop";
	}
	function getBrowserFamily() {
		const ua = navigator.userAgent;
		if (ua.includes("Firefox")) return "Firefox";
		if (ua.includes("Edg")) return "Edge";
		if (ua.includes("Chrome")) return "Chrome";
		if (ua.includes("Safari")) return "Safari";
		return "Other";
	}
	function getDeviceType() {
		const ua = navigator.userAgent;
		if (/Mobile|Android|iPhone|iPad/.test(ua)) {
			if (/iPad|Tablet/.test(ua)) return "tablet";
			return "mobile";
		}
		return "desktop";
	}
	/**
	* Known AI platform referrer patterns.
	* Each entry maps a substring found in the referrer hostname to an AI
	* platform label. Order matters: first match wins.
	*/
	const AI_REFERRER_PATTERNS = [
		{
			match: "chatgpt",
			platform: "ChatGPT"
		},
		{
			match: "chat.com",
			platform: "ChatGPT"
		},
		{
			match: "openai",
			platform: "ChatGPT"
		},
		{
			match: "perplexity",
			platform: "Perplexity"
		},
		{
			match: "claude.ai",
			platform: "Claude"
		},
		{
			match: "anthropic",
			platform: "Claude"
		},
		{
			match: "gemini",
			platform: "Gemini"
		},
		{
			match: "copilot",
			platform: "Copilot"
		},
		{
			match: "deepseek",
			platform: "DeepSeek"
		},
		{
			match: "meta.ai",
			platform: "Meta AI"
		},
		{
			match: "grok",
			platform: "Grok"
		},
		{
			match: "x.ai",
			platform: "Grok"
		},
		{
			match: "mistral",
			platform: "Mistral"
		},
		{
			match: "you.com",
			platform: "You.com"
		},
		{
			match: "phind",
			platform: "Phind"
		}
	];
	/**
	* Classify a referrer hostname into a traffic source category.
	* Returns { referrerCategory, aiPlatform } where aiPlatform is null
	* for non-AI traffic.
	*/
	function classifyReferrer(hostname) {
		if (!hostname || hostname === "direct") return {
			referrerCategory: "direct",
			aiPlatform: null
		};
		if (hostname === "internal") return {
			referrerCategory: "internal",
			aiPlatform: null
		};
		if (hostname === "unknown") return {
			referrerCategory: "unknown",
			aiPlatform: null
		};
		const h = hostname.toLowerCase();
		for (const pattern of AI_REFERRER_PATTERNS) if (h.indexOf(pattern.match) !== -1) return {
			referrerCategory: "ai",
			aiPlatform: pattern.platform
		};
		if (/google\.|bing\.|baidu\.|yandex\.|duckduckgo\.|yahoo\./.test(h)) return {
			referrerCategory: "search-engine",
			aiPlatform: null
		};
		if (/github\.|gitlab\.|bitbucket\./.test(h)) return {
			referrerCategory: "code-host",
			aiPlatform: null
		};
		if (/stackoverflow\.|stackexchange\.|reddit\.|news\.ycombinator\./.test(h)) return {
			referrerCategory: "community",
			aiPlatform: null
		};
		if (/twitter\.|x\.com|linkedin\.|facebook\.|threads\.net/.test(h)) return {
			referrerCategory: "social",
			aiPlatform: null
		};
		return {
			referrerCategory: "other",
			aiPlatform: null
		};
	}
	function getReferrerDomain() {
		try {
			if (!document.referrer) return "direct";
			const url = new URL(document.referrer);
			if (url.hostname === window.location.hostname) return "internal";
			return url.hostname;
		} catch {
			return "unknown";
		}
	}
	function getPageInfo() {
		return {
			path: window.location.pathname,
			hash: window.location.hash || null,
			search: window.location.search ? "has_params" : null,
			title: sanitizeText(document.title, 150)
		};
	}
	let eventQueue = [];
	let flushTimeout = null;
	const lastEventTime = {};
	let isDisabled = false;
	function queueEvent(eventType, eventData) {
		if (isDisabled) return;
		const now = Date.now();
		if (config.rateLimitMs > 0 && lastEventTime[eventType]) {
			if (now - lastEventTime[eventType] < config.rateLimitMs) {
				if (config.debug) console.log("[Axiom Do11y] Rate limited:", eventType);
				return;
			}
		}
		lastEventTime[eventType] = now;
		const session = getSession();
		const event = {
			_time: (/* @__PURE__ */ new Date()).toISOString(),
			eventType,
			"do11y_version": VERSION,
			sessionId: session.id,
			sessionPageCount: session.pageCount,
			...getPageInfo(),
			...getBrowserContext(),
			...eventData
		};
		if (config.debug) console.log("[Axiom Do11y] Event queued:", event);
		eventQueue.push(event);
		if (eventQueue.length > 100) {
			eventQueue = eventQueue.slice(-100);
			if (config.debug) console.warn("[Axiom Do11y] Event queue capped at 100 events");
		}
		if (eventQueue.length >= config.maxBatchSize) flush();
		else scheduleFlush();
	}
	function scheduleFlush() {
		if (flushTimeout) return;
		flushTimeout = setTimeout(flush, config.flushInterval);
	}
	/**
	* Axiom-owned ingest domains. The axiomHost config value MUST be one of
	* these. This prevents an attacker who can inject a <meta> tag or set
	* window.Do11yConfig from redirecting requests (and the bearer token) to
	* an arbitrary server.
	*
	* Add new Axiom edge-deployment domains here as they are provisioned.
	*/
	const AXIOM_ALLOWED_HOSTS = new Set(["us-east-1.aws.edge.axiom.co", "eu-central-1.aws.edge.axiom.co"]);
	function validateConfig() {
		if (!config.axiomToken) {
			if (config.debug) console.warn("[Axiom Do11y] No API token configured");
			return false;
		}
		if (typeof config.axiomToken !== "string" || config.axiomToken.length < 10) {
			if (config.debug) console.warn("[Axiom Do11y] Invalid token format");
			return false;
		}
		if (!AXIOM_ALLOWED_HOSTS.has(config.axiomHost)) {
			if (config.debug) console.warn("[Axiom Do11y] Untrusted axiomHost \"" + config.axiomHost + "\". Must be one of: " + Array.from(AXIOM_ALLOWED_HOSTS).join(", "));
			return false;
		}
		if (!/^[a-zA-Z0-9_-]+$/.test(config.axiomDataset)) {
			if (config.debug) console.warn("[Axiom Do11y] Invalid dataset name");
			return false;
		}
		return true;
	}
	function flush(retriesLeft) {
		if (flushTimeout) {
			clearTimeout(flushTimeout);
			flushTimeout = null;
		}
		if (eventQueue.length === 0) return;
		if (!validateConfig()) return;
		const retries = typeof retriesLeft === "number" ? retriesLeft : config.maxRetries;
		const events = eventQueue.slice();
		eventQueue = [];
		sendEvents("https://" + config.axiomHost + "/v1/ingest/" + encodeURIComponent(config.axiomDataset), events, retries);
	}
	function sendEvents(url, events, retriesLeft) {
		fetch(url, {
			method: "POST",
			headers: {
				"Authorization": "Bearer " + config.axiomToken,
				"Content-Type": "application/json"
			},
			body: JSON.stringify(events),
			keepalive: true
		}).then((response) => {
			if (response.ok) {
				if (config.debug) console.log("[Axiom Do11y] Flushed", events.length, "events");
				return;
			}
			if (retriesLeft > 0 && (response.status >= 500 || response.status === 429)) {
				if (config.debug) console.log("[Axiom Do11y] Retrying after error:", response.status);
				eventQueue = events.concat(eventQueue);
				setTimeout(() => {
					flush(retriesLeft - 1);
				}, config.retryDelay * (config.maxRetries - retriesLeft + 1));
				return;
			}
			if (config.debug) response.text().then((text) => {
				console.error("[Axiom Do11y] Ingest failed:", response.status, text);
			}).catch(() => {});
		}).catch((err) => {
			if (retriesLeft > 0) {
				if (config.debug) console.log("[Axiom Do11y] Network error, retrying:", err.message);
				eventQueue = events.concat(eventQueue);
				setTimeout(() => {
					flush(retriesLeft - 1);
				}, config.retryDelay * (config.maxRetries - retriesLeft + 1));
			} else if (config.debug) console.error("[Axiom Do11y] Failed to send events:", err);
		});
	}
	function flushSync() {
		if (eventQueue.length === 0) return;
		if (!validateConfig()) return;
		const events = eventQueue;
		eventQueue = [];
		const url = "https://" + config.axiomHost + "/v1/ingest/" + encodeURIComponent(config.axiomDataset);
		try {
			fetch(url, {
				method: "POST",
				headers: {
					"Authorization": "Bearer " + config.axiomToken,
					"Content-Type": "application/json"
				},
				body: JSON.stringify(events),
				keepalive: true
			});
		} catch {}
		if (config.debug) console.log("[Axiom Do11y] Sync flushed", events.length, "events");
	}
	function trackPageView() {
		const session = updatePageSequence(window.location.pathname);
		const referrerDomain = getReferrerDomain();
		const referrerInfo = classifyReferrer(referrerDomain);
		if (session.pageCount === 1) {
			session.referrerCategory = referrerInfo.referrerCategory;
			session.aiPlatform = referrerInfo.aiPlatform;
			saveSession(session);
		}
		queueEvent("page_view", {
			referrerDomain,
			referrerCategory: referrerInfo.referrerCategory,
			aiPlatform: referrerInfo.aiPlatform,
			isFirstPage: session.pageCount === 1,
			previousPath: session.pageSequence.length > 1 ? session.pageSequence[session.pageSequence.length - 2].path : null
		});
	}
	function setupLinkTracking() {
		document.addEventListener("click", (e) => {
			const link = e.target.closest("a");
			if (!link) return;
			const href = link.getAttribute("href");
			if (!href) return;
			let linkType = "other";
			let targetDomain = null;
			try {
				if (href.startsWith("#")) linkType = "anchor";
				else if (href.startsWith("/") || href.startsWith("./") || href.startsWith("../")) linkType = "internal";
				else if (href.startsWith("http")) {
					const url = new URL(href);
					if (url.hostname === window.location.hostname) linkType = "internal";
					else {
						linkType = "external";
						targetDomain = url.hostname;
					}
				} else if (href.startsWith("mailto:")) linkType = "email";
			} catch {}
			if (linkType === "internal" && !config.trackInternalLinks) return;
			if (linkType === "external" && !config.trackOutboundLinks) return;
			queueEvent("link_click", {
				linkType,
				targetUrl: href,
				targetDomain,
				linkText: sanitizeText(link.textContent, 100),
				linkContext: getLinkContext(link),
				linkSection: sanitizeText(getNearestHeading(link), 100),
				linkIndex: getLinkIndex(link, href)
			});
			flush();
		}, true);
	}
	function getLinkContext(link) {
		if (link.closest(config.navigationSelector)) return "navigation";
		if (link.closest(config.footerSelector)) return "footer";
		if (link.closest(config.contentSelector)) return "content";
		return "other";
	}
	function getNearestHeading(element) {
		let current = element;
		while (current && current !== document.body) {
			let sibling = current.previousElementSibling;
			while (sibling) {
				if (/^H[1-6]$/.test(sibling.tagName)) return sibling.textContent?.trim().substring(0, 100) ?? null;
				const headings = sibling.querySelectorAll("h1, h2, h3, h4, h5, h6");
				if (headings.length > 0) return headings[headings.length - 1].textContent?.trim().substring(0, 100) ?? null;
				sibling = sibling.previousElementSibling;
			}
			current = current.parentElement;
		}
		return null;
	}
	function getLinkIndex(link, href) {
		if (typeof CSS === "undefined" || typeof CSS.escape !== "function") return 1;
		try {
			const allLinks = document.querySelectorAll("a[href=\"" + CSS.escape(href) + "\"]");
			for (let i = 0; i < allLinks.length; i++) if (allLinks[i] === link) return i + 1;
		} catch {}
		return 1;
	}
	let trackedScrollDepths = /* @__PURE__ */ new Set();
	let scrollContainer = null;
	function findScrollableAncestor(el) {
		let current = el;
		while (current && current !== document.body && current !== document.documentElement) {
			const overflowY = window.getComputedStyle(current).overflowY;
			if ((overflowY === "auto" || overflowY === "scroll") && current.scrollHeight > current.clientHeight) return current;
			current = current.parentElement;
		}
		return null;
	}
	/**
	* Track scroll depth.
	*
	* Some frameworks (GitBook/HonKit, MkDocs Material) use container-based
	* scrolling where the window itself never scrolls. We detect the scrollable
	* container by walking up from the content element and listen on it in
	* addition to the window.
	*/
	function setupScrollTracking() {
		if (!config.trackScrollDepth) return;
		if (config.contentSelector) {
			const contentEl = document.querySelector(config.contentSelector);
			if (contentEl) scrollContainer = findScrollableAncestor(contentEl);
		}
		let ticking = false;
		function onScroll() {
			if (!ticking) {
				window.requestAnimationFrame(() => {
					checkScrollDepth();
					ticking = false;
				});
				ticking = true;
			}
		}
		window.addEventListener("scroll", onScroll);
		if (scrollContainer) {
			scrollContainer.addEventListener("scroll", onScroll);
			if (config.debug) {
				const sc = scrollContainer;
				console.log("[do11y] Using container-based scroll tracking:", sc.className || sc.tagName);
			}
		}
		checkScrollDepth();
	}
	/**
	* Check and track scroll depth thresholds.
	* Reads from the detected scroll container when present, otherwise
	* falls back to the window/document.
	*
	* If the page fits entirely in the viewport (no scrollbar), all
	* thresholds are marked as reached since the user can see 100% of
	* the content without scrolling.
	*/
	function checkScrollDepth() {
		let scrollTop;
		let totalHeight;
		let viewportHeight;
		if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
			scrollTop = scrollContainer.scrollTop;
			totalHeight = scrollContainer.scrollHeight;
			viewportHeight = scrollContainer.clientHeight;
		} else {
			scrollTop = window.scrollY || document.documentElement.scrollTop;
			totalHeight = document.documentElement.scrollHeight;
			viewportHeight = window.innerHeight;
		}
		const docHeight = totalHeight - viewportHeight;
		if (docHeight <= 0) {
			config.scrollThresholds.forEach((threshold) => {
				if (!trackedScrollDepths.has(threshold)) {
					trackedScrollDepths.add(threshold);
					queueEvent("scroll_depth", {
						threshold,
						scrollPercent: 100
					});
				}
			});
			return;
		}
		const scrollPercent = Math.round(scrollTop / docHeight * 100);
		config.scrollThresholds.forEach((threshold) => {
			if (scrollPercent >= threshold && !trackedScrollDepths.has(threshold)) {
				trackedScrollDepths.add(threshold);
				queueEvent("scroll_depth", {
					threshold,
					scrollPercent
				});
			}
		});
	}
	let pageLoadTime = Date.now();
	let lastActivityTime = Date.now();
	let totalActiveTime = 0;
	let isPageVisible = true;
	function emitPageExit() {
		if (isPageVisible) totalActiveTime += Date.now() - lastActivityTime;
		const totalTime = Date.now() - pageLoadTime;
		const engagementRatio = totalTime > 0 ? totalActiveTime / totalTime : 0;
		let maxScroll = 0;
		trackedScrollDepths.forEach((depth) => {
			if (depth > maxScroll) maxScroll = depth;
		});
		flushVisibleSections();
		const session = getSession();
		queueEvent("page_exit", {
			totalTimeSeconds: Math.round(totalTime / 1e3),
			activeTimeSeconds: Math.round(totalActiveTime / 1e3),
			engagementRatio: Math.round(engagementRatio * 100) / 100,
			maxScrollDepth: maxScroll,
			referrerCategory: session.referrerCategory,
			aiPlatform: session.aiPlatform
		});
	}
	function setupEngagementTracking() {
		document.addEventListener("visibilitychange", () => {
			if (document.hidden) {
				if (isPageVisible) {
					totalActiveTime += Date.now() - lastActivityTime;
					isPageVisible = false;
				}
			} else {
				lastActivityTime = Date.now();
				isPageVisible = true;
			}
		});
		window.addEventListener("beforeunload", () => {
			emitPageExit();
			cleanup();
		});
	}
	function setupSearchTracking() {
		document.addEventListener("click", (e) => {
			if (e.target.closest(config.searchSelector)) queueEvent("search_opened", {});
		});
		document.addEventListener("keydown", (e) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") queueEvent("search_opened", { trigger: "keyboard" });
		});
	}
	function getCodeBlockIndex(codeBlock) {
		if (!codeBlock) return 1;
		try {
			const allBlocks = document.querySelectorAll(config.codeBlockSelector);
			for (let i = 0; i < allBlocks.length; i++) if (allBlocks[i] === codeBlock) return i + 1;
		} catch {}
		return 1;
	}
	function setupCopyTracking() {
		document.addEventListener("click", (e) => {
			const copyButton = e.target.closest(config.copyButtonSelector);
			if (copyButton) {
				const codeBlock = copyButton.closest(config.codeBlockSelector) ?? copyButton.closest("div, section")?.querySelector("pre") ?? copyButton.parentElement?.querySelector("pre") ?? null;
				const codeEl = codeBlock ? codeBlock.tagName === "PRE" ? codeBlock.querySelector("code") : codeBlock.querySelector("code[class*=\"language-\"]") ?? codeBlock.querySelector("code") : null;
				queueEvent("code_copied", {
					language: codeBlock?.getAttribute("language") ?? codeBlock?.getAttribute("data-language") ?? codeBlock?.getAttribute("data-lang") ?? codeBlock?.className.match(/language-(\w+)/)?.[1] ?? codeEl?.getAttribute("language") ?? codeEl?.getAttribute("data-language") ?? codeEl?.getAttribute("data-lang") ?? codeEl?.className.match(/language-(\w+)/)?.[1] ?? "unknown",
					codeSection: sanitizeText(getNearestHeading(codeBlock ?? copyButton), 100),
					codeBlockIndex: getCodeBlockIndex(codeBlock)
				});
			}
		}, true);
	}
	let sectionObserver = null;
	let sectionTimers = {};
	function setupSectionVisibilityTracking() {
		if (!config.trackSectionVisibility) return;
		if (typeof IntersectionObserver === "undefined") return;
		const threshold = config.sectionVisibleThreshold * 1e3;
		sectionObserver = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				const id = entry.target.getAttribute("data-do11y-section-id");
				if (!id) return;
				if (entry.isIntersecting) {
					if (!sectionTimers[id]) sectionTimers[id] = {
						start: Date.now(),
						reported: false
					};
				} else {
					if (sectionTimers[id] && !sectionTimers[id].reported) {
						const elapsed = Date.now() - sectionTimers[id].start;
						if (elapsed >= threshold) {
							queueEvent("section_visible", {
								heading: sanitizeText(entry.target.textContent?.trim() ?? "", 100),
								headingLevel: parseInt(entry.target.tagName.charAt(1), 10),
								visibleSeconds: Math.round(elapsed / 1e3)
							});
							sectionTimers[id].reported = true;
						}
					}
					delete sectionTimers[id];
				}
			});
		}, { threshold: .5 });
		observeHeadings();
	}
	function observeHeadings() {
		if (!sectionObserver) return;
		document.querySelectorAll("h2, h3").forEach((h, i) => {
			h.setAttribute("data-do11y-section-id", "section-" + i);
			sectionObserver.observe(h);
		});
	}
	function flushVisibleSections() {
		if (!sectionObserver) return;
		const now = Date.now();
		const threshold = config.sectionVisibleThreshold * 1e3;
		Object.keys(sectionTimers).forEach((id) => {
			const timer = sectionTimers[id];
			if (timer && !timer.reported) {
				const elapsed = now - timer.start;
				if (elapsed >= threshold) {
					const escapedId = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(id) : id.replace(/["\\]/g, "\\$&");
					const el = document.querySelector("[data-do11y-section-id=\"" + escapedId + "\"]");
					if (el) queueEvent("section_visible", {
						heading: sanitizeText(el.textContent?.trim() ?? "", 100),
						headingLevel: parseInt(el.tagName.charAt(1), 10),
						visibleSeconds: Math.round(elapsed / 1e3)
					});
				}
			}
		});
		sectionTimers = {};
	}
	function setupTabSwitchTracking() {
		if (!config.trackTabSwitches) return;
		document.addEventListener("click", (e) => {
			let baseSel = "[role=\"tab\"], .tabs button, .tabs a, .tabbed-labels label";
			const safeTabSel = validateSelector(config.tabContainerSelector);
			if (safeTabSel) baseSel += ", " + safeTabSel + " button, " + safeTabSel + " a, " + safeTabSel + " label";
			const tab = e.target.closest(baseSel);
			if (!tab) return;
			if (tab.getAttribute("aria-selected") === "true" || tab.classList.contains("active") || tab.classList.contains("is-active")) return;
			const label = sanitizeText(tab.textContent, 50);
			if (!label) return;
			queueEvent("tab_switch", {
				tabLabel: label,
				tabGroup: sanitizeText(getNearestHeading(tab), 100),
				isDefault: false
			});
		});
	}
	function setupTocClickTracking() {
		if (!config.trackTocClicks) return;
		document.addEventListener("click", (e) => {
			const link = e.target.closest("a");
			if (!link) return;
			const tocContainer = link.closest(validateSelector(config.tocSelector) ?? ".table-of-contents, [class*=\"toc\"], [class*=\"outline\"], [class*=\"TableOfContents\"], [class*=\"page-outline\"]");
			if (!tocContainer) return;
			const href = link.getAttribute("href");
			if (!href || !href.startsWith("#")) return;
			const headingText = sanitizeText(link.textContent, 100);
			let headingLevel = null;
			try {
				const targetId = href.slice(1);
				const targetEl = document.getElementById(targetId);
				if (targetEl && /^H[1-6]$/.test(targetEl.tagName)) headingLevel = parseInt(targetEl.tagName.charAt(1), 10);
			} catch {}
			const tocLinks = tocContainer.querySelectorAll("a[href^=\"#\"]");
			let tocPosition = 1;
			for (let i = 0; i < tocLinks.length; i++) if (tocLinks[i] === link) {
				tocPosition = i + 1;
				break;
			}
			queueEvent("toc_click", {
				heading: headingText,
				headingLevel,
				tocPosition
			});
		}, true);
	}
	function setupFeedbackTracking() {
		if (!config.trackFeedback) return;
		document.addEventListener("click", (e) => {
			const button = e.target.closest("button, [role=\"button\"], a");
			if (!button) return;
			if (!button.closest(validateSelector(config.feedbackSelector) ?? "[class*=\"feedback\"], [class*=\"helpful\"], [class*=\"rating\"], [class*=\"was-this\"], [data-feedback]")) return;
			const buttonText = (button.textContent ?? "").trim().toLowerCase();
			const ariaLabel = (button.getAttribute("aria-label") ?? "").toLowerCase();
			const titleAttr = (button.getAttribute("title") ?? "").toLowerCase();
			const rawDataValue = button.getAttribute("data-value") ?? button.getAttribute("data-md-value") ?? button.getAttribute("data-feedback");
			const dataValue = rawDataValue && /^[\w\s.,!?-]{1,50}$/.test(rawDataValue) ? rawDataValue : null;
			let rating = null;
			if (dataValue) rating = dataValue;
			else if (/\byes\b|👍|thumbs.?up|helpful/i.test(buttonText + " " + ariaLabel + " " + titleAttr)) rating = "yes";
			else if (/\bno\b|👎|thumbs.?down|not.?helpful/i.test(buttonText + " " + ariaLabel + " " + titleAttr)) rating = "no";
			if (!rating) return;
			queueEvent("feedback", { rating });
		});
	}
	function setupExpandCollapseTracking() {
		if (!config.trackExpandCollapse) return;
		document.addEventListener("toggle", (e) => {
			const details = e.target;
			if (details.tagName !== "DETAILS") return;
			const summary = details.querySelector("summary");
			queueEvent("expand_collapse", {
				summary: sanitizeText(summary ? summary.textContent : "", 100),
				action: details.open ? "expand" : "collapse",
				section: sanitizeText(getNearestHeading(details), 100)
			});
		}, true);
		document.addEventListener("click", (e) => {
			const trigger = e.target.closest("[aria-expanded], [class*=\"accordion\"] button, [class*=\"collapsible\"] button");
			if (!trigger) return;
			if (trigger.closest("details")) return;
			if (trigger.closest("nav, [role=\"navigation\"], header")) return;
			const wasExpanded = trigger.getAttribute("aria-expanded") === "true";
			queueEvent("expand_collapse", {
				summary: sanitizeText(trigger.textContent, 100),
				action: wasExpanded ? "collapse" : "expand",
				section: sanitizeText(getNearestHeading(trigger), 100)
			});
		});
	}
	let mutationObserver = null;
	function init() {
		if (window.Do11yConfig && typeof window.Do11yConfig === "object") {
			for (const key in window.Do11yConfig) if (Object.prototype.hasOwnProperty.call(window.Do11yConfig, key) && Object.prototype.hasOwnProperty.call(config, key)) config[key] = window.Do11yConfig[key];
		}
		const metaDomain = document.querySelector("meta[name=\"axiom-do11y-domain\"]");
		if (metaDomain) config.axiomHost = metaDomain.getAttribute("content") ?? config.axiomHost;
		const metaToken = document.querySelector("meta[name=\"axiom-do11y-token\"]");
		if (metaToken) config.axiomToken = metaToken.getAttribute("content") ?? config.axiomToken;
		const metaDataset = document.querySelector("meta[name=\"axiom-do11y-dataset\"]");
		if (metaDataset) config.axiomDataset = metaDataset.getAttribute("content") ?? config.axiomDataset;
		const metaDebug = document.querySelector("meta[name=\"axiom-do11y-debug\"]");
		if (metaDebug && metaDebug.getAttribute("content") === "true") config.debug = true;
		const metaDomains = document.querySelector("meta[name=\"axiom-do11y-domains\"]");
		if (metaDomains) {
			const domainsStr = metaDomains.getAttribute("content");
			if (domainsStr) config.allowedDomains = domainsStr.split(",").map((d) => d.trim());
		}
		const metaFramework = document.querySelector("meta[name=\"axiom-do11y-framework\"]");
		if (metaFramework) config.framework = metaFramework.getAttribute("content") ?? config.framework;
		applyFrameworkSelectors();
		if (config.debug) console.log("[Axiom Do11y] Initializing with config:", {
			hasToken: !!config.axiomToken,
			framework: config.framework,
			allowedDomains: config.allowedDomains,
			respectDNT: config.respectDNT
		});
		if (shouldDisableTracking()) {
			isDisabled = true;
			if (config.debug) console.log("[Axiom Do11y] Tracking disabled");
			return;
		}
		if (!config.axiomToken) {
			if (config.debug) {
				console.warn("[Axiom Do11y] No API token configured. Events will not be sent.");
				console.warn("[Axiom Do11y] Add <meta name=\"axiom-do11y-token\" content=\"api-token\"> to enable.");
			}
		}
		trackPageView();
		setupLinkTracking();
		setupScrollTracking();
		setupEngagementTracking();
		setupSearchTracking();
		setupCopyTracking();
		setupSectionVisibilityTracking();
		setupTabSwitchTracking();
		setupTocClickTracking();
		setupFeedbackTracking();
		setupExpandCollapseTracking();
		let lastPath = window.location.pathname;
		mutationObserver = new MutationObserver(() => {
			if (window.location.pathname !== lastPath) {
				lastPath = window.location.pathname;
				emitPageExit();
				trackedScrollDepths = /* @__PURE__ */ new Set();
				pageLoadTime = Date.now();
				lastActivityTime = Date.now();
				totalActiveTime = 0;
				isPageVisible = true;
				trackPageView();
				observeHeadings();
				checkScrollDepth();
			}
		});
		mutationObserver.observe(document.body, {
			childList: true,
			subtree: true
		});
		window.addEventListener("popstate", () => {
			if (window.location.pathname !== lastPath) {
				lastPath = window.location.pathname;
				emitPageExit();
				trackedScrollDepths = /* @__PURE__ */ new Set();
				pageLoadTime = Date.now();
				lastActivityTime = Date.now();
				totalActiveTime = 0;
				isPageVisible = true;
				trackPageView();
				observeHeadings();
				checkScrollDepth();
			}
		});
		Object.freeze(config);
		if (config.debug) console.log("[Axiom Do11y] Initialized successfully");
	}
	function cleanup() {
		if (mutationObserver) {
			mutationObserver.disconnect();
			mutationObserver = null;
		}
		if (sectionObserver) {
			flushVisibleSections();
			sectionObserver.disconnect();
			sectionObserver = null;
		}
		if (flushTimeout) {
			clearTimeout(flushTimeout);
			flushTimeout = null;
		}
		flushSync();
	}
	if (!_alreadyLoaded) if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
	else init();
	window.AxiomDo11y = window.AxiomDo11y ?? {
		getConfig: () => ({
			endpoint: config.axiomHost,
			dataset: config.axiomDataset,
			hasToken: !!config.axiomToken,
			isDisabled,
			allowedDomains: config.allowedDomains,
			respectDNT: config.respectDNT
		}),
		flush,
		isEnabled: () => !isDisabled && !!config.axiomToken,
		getQueueSize: () => eventQueue.length,
		version: VERSION
	};
	//#endregion
})();
