(function() {
	//#region node_modules/@opentelemetry/api/build/esm/version.js
	const VERSION$3 = "1.9.1";
	//#endregion
	//#region node_modules/@opentelemetry/api/build/esm/internal/semver.js
	const re = /^(\d+)\.(\d+)\.(\d+)(-(.+))?$/;
	/**
	* Create a function to test an API version to see if it is compatible with the provided ownVersion.
	*
	* The returned function has the following semantics:
	* - Exact match is always compatible
	* - Major versions must match exactly
	*    - 1.x package cannot use global 2.x package
	*    - 2.x package cannot use global 1.x package
	* - The minor version of the API module requesting access to the global API must be less than or equal to the minor version of this API
	*    - 1.3 package may use 1.4 global because the later global contains all functions 1.3 expects
	*    - 1.4 package may NOT use 1.3 global because it may try to call functions which don't exist on 1.3
	* - If the major version is 0, the minor version is treated as the major and the patch is treated as the minor
	* - Patch and build tag differences are not considered at this time
	*
	* @param ownVersion version which should be checked against
	*/
	function _makeCompatibilityCheck(ownVersion) {
		const acceptedVersions = new Set([ownVersion]);
		const rejectedVersions = /* @__PURE__ */ new Set();
		const myVersionMatch = ownVersion.match(re);
		if (!myVersionMatch) return () => false;
		const ownVersionParsed = {
			major: +myVersionMatch[1],
			minor: +myVersionMatch[2],
			patch: +myVersionMatch[3],
			prerelease: myVersionMatch[4]
		};
		if (ownVersionParsed.prerelease != null) return function isExactmatch(globalVersion) {
			return globalVersion === ownVersion;
		};
		function _reject(v) {
			rejectedVersions.add(v);
			return false;
		}
		function _accept(v) {
			acceptedVersions.add(v);
			return true;
		}
		return function isCompatible(globalVersion) {
			if (acceptedVersions.has(globalVersion)) return true;
			if (rejectedVersions.has(globalVersion)) return false;
			const globalVersionMatch = globalVersion.match(re);
			if (!globalVersionMatch) return _reject(globalVersion);
			const globalVersionParsed = {
				major: +globalVersionMatch[1],
				minor: +globalVersionMatch[2],
				patch: +globalVersionMatch[3],
				prerelease: globalVersionMatch[4]
			};
			if (globalVersionParsed.prerelease != null) return _reject(globalVersion);
			if (ownVersionParsed.major !== globalVersionParsed.major) return _reject(globalVersion);
			if (ownVersionParsed.major === 0) {
				if (ownVersionParsed.minor === globalVersionParsed.minor && ownVersionParsed.patch <= globalVersionParsed.patch) return _accept(globalVersion);
				return _reject(globalVersion);
			}
			if (ownVersionParsed.minor <= globalVersionParsed.minor) return _accept(globalVersion);
			return _reject(globalVersion);
		};
	}
	/**
	* Test an API version to see if it is compatible with this API.
	*
	* - Exact match is always compatible
	* - Major versions must match exactly
	*    - 1.x package cannot use global 2.x package
	*    - 2.x package cannot use global 1.x package
	* - The minor version of the API module requesting access to the global API must be less than or equal to the minor version of this API
	*    - 1.3 package may use 1.4 global because the later global contains all functions 1.3 expects
	*    - 1.4 package may NOT use 1.3 global because it may try to call functions which don't exist on 1.3
	* - If the major version is 0, the minor version is treated as the major and the patch is treated as the minor
	* - Patch and build tag differences are not considered at this time
	*
	* @param version version of the API requesting an instance of the global API
	*/
	const isCompatible = _makeCompatibilityCheck(VERSION$3);
	//#endregion
	//#region node_modules/@opentelemetry/api/build/esm/internal/global-utils.js
	const major = VERSION$3.split(".")[0];
	const GLOBAL_OPENTELEMETRY_API_KEY = Symbol.for(`opentelemetry.js.api.${major}`);
	const _global$1 = typeof globalThis === "object" ? globalThis : typeof self === "object" ? self : typeof window === "object" ? window : typeof global === "object" ? global : {};
	function registerGlobal(type, instance, diag, allowOverride = false) {
		var _a;
		const api = _global$1[GLOBAL_OPENTELEMETRY_API_KEY] = (_a = _global$1[GLOBAL_OPENTELEMETRY_API_KEY]) !== null && _a !== void 0 ? _a : { version: VERSION$3 };
		if (!allowOverride && api[type]) {
			const err = /* @__PURE__ */ new Error(`@opentelemetry/api: Attempted duplicate registration of API: ${type}`);
			diag.error(err.stack || err.message);
			return false;
		}
		if (api.version !== "1.9.1") {
			const err = /* @__PURE__ */ new Error(`@opentelemetry/api: Registration of version v${api.version} for ${type} does not match previously registered API v${VERSION$3}`);
			diag.error(err.stack || err.message);
			return false;
		}
		api[type] = instance;
		diag.debug(`@opentelemetry/api: Registered a global for ${type} v${VERSION$3}.`);
		return true;
	}
	function getGlobal(type) {
		var _a, _b;
		const globalVersion = (_a = _global$1[GLOBAL_OPENTELEMETRY_API_KEY]) === null || _a === void 0 ? void 0 : _a.version;
		if (!globalVersion || !isCompatible(globalVersion)) return;
		return (_b = _global$1[GLOBAL_OPENTELEMETRY_API_KEY]) === null || _b === void 0 ? void 0 : _b[type];
	}
	function unregisterGlobal(type, diag) {
		diag.debug(`@opentelemetry/api: Unregistering a global for ${type} v${VERSION$3}.`);
		const api = _global$1[GLOBAL_OPENTELEMETRY_API_KEY];
		if (api) delete api[type];
	}
	//#endregion
	//#region node_modules/@opentelemetry/api/build/esm/diag/ComponentLogger.js
	/**
	* Component Logger which is meant to be used as part of any component which
	* will add automatically additional namespace in front of the log message.
	* It will then forward all message to global diag logger
	* @example
	* const cLogger = diag.createComponentLogger({ namespace: '@opentelemetry/instrumentation-http' });
	* cLogger.debug('test');
	* // @opentelemetry/instrumentation-http test
	*/
	var DiagComponentLogger = class {
		constructor(props) {
			this._namespace = props.namespace || "DiagComponentLogger";
		}
		debug(...args) {
			return logProxy("debug", this._namespace, args);
		}
		error(...args) {
			return logProxy("error", this._namespace, args);
		}
		info(...args) {
			return logProxy("info", this._namespace, args);
		}
		warn(...args) {
			return logProxy("warn", this._namespace, args);
		}
		verbose(...args) {
			return logProxy("verbose", this._namespace, args);
		}
	};
	function logProxy(funcName, namespace, args) {
		const logger = getGlobal("diag");
		if (!logger) return;
		return logger[funcName](namespace, ...args);
	}
	//#endregion
	//#region node_modules/@opentelemetry/api/build/esm/diag/types.js
	/**
	* Defines the available internal logging levels for the diagnostic logger, the numeric values
	* of the levels are defined to match the original values from the initial LogLevel to avoid
	* compatibility/migration issues for any implementation that assume the numeric ordering.
	*/
	var DiagLogLevel;
	(function(DiagLogLevel) {
		/** Diagnostic Logging level setting to disable all logging (except and forced logs) */
		DiagLogLevel[DiagLogLevel["NONE"] = 0] = "NONE";
		/** Identifies an error scenario */
		DiagLogLevel[DiagLogLevel["ERROR"] = 30] = "ERROR";
		/** Identifies a warning scenario */
		DiagLogLevel[DiagLogLevel["WARN"] = 50] = "WARN";
		/** General informational log message */
		DiagLogLevel[DiagLogLevel["INFO"] = 60] = "INFO";
		/** General debug log message */
		DiagLogLevel[DiagLogLevel["DEBUG"] = 70] = "DEBUG";
		/**
		* Detailed trace level logging should only be used for development, should only be set
		* in a development environment.
		*/
		DiagLogLevel[DiagLogLevel["VERBOSE"] = 80] = "VERBOSE";
		/** Used to set the logging level to include all logging */
		DiagLogLevel[DiagLogLevel["ALL"] = 9999] = "ALL";
	})(DiagLogLevel || (DiagLogLevel = {}));
	//#endregion
	//#region node_modules/@opentelemetry/api/build/esm/diag/internal/logLevelLogger.js
	function createLogLevelDiagLogger(maxLevel, logger) {
		if (maxLevel < DiagLogLevel.NONE) maxLevel = DiagLogLevel.NONE;
		else if (maxLevel > DiagLogLevel.ALL) maxLevel = DiagLogLevel.ALL;
		logger = logger || {};
		function _filterFunc(funcName, theLevel) {
			const theFunc = logger[funcName];
			if (typeof theFunc === "function" && maxLevel >= theLevel) return theFunc.bind(logger);
			return function() {};
		}
		return {
			error: _filterFunc("error", DiagLogLevel.ERROR),
			warn: _filterFunc("warn", DiagLogLevel.WARN),
			info: _filterFunc("info", DiagLogLevel.INFO),
			debug: _filterFunc("debug", DiagLogLevel.DEBUG),
			verbose: _filterFunc("verbose", DiagLogLevel.VERBOSE)
		};
	}
	//#endregion
	//#region node_modules/@opentelemetry/api/build/esm/api/diag.js
	const API_NAME$3 = "diag";
	/**
	* Singleton object which represents the entry point to the OpenTelemetry internal
	* diagnostic API
	*
	* @since 1.0.0
	*/
	var DiagAPI = class DiagAPI {
		/** Get the singleton instance of the DiagAPI API */
		static instance() {
			if (!this._instance) this._instance = new DiagAPI();
			return this._instance;
		}
		/**
		* Private internal constructor
		* @private
		*/
		constructor() {
			function _logProxy(funcName) {
				return function(...args) {
					const logger = getGlobal("diag");
					if (!logger) return;
					return logger[funcName](...args);
				};
			}
			const self = this;
			const setLogger = (logger, optionsOrLogLevel = { logLevel: DiagLogLevel.INFO }) => {
				var _a, _b, _c;
				if (logger === self) {
					const err = /* @__PURE__ */ new Error("Cannot use diag as the logger for itself. Please use a DiagLogger implementation like ConsoleDiagLogger or a custom implementation");
					self.error((_a = err.stack) !== null && _a !== void 0 ? _a : err.message);
					return false;
				}
				if (typeof optionsOrLogLevel === "number") optionsOrLogLevel = { logLevel: optionsOrLogLevel };
				const oldLogger = getGlobal("diag");
				const newLogger = createLogLevelDiagLogger((_b = optionsOrLogLevel.logLevel) !== null && _b !== void 0 ? _b : DiagLogLevel.INFO, logger);
				if (oldLogger && !optionsOrLogLevel.suppressOverrideMessage) {
					const stack = (_c = (/* @__PURE__ */ new Error()).stack) !== null && _c !== void 0 ? _c : "<failed to generate stacktrace>";
					oldLogger.warn(`Current logger will be overwritten from ${stack}`);
					newLogger.warn(`Current logger will overwrite one already registered from ${stack}`);
				}
				return registerGlobal("diag", newLogger, self, true);
			};
			self.setLogger = setLogger;
			self.disable = () => {
				unregisterGlobal(API_NAME$3, self);
			};
			self.createComponentLogger = (options) => {
				return new DiagComponentLogger(options);
			};
			self.verbose = _logProxy("verbose");
			self.debug = _logProxy("debug");
			self.info = _logProxy("info");
			self.warn = _logProxy("warn");
			self.error = _logProxy("error");
		}
	};
	//#endregion
	//#region node_modules/@opentelemetry/api/build/esm/context/context.js
	/**
	* Get a key to uniquely identify a context value
	*
	* @since 1.0.0
	*/
	function createContextKey(description) {
		return Symbol.for(description);
	}
	/**
	* The root context is used as the default parent context when there is no active context
	*
	* @since 1.0.0
	*/
	const ROOT_CONTEXT = new class BaseContext {
		/**
		* Construct a new context which inherits values from an optional parent context.
		*
		* @param parentContext a context from which to inherit values
		*/
		constructor(parentContext) {
			const self = this;
			self._currentContext = parentContext ? new Map(parentContext) : /* @__PURE__ */ new Map();
			self.getValue = (key) => self._currentContext.get(key);
			self.setValue = (key, value) => {
				const context = new BaseContext(self._currentContext);
				context._currentContext.set(key, value);
				return context;
			};
			self.deleteValue = (key) => {
				const context = new BaseContext(self._currentContext);
				context._currentContext.delete(key);
				return context;
			};
		}
	}();
	//#endregion
	//#region node_modules/@opentelemetry/api/build/esm/metrics/NoopMeter.js
	/**
	* NoopMeter is a noop implementation of the {@link Meter} interface. It reuses
	* constant NoopMetrics for all of its methods.
	*/
	var NoopMeter = class {
		constructor() {}
		/**
		* @see {@link Meter.createGauge}
		*/
		createGauge(_name, _options) {
			return NOOP_GAUGE_METRIC;
		}
		/**
		* @see {@link Meter.createHistogram}
		*/
		createHistogram(_name, _options) {
			return NOOP_HISTOGRAM_METRIC;
		}
		/**
		* @see {@link Meter.createCounter}
		*/
		createCounter(_name, _options) {
			return NOOP_COUNTER_METRIC;
		}
		/**
		* @see {@link Meter.createUpDownCounter}
		*/
		createUpDownCounter(_name, _options) {
			return NOOP_UP_DOWN_COUNTER_METRIC;
		}
		/**
		* @see {@link Meter.createObservableGauge}
		*/
		createObservableGauge(_name, _options) {
			return NOOP_OBSERVABLE_GAUGE_METRIC;
		}
		/**
		* @see {@link Meter.createObservableCounter}
		*/
		createObservableCounter(_name, _options) {
			return NOOP_OBSERVABLE_COUNTER_METRIC;
		}
		/**
		* @see {@link Meter.createObservableUpDownCounter}
		*/
		createObservableUpDownCounter(_name, _options) {
			return NOOP_OBSERVABLE_UP_DOWN_COUNTER_METRIC;
		}
		/**
		* @see {@link Meter.addBatchObservableCallback}
		*/
		addBatchObservableCallback(_callback, _observables) {}
		/**
		* @see {@link Meter.removeBatchObservableCallback}
		*/
		removeBatchObservableCallback(_callback) {}
	};
	var NoopMetric = class {};
	var NoopCounterMetric = class extends NoopMetric {
		add(_value, _attributes) {}
	};
	var NoopUpDownCounterMetric = class extends NoopMetric {
		add(_value, _attributes) {}
	};
	var NoopGaugeMetric = class extends NoopMetric {
		record(_value, _attributes) {}
	};
	var NoopHistogramMetric = class extends NoopMetric {
		record(_value, _attributes) {}
	};
	var NoopObservableMetric = class {
		addCallback(_callback) {}
		removeCallback(_callback) {}
	};
	var NoopObservableCounterMetric = class extends NoopObservableMetric {};
	var NoopObservableGaugeMetric = class extends NoopObservableMetric {};
	var NoopObservableUpDownCounterMetric = class extends NoopObservableMetric {};
	const NOOP_METER = new NoopMeter();
	const NOOP_COUNTER_METRIC = new NoopCounterMetric();
	const NOOP_GAUGE_METRIC = new NoopGaugeMetric();
	const NOOP_HISTOGRAM_METRIC = new NoopHistogramMetric();
	const NOOP_UP_DOWN_COUNTER_METRIC = new NoopUpDownCounterMetric();
	const NOOP_OBSERVABLE_COUNTER_METRIC = new NoopObservableCounterMetric();
	const NOOP_OBSERVABLE_GAUGE_METRIC = new NoopObservableGaugeMetric();
	const NOOP_OBSERVABLE_UP_DOWN_COUNTER_METRIC = new NoopObservableUpDownCounterMetric();
	/**
	* Create a no-op Meter
	*
	* @since 1.3.0
	*/
	function createNoopMeter() {
		return NOOP_METER;
	}
	//#endregion
	//#region node_modules/@opentelemetry/api/build/esm/context/NoopContextManager.js
	var NoopContextManager = class {
		active() {
			return ROOT_CONTEXT;
		}
		with(_context, fn, thisArg, ...args) {
			return fn.call(thisArg, ...args);
		}
		bind(_context, target) {
			return target;
		}
		enable() {
			return this;
		}
		disable() {
			return this;
		}
	};
	//#endregion
	//#region node_modules/@opentelemetry/api/build/esm/api/context.js
	const API_NAME$2 = "context";
	const NOOP_CONTEXT_MANAGER = new NoopContextManager();
	/**
	* Singleton object which represents the entry point to the OpenTelemetry Context API
	*
	* @since 1.0.0
	*/
	var ContextAPI = class ContextAPI {
		/** Empty private constructor prevents end users from constructing a new instance of the API */
		constructor() {}
		/** Get the singleton instance of the Context API */
		static getInstance() {
			if (!this._instance) this._instance = new ContextAPI();
			return this._instance;
		}
		/**
		* Set the current context manager.
		*
		* @returns true if the context manager was successfully registered, else false
		*/
		setGlobalContextManager(contextManager) {
			return registerGlobal(API_NAME$2, contextManager, DiagAPI.instance());
		}
		/**
		* Get the currently active context
		*/
		active() {
			return this._getContextManager().active();
		}
		/**
		* Execute a function with an active context
		*
		* @param context context to be active during function execution
		* @param fn function to execute in a context
		* @param thisArg optional receiver to be used for calling fn
		* @param args optional arguments forwarded to fn
		*/
		with(context, fn, thisArg, ...args) {
			return this._getContextManager().with(context, fn, thisArg, ...args);
		}
		/**
		* Bind a context to a target function or event emitter
		*
		* @param context context to bind to the event emitter or function. Defaults to the currently active context
		* @param target function or event emitter to bind
		*/
		bind(context, target) {
			return this._getContextManager().bind(context, target);
		}
		_getContextManager() {
			return getGlobal(API_NAME$2) || NOOP_CONTEXT_MANAGER;
		}
		/** Disable and remove the global context manager */
		disable() {
			this._getContextManager().disable();
			unregisterGlobal(API_NAME$2, DiagAPI.instance());
		}
	};
	//#endregion
	//#region node_modules/@opentelemetry/api/build/esm/trace/trace_flags.js
	/**
	* @since 1.0.0
	*/
	var TraceFlags;
	(function(TraceFlags) {
		/** Represents no flag set. */
		TraceFlags[TraceFlags["NONE"] = 0] = "NONE";
		/** Bit to represent whether trace is sampled in trace flags. */
		TraceFlags[TraceFlags["SAMPLED"] = 1] = "SAMPLED";
	})(TraceFlags || (TraceFlags = {}));
	/**
	* @since 1.0.0
	*/
	const INVALID_SPAN_CONTEXT = {
		traceId: "00000000000000000000000000000000",
		spanId: "0000000000000000",
		traceFlags: TraceFlags.NONE
	};
	//#endregion
	//#region node_modules/@opentelemetry/api/build/esm/trace/NonRecordingSpan.js
	/**
	* The NonRecordingSpan is the default {@link Span} that is used when no Span
	* implementation is available. All operations are no-op including context
	* propagation.
	*/
	var NonRecordingSpan = class {
		constructor(spanContext = INVALID_SPAN_CONTEXT) {
			this._spanContext = spanContext;
		}
		spanContext() {
			return this._spanContext;
		}
		setAttribute(_key, _value) {
			return this;
		}
		setAttributes(_attributes) {
			return this;
		}
		addEvent(_name, _attributes) {
			return this;
		}
		addLink(_link) {
			return this;
		}
		addLinks(_links) {
			return this;
		}
		setStatus(_status) {
			return this;
		}
		updateName(_name) {
			return this;
		}
		end(_endTime) {}
		isRecording() {
			return false;
		}
		recordException(_exception, _time) {}
	};
	//#endregion
	//#region node_modules/@opentelemetry/api/build/esm/trace/context-utils.js
	/**
	* span key
	*/
	const SPAN_KEY = createContextKey("OpenTelemetry Context Key SPAN");
	/**
	* Return the span if one exists
	*
	* @param context context to get span from
	*/
	function getSpan(context) {
		return context.getValue(SPAN_KEY) || void 0;
	}
	/**
	* Gets the span from the current context, if one exists.
	*/
	function getActiveSpan() {
		return getSpan(ContextAPI.getInstance().active());
	}
	/**
	* Set the span on a context
	*
	* @param context context to use as parent
	* @param span span to set active
	*/
	function setSpan(context, span) {
		return context.setValue(SPAN_KEY, span);
	}
	/**
	* Remove current span stored in the context
	*
	* @param context context to delete span from
	*/
	function deleteSpan(context) {
		return context.deleteValue(SPAN_KEY);
	}
	/**
	* Wrap span context in a NoopSpan and set as span in a new
	* context
	*
	* @param context context to set active span on
	* @param spanContext span context to be wrapped
	*/
	function setSpanContext(context, spanContext) {
		return setSpan(context, new NonRecordingSpan(spanContext));
	}
	/**
	* Get the span context of the span if it exists.
	*
	* @param context context to get values from
	*/
	function getSpanContext(context) {
		var _a;
		return (_a = getSpan(context)) === null || _a === void 0 ? void 0 : _a.spanContext();
	}
	//#endregion
	//#region node_modules/@opentelemetry/api/build/esm/trace/spancontext-utils.js
	const isHex = new Uint8Array([
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		1,
		1,
		1,
		1,
		1,
		1,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		1,
		1,
		1,
		1,
		1,
		1
	]);
	function isValidHex(id, length) {
		if (typeof id !== "string" || id.length !== length) return false;
		let r = 0;
		for (let i = 0; i < id.length; i += 4) r += (isHex[id.charCodeAt(i)] | 0) + (isHex[id.charCodeAt(i + 1)] | 0) + (isHex[id.charCodeAt(i + 2)] | 0) + (isHex[id.charCodeAt(i + 3)] | 0);
		return r === length;
	}
	/**
	* @since 1.0.0
	*/
	function isValidTraceId(traceId) {
		return isValidHex(traceId, 32) && traceId !== "00000000000000000000000000000000";
	}
	/**
	* @since 1.0.0
	*/
	function isValidSpanId(spanId) {
		return isValidHex(spanId, 16) && spanId !== "0000000000000000";
	}
	/**
	* Returns true if this {@link SpanContext} is valid.
	* @return true if this {@link SpanContext} is valid.
	*
	* @since 1.0.0
	*/
	function isSpanContextValid(spanContext) {
		return isValidTraceId(spanContext.traceId) && isValidSpanId(spanContext.spanId);
	}
	/**
	* Wrap the given {@link SpanContext} in a new non-recording {@link Span}
	*
	* @param spanContext span context to be wrapped
	* @returns a new non-recording {@link Span} with the provided context
	*/
	function wrapSpanContext(spanContext) {
		return new NonRecordingSpan(spanContext);
	}
	//#endregion
	//#region node_modules/@opentelemetry/api/build/esm/trace/NoopTracer.js
	const contextApi = ContextAPI.getInstance();
	/**
	* No-op implementations of {@link Tracer}.
	*/
	var NoopTracer = class {
		startSpan(name, options, context = contextApi.active()) {
			if (Boolean(options === null || options === void 0 ? void 0 : options.root)) return new NonRecordingSpan();
			const parentFromContext = context && getSpanContext(context);
			if (isSpanContext(parentFromContext) && isSpanContextValid(parentFromContext)) return new NonRecordingSpan(parentFromContext);
			else return new NonRecordingSpan();
		}
		startActiveSpan(name, arg2, arg3, arg4) {
			let opts;
			let ctx;
			let fn;
			if (arguments.length < 2) return;
			else if (arguments.length === 2) fn = arg2;
			else if (arguments.length === 3) {
				opts = arg2;
				fn = arg3;
			} else {
				opts = arg2;
				ctx = arg3;
				fn = arg4;
			}
			const parentContext = ctx !== null && ctx !== void 0 ? ctx : contextApi.active();
			const span = this.startSpan(name, opts, parentContext);
			const contextWithSpanSet = setSpan(parentContext, span);
			return contextApi.with(contextWithSpanSet, fn, void 0, span);
		}
	};
	function isSpanContext(spanContext) {
		return spanContext !== null && typeof spanContext === "object" && "spanId" in spanContext && typeof spanContext["spanId"] === "string" && "traceId" in spanContext && typeof spanContext["traceId"] === "string" && "traceFlags" in spanContext && typeof spanContext["traceFlags"] === "number";
	}
	//#endregion
	//#region node_modules/@opentelemetry/api/build/esm/trace/ProxyTracer.js
	const NOOP_TRACER = new NoopTracer();
	/**
	* Proxy tracer provided by the proxy tracer provider
	*
	* @since 1.0.0
	*/
	var ProxyTracer = class {
		constructor(provider, name, version, options) {
			this._provider = provider;
			this.name = name;
			this.version = version;
			this.options = options;
		}
		startSpan(name, options, context) {
			return this._getTracer().startSpan(name, options, context);
		}
		startActiveSpan(_name, _options, _context, _fn) {
			const tracer = this._getTracer();
			return Reflect.apply(tracer.startActiveSpan, tracer, arguments);
		}
		/**
		* Try to get a tracer from the proxy tracer provider.
		* If the proxy tracer provider has no delegate, return a noop tracer.
		*/
		_getTracer() {
			if (this._delegate) return this._delegate;
			const tracer = this._provider.getDelegateTracer(this.name, this.version, this.options);
			if (!tracer) return NOOP_TRACER;
			this._delegate = tracer;
			return this._delegate;
		}
	};
	//#endregion
	//#region node_modules/@opentelemetry/api/build/esm/trace/NoopTracerProvider.js
	/**
	* An implementation of the {@link TracerProvider} which returns an impotent
	* Tracer for all calls to `getTracer`.
	*
	* All operations are no-op.
	*/
	var NoopTracerProvider = class {
		getTracer(_name, _version, _options) {
			return new NoopTracer();
		}
	};
	//#endregion
	//#region node_modules/@opentelemetry/api/build/esm/trace/ProxyTracerProvider.js
	const NOOP_TRACER_PROVIDER = new NoopTracerProvider();
	/**
	* Tracer provider which provides {@link ProxyTracer}s.
	*
	* Before a delegate is set, tracers provided are NoOp.
	*   When a delegate is set, traces are provided from the delegate.
	*   When a delegate is set after tracers have already been provided,
	*   all tracers already provided will use the provided delegate implementation.
	*
	* @deprecated This will be removed in the next major version.
	* @since 1.0.0
	*/
	var ProxyTracerProvider = class {
		/**
		* Get a {@link ProxyTracer}
		*/
		getTracer(name, version, options) {
			var _a;
			return (_a = this.getDelegateTracer(name, version, options)) !== null && _a !== void 0 ? _a : new ProxyTracer(this, name, version, options);
		}
		getDelegate() {
			var _a;
			return (_a = this._delegate) !== null && _a !== void 0 ? _a : NOOP_TRACER_PROVIDER;
		}
		/**
		* Set the delegate tracer provider
		*/
		setDelegate(delegate) {
			this._delegate = delegate;
		}
		getDelegateTracer(name, version, options) {
			var _a;
			return (_a = this._delegate) === null || _a === void 0 ? void 0 : _a.getTracer(name, version, options);
		}
	};
	//#endregion
	//#region node_modules/@opentelemetry/api/build/esm/context-api.js
	/**
	* Entrypoint for context API
	* @since 1.0.0
	*/
	const context = ContextAPI.getInstance();
	//#endregion
	//#region node_modules/@opentelemetry/api/build/esm/diag-api.js
	/**
	* Entrypoint for Diag API.
	* Defines Diagnostic handler used for internal diagnostic logging operations.
	* The default provides a Noop DiagLogger implementation which may be changed via the
	* diag.setLogger(logger: DiagLogger) function.
	*
	* @since 1.0.0
	*/
	const diag = DiagAPI.instance();
	//#endregion
	//#region node_modules/@opentelemetry/api/build/esm/metrics/NoopMeterProvider.js
	/**
	* An implementation of the {@link MeterProvider} which returns an impotent Meter
	* for all calls to `getMeter`
	*/
	var NoopMeterProvider = class {
		getMeter(_name, _version, _options) {
			return NOOP_METER;
		}
	};
	const NOOP_METER_PROVIDER = new NoopMeterProvider();
	//#endregion
	//#region node_modules/@opentelemetry/api/build/esm/api/metrics.js
	const API_NAME$1 = "metrics";
	//#endregion
	//#region node_modules/@opentelemetry/api/build/esm/metrics-api.js
	/**
	* Entrypoint for metrics API
	*
	* @since 1.3.0
	*/
	const metrics = class MetricsAPI {
		/** Empty private constructor prevents end users from constructing a new instance of the API */
		constructor() {}
		/** Get the singleton instance of the Metrics API */
		static getInstance() {
			if (!this._instance) this._instance = new MetricsAPI();
			return this._instance;
		}
		/**
		* Set the current global meter provider.
		* Returns true if the meter provider was successfully registered, else false.
		*/
		setGlobalMeterProvider(provider) {
			return registerGlobal(API_NAME$1, provider, DiagAPI.instance());
		}
		/**
		* Returns the global meter provider.
		*/
		getMeterProvider() {
			return getGlobal(API_NAME$1) || NOOP_METER_PROVIDER;
		}
		/**
		* Returns a meter from the global meter provider.
		*/
		getMeter(name, version, options) {
			return this.getMeterProvider().getMeter(name, version, options);
		}
		/** Remove the global meter provider */
		disable() {
			unregisterGlobal(API_NAME$1, DiagAPI.instance());
		}
	}.getInstance();
	//#endregion
	//#region node_modules/@opentelemetry/api/build/esm/api/trace.js
	const API_NAME = "trace";
	//#endregion
	//#region node_modules/@opentelemetry/api/build/esm/trace-api.js
	/**
	* Entrypoint for trace API
	*
	* @since 1.0.0
	*/
	const trace = class TraceAPI {
		/** Empty private constructor prevents end users from constructing a new instance of the API */
		constructor() {
			this._proxyTracerProvider = new ProxyTracerProvider();
			this.wrapSpanContext = wrapSpanContext;
			this.isSpanContextValid = isSpanContextValid;
			this.deleteSpan = deleteSpan;
			this.getSpan = getSpan;
			this.getActiveSpan = getActiveSpan;
			this.getSpanContext = getSpanContext;
			this.setSpan = setSpan;
			this.setSpanContext = setSpanContext;
		}
		/** Get the singleton instance of the Trace API */
		static getInstance() {
			if (!this._instance) this._instance = new TraceAPI();
			return this._instance;
		}
		/**
		* Set the current global tracer.
		*
		* @returns true if the tracer provider was successfully registered, else false
		*/
		setGlobalTracerProvider(provider) {
			const success = registerGlobal(API_NAME, this._proxyTracerProvider, DiagAPI.instance());
			if (success) this._proxyTracerProvider.setDelegate(provider);
			return success;
		}
		/**
		* Returns the global tracer provider.
		*/
		getTracerProvider() {
			return getGlobal(API_NAME) || this._proxyTracerProvider;
		}
		/**
		* Returns a tracer from the global tracer provider.
		*/
		getTracer(name, version) {
			return this.getTracerProvider().getTracer(name, version);
		}
		/** Remove the global tracer provider */
		disable() {
			unregisterGlobal(API_NAME, DiagAPI.instance());
			this._proxyTracerProvider = new ProxyTracerProvider();
		}
	}.getInstance();
	//#endregion
	//#region node_modules/@opentelemetry/api-logs/build/esm/types/LogRecord.js
	var SeverityNumber;
	(function(SeverityNumber) {
		SeverityNumber[SeverityNumber["UNSPECIFIED"] = 0] = "UNSPECIFIED";
		SeverityNumber[SeverityNumber["TRACE"] = 1] = "TRACE";
		SeverityNumber[SeverityNumber["TRACE2"] = 2] = "TRACE2";
		SeverityNumber[SeverityNumber["TRACE3"] = 3] = "TRACE3";
		SeverityNumber[SeverityNumber["TRACE4"] = 4] = "TRACE4";
		SeverityNumber[SeverityNumber["DEBUG"] = 5] = "DEBUG";
		SeverityNumber[SeverityNumber["DEBUG2"] = 6] = "DEBUG2";
		SeverityNumber[SeverityNumber["DEBUG3"] = 7] = "DEBUG3";
		SeverityNumber[SeverityNumber["DEBUG4"] = 8] = "DEBUG4";
		SeverityNumber[SeverityNumber["INFO"] = 9] = "INFO";
		SeverityNumber[SeverityNumber["INFO2"] = 10] = "INFO2";
		SeverityNumber[SeverityNumber["INFO3"] = 11] = "INFO3";
		SeverityNumber[SeverityNumber["INFO4"] = 12] = "INFO4";
		SeverityNumber[SeverityNumber["WARN"] = 13] = "WARN";
		SeverityNumber[SeverityNumber["WARN2"] = 14] = "WARN2";
		SeverityNumber[SeverityNumber["WARN3"] = 15] = "WARN3";
		SeverityNumber[SeverityNumber["WARN4"] = 16] = "WARN4";
		SeverityNumber[SeverityNumber["ERROR"] = 17] = "ERROR";
		SeverityNumber[SeverityNumber["ERROR2"] = 18] = "ERROR2";
		SeverityNumber[SeverityNumber["ERROR3"] = 19] = "ERROR3";
		SeverityNumber[SeverityNumber["ERROR4"] = 20] = "ERROR4";
		SeverityNumber[SeverityNumber["FATAL"] = 21] = "FATAL";
		SeverityNumber[SeverityNumber["FATAL2"] = 22] = "FATAL2";
		SeverityNumber[SeverityNumber["FATAL3"] = 23] = "FATAL3";
		SeverityNumber[SeverityNumber["FATAL4"] = 24] = "FATAL4";
	})(SeverityNumber || (SeverityNumber = {}));
	//#endregion
	//#region node_modules/@opentelemetry/api-logs/build/esm/NoopLogger.js
	var NoopLogger = class {
		emit(_logRecord) {}
		enabled() {
			return false;
		}
	};
	const NOOP_LOGGER = new NoopLogger();
	/**
	* Create a no-op Logger
	*/
	function createNoopLogger() {
		return NOOP_LOGGER;
	}
	//#endregion
	//#region node_modules/@opentelemetry/api-logs/build/esm/internal/global-utils.js
	const GLOBAL_LOGS_API_KEY = Symbol.for("io.opentelemetry.js.api.logs");
	const _global = globalThis;
	/**
	* Make a function which accepts a version integer and returns the instance of an API if the version
	* is compatible, or a fallback version (usually NOOP) if it is not.
	*
	* @param requiredVersion Backwards compatibility version which is required to return the instance
	* @param instance Instance which should be returned if the required version is compatible
	* @param fallback Fallback instance, usually NOOP, which will be returned if the required version is not compatible
	*/
	function makeGetter(requiredVersion, instance, fallback) {
		return (version) => version === requiredVersion ? instance : fallback;
	}
	//#endregion
	//#region node_modules/@opentelemetry/api-logs/build/esm/NoopLoggerProvider.js
	var NoopLoggerProvider = class {
		getLogger(_name, _version, _options) {
			return new NoopLogger();
		}
	};
	const NOOP_LOGGER_PROVIDER = new NoopLoggerProvider();
	//#endregion
	//#region node_modules/@opentelemetry/api-logs/build/esm/ProxyLogger.js
	var ProxyLogger = class {
		constructor(provider, name, version, options) {
			this._provider = provider;
			this.name = name;
			this.version = version;
			this.options = options;
		}
		/**
		* Emit a log record. This method should only be used by log appenders.
		*
		* @param logRecord
		*/
		emit(logRecord) {
			this._getLogger().emit(logRecord);
		}
		enabled(options) {
			return this._getLogger().enabled(options);
		}
		/**
		* Try to get a logger from the proxy logger provider.
		* If the proxy logger provider has no delegate, return a noop logger.
		*/
		_getLogger() {
			if (this._delegate) return this._delegate;
			const logger = this._provider._getDelegateLogger(this.name, this.version, this.options);
			if (!logger) return NOOP_LOGGER;
			this._delegate = logger;
			return this._delegate;
		}
	};
	//#endregion
	//#region node_modules/@opentelemetry/api-logs/build/esm/ProxyLoggerProvider.js
	var ProxyLoggerProvider = class {
		getLogger(name, version, options) {
			var _a;
			return (_a = this._getDelegateLogger(name, version, options)) !== null && _a !== void 0 ? _a : new ProxyLogger(this, name, version, options);
		}
		/**
		* Get the delegate logger provider.
		* Used by tests only.
		* @internal
		*/
		_getDelegate() {
			var _a;
			return (_a = this._delegate) !== null && _a !== void 0 ? _a : NOOP_LOGGER_PROVIDER;
		}
		/**
		* Set the delegate logger provider
		* @internal
		*/
		_setDelegate(delegate) {
			this._delegate = delegate;
		}
		/**
		* @internal
		*/
		_getDelegateLogger(name, version, options) {
			var _a;
			return (_a = this._delegate) === null || _a === void 0 ? void 0 : _a.getLogger(name, version, options);
		}
	};
	//#endregion
	//#region node_modules/@opentelemetry/api-logs/build/esm/index.js
	const logs = class LogsAPI {
		constructor() {
			this._proxyLoggerProvider = new ProxyLoggerProvider();
		}
		static getInstance() {
			if (!this._instance) this._instance = new LogsAPI();
			return this._instance;
		}
		setGlobalLoggerProvider(provider) {
			if (_global[GLOBAL_LOGS_API_KEY]) return this.getLoggerProvider();
			_global[GLOBAL_LOGS_API_KEY] = makeGetter(1, provider, NOOP_LOGGER_PROVIDER);
			this._proxyLoggerProvider._setDelegate(provider);
			return provider;
		}
		/**
		* Returns the global logger provider.
		*
		* @returns LoggerProvider
		*/
		getLoggerProvider() {
			var _a, _b;
			return (_b = (_a = _global[GLOBAL_LOGS_API_KEY]) === null || _a === void 0 ? void 0 : _a.call(_global, 1)) !== null && _b !== void 0 ? _b : this._proxyLoggerProvider;
		}
		/**
		* Returns a Logger, creating one if one with the given name, version,
		* schemaUrl, and attributes is not already created.
		*
		* Getting a Logger may be expensive, especially when `attributes` are
		* provided. Reuse Logger instances where possible instead of calling
		* `getLogger()` on hot paths.
		*
		* @param name The name of the logger or instrumentation library.
		* @param version The version of the logger or instrumentation library.
		* @param options The options of the logger or instrumentation library.
		* @returns {@link Logger}
		*/
		getLogger(name, version, options) {
			return this.getLoggerProvider().getLogger(name, version, options);
		}
		/** Remove the global logger provider */
		disable() {
			delete _global[GLOBAL_LOGS_API_KEY];
			this._proxyLoggerProvider = new ProxyLoggerProvider();
		}
	}.getInstance();
	//#endregion
	//#region node_modules/@opentelemetry/core/build/esm/trace/suppress-tracing.js
	const SUPPRESS_TRACING_KEY = createContextKey("OpenTelemetry SDK Context Key SUPPRESS_TRACING");
	function suppressTracing(context) {
		return context.setValue(SUPPRESS_TRACING_KEY, true);
	}
	//#endregion
	//#region node_modules/@opentelemetry/core/build/esm/common/logging-error-handler.js
	/**
	* Returns a function that logs an error using the provided logger, or a
	* console logger if one was not provided.
	*/
	function loggingErrorHandler() {
		return (ex) => {
			diag.error(stringifyException(ex));
		};
	}
	/**
	* Converts an exception into a string representation
	* @param {Exception} ex
	*/
	function stringifyException(ex) {
		if (typeof ex === "string") return ex;
		else return JSON.stringify(flattenException(ex));
	}
	/**
	* Flattens an exception into key-value pairs by traversing the prototype chain
	* and coercing values to strings. Duplicate properties will not be overwritten;
	* the first insert wins.
	*/
	function flattenException(ex) {
		const result = {};
		let current = ex;
		while (current !== null) {
			Object.getOwnPropertyNames(current).forEach((propertyName) => {
				if (result[propertyName]) return;
				const value = current[propertyName];
				if (value) result[propertyName] = String(value);
			});
			current = Object.getPrototypeOf(current);
		}
		return result;
	}
	//#endregion
	//#region node_modules/@opentelemetry/core/build/esm/common/global-error-handler.js
	/** The global error handler delegate */
	let delegateHandler = loggingErrorHandler();
	/**
	* Return the global error handler
	* @param {Exception} ex
	*/
	function globalErrorHandler(ex) {
		try {
			delegateHandler(ex);
		} catch {}
	}
	//#endregion
	//#region node_modules/@opentelemetry/core/build/esm/version.js
	const VERSION$2 = "2.10.0";
	//#endregion
	//#region node_modules/@opentelemetry/semantic-conventions/build/esm/stable_attributes.js
	/**
	* The exception message.
	*
	* @example Division by zero
	* @example Can't convert 'int' object to str implicitly
	*
	* @note > [!WARNING]
	*
	* > This attribute may contain sensitive information.
	*/
	const ATTR_EXCEPTION_MESSAGE = "exception.message";
	/**
	* A stacktrace as a string in the natural representation for the language runtime. The representation is to be determined and documented by each language SIG.
	*
	* @example "Exception in thread "main" java.lang.RuntimeException: Test exception\\n at com.example.GenerateTrace.methodB(GenerateTrace.java:13)\\n at com.example.GenerateTrace.methodA(GenerateTrace.java:9)\\n at com.example.GenerateTrace.main(GenerateTrace.java:5)\\n"
	*/
	const ATTR_EXCEPTION_STACKTRACE = "exception.stacktrace";
	/**
	* The type of the exception (its fully-qualified class name, if applicable). The dynamic type of the exception should be preferred over the static type in languages that support it.
	*
	* @example java.net.ConnectException
	* @example OSError
	*
	* @note If the recorded exception type is a wrapper that is not meaningful for
	* failure classification, instrumentation **MAY** use the type of the inner
	* exception instead. For example, in Go, errors created with `fmt.Errorf`
	* using `%w` **MAY** be unwrapped when the wrapper type does not help
	* classify the failure.
	*/
	const ATTR_EXCEPTION_TYPE = "exception.type";
	/**
	* Logical name of the service.
	*
	* @example shoppingcart
	*
	* @note **MUST** be the same for all instances of horizontally scaled services. If the value was not specified, SDKs **MUST** fallback to `unknown_service:` concatenated with the process executable name, e.g. `unknown_service:bash`. If the process executable name is not available, the value **MUST** be set to `unknown_service`.
	* The process executable name is the name of the process executable, the same value as described by the [`process.executable.name`](process.md) resource attribute.
	*/
	const ATTR_SERVICE_NAME = "service.name";
	/**
	* The language of the telemetry SDK.
	*/
	const ATTR_TELEMETRY_SDK_LANGUAGE = "telemetry.sdk.language";
	/**
	* Enum value "webjs" for attribute {@link ATTR_TELEMETRY_SDK_LANGUAGE}.
	*/
	const TELEMETRY_SDK_LANGUAGE_VALUE_WEBJS = "webjs";
	/**
	* The name of the telemetry SDK as defined above.
	*
	* @example opentelemetry
	*
	* @note The OpenTelemetry SDK **MUST** set the `telemetry.sdk.name` attribute to `opentelemetry`.
	* If another SDK, like a fork or a vendor-provided implementation, is used, this SDK **MUST** set the
	* `telemetry.sdk.name` attribute to the fully-qualified class or module name of this SDK's main entry point
	* or another suitable identifier depending on the language.
	* The identifier `opentelemetry` is reserved and **MUST NOT** be used in this case.
	* All custom identifiers **SHOULD** be stable across different versions of an implementation.
	*/
	const ATTR_TELEMETRY_SDK_NAME = "telemetry.sdk.name";
	/**
	* The version string of the telemetry SDK.
	*
	* @example 1.2.3
	*/
	const ATTR_TELEMETRY_SDK_VERSION = "telemetry.sdk.version";
	//#endregion
	//#region node_modules/@opentelemetry/core/build/esm/semconv.js
	/**
	* The name of the runtime of this process.
	*
	* @example OpenJDK Runtime Environment
	*
	* @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
	*/
	const ATTR_PROCESS_RUNTIME_NAME = "process.runtime.name";
	//#endregion
	//#region node_modules/@opentelemetry/core/build/esm/platform/browser/sdk-info.js
	/** Constants describing the SDK in use */
	const SDK_INFO = {
		[ATTR_TELEMETRY_SDK_NAME]: "opentelemetry",
		[ATTR_PROCESS_RUNTIME_NAME]: "browser",
		[ATTR_TELEMETRY_SDK_LANGUAGE]: TELEMETRY_SDK_LANGUAGE_VALUE_WEBJS,
		[ATTR_TELEMETRY_SDK_VERSION]: VERSION$2
	};
	//#endregion
	//#region node_modules/@opentelemetry/core/build/esm/platform/browser/index.js
	/**
	* @deprecated Use performance directly.
	*/
	const otperformance = performance;
	//#endregion
	//#region node_modules/@opentelemetry/core/build/esm/common/time.js
	const NANOSECOND_DIGITS = 9;
	const MILLISECONDS_TO_NANOSECONDS = Math.pow(10, 6);
	const SECOND_TO_NANOSECONDS = Math.pow(10, NANOSECOND_DIGITS);
	/**
	* Converts a number of milliseconds from epoch to HrTime([seconds, remainder in nanoseconds]).
	* @param epochMillis
	*/
	function millisToHrTime(epochMillis) {
		const epochSeconds = epochMillis / 1e3;
		return [Math.trunc(epochSeconds), Math.round(epochMillis % 1e3 * MILLISECONDS_TO_NANOSECONDS)];
	}
	/**
	* Returns an hrtime calculated via performance component.
	* @param performanceNow
	*/
	function hrTime(performanceNow) {
		return addHrTimes(millisToHrTime(otperformance.timeOrigin), millisToHrTime(typeof performanceNow === "number" ? performanceNow : otperformance.now()));
	}
	/**
	*
	* Converts a TimeInput to an HrTime, defaults to _hrtime().
	* @param time
	*/
	function timeInputToHrTime(time) {
		if (isTimeInputHrTime(time)) return time;
		else if (typeof time === "number") if (time < otperformance.timeOrigin / 2) return hrTime(time);
		else return millisToHrTime(time);
		else if (time instanceof Date) return millisToHrTime(time.getTime());
		else throw TypeError("Invalid input type");
	}
	/**
	* check if time is HrTime
	* @param value
	*/
	function isTimeInputHrTime(value) {
		return Array.isArray(value) && value.length === 2 && typeof value[0] === "number" && typeof value[1] === "number";
	}
	/**
	* Given 2 HrTime formatted times, return their sum as an HrTime.
	*/
	function addHrTimes(time1, time2) {
		const out = [time1[0] + time2[0], time1[1] + time2[1]];
		if (out[1] >= SECOND_TO_NANOSECONDS) {
			out[1] -= SECOND_TO_NANOSECONDS;
			out[0] += 1;
		}
		return out;
	}
	//#endregion
	//#region node_modules/@opentelemetry/core/build/esm/ExportResult.js
	var ExportResultCode;
	(function(ExportResultCode) {
		ExportResultCode[ExportResultCode["SUCCESS"] = 0] = "SUCCESS";
		ExportResultCode[ExportResultCode["FAILED"] = 1] = "FAILED";
	})(ExportResultCode || (ExportResultCode = {}));
	//#endregion
	//#region node_modules/@opentelemetry/core/build/esm/utils/timeout.js
	/**
	* Error that is thrown on timeouts.
	*/
	var TimeoutError = class TimeoutError extends Error {
		constructor(message) {
			super(message);
			Object.setPrototypeOf(this, TimeoutError.prototype);
		}
	};
	/**
	* Adds a timeout to a promise and rejects if the specified timeout has elapsed. Also rejects if the specified promise
	* rejects, and resolves if the specified promise resolves.
	*
	* <p> NOTE: this operation will continue even after it throws a {@link TimeoutError}.
	*
	* @param promise promise to use with timeout.
	* @param timeout the timeout in milliseconds until the returned promise is rejected.
	*/
	function callWithTimeout(promise, timeout) {
		let timeoutHandle;
		const timeoutPromise = new Promise(function timeoutFunction(_resolve, reject) {
			timeoutHandle = setTimeout(function timeoutHandler() {
				reject(new TimeoutError("Operation timed out."));
			}, timeout);
		});
		return Promise.race([promise, timeoutPromise]).then((result) => {
			clearTimeout(timeoutHandle);
			return result;
		}, (reason) => {
			clearTimeout(timeoutHandle);
			throw reason;
		});
	}
	//#endregion
	//#region node_modules/@opentelemetry/core/build/esm/utils/promise.js
	var Deferred = class {
		_promise;
		_resolve;
		_reject;
		constructor() {
			this._promise = new Promise((resolve, reject) => {
				this._resolve = resolve;
				this._reject = reject;
			});
		}
		get promise() {
			return this._promise;
		}
		resolve(val) {
			this._resolve(val);
		}
		reject(err) {
			this._reject(err);
		}
	};
	//#endregion
	//#region node_modules/@opentelemetry/core/build/esm/utils/callback.js
	/**
	* Bind the callback and only invoke the callback once regardless how many times `BindOnceFuture.call` is invoked.
	*/
	var BindOnceFuture = class {
		_isCalled = false;
		_deferred = new Deferred();
		_callback;
		_that;
		constructor(callback, that) {
			this._callback = callback;
			this._that = that;
		}
		get isCalled() {
			return this._isCalled;
		}
		get promise() {
			return this._deferred.promise;
		}
		call(...args) {
			if (!this._isCalled) {
				this._isCalled = true;
				try {
					Promise.resolve(this._callback.call(this._that, ...args)).then((val) => this._deferred.resolve(val), (err) => this._deferred.reject(err));
				} catch (err) {
					this._deferred.reject(err);
				}
			}
			return this._deferred.promise;
		}
	};
	//#endregion
	//#region node_modules/@opentelemetry/core/build/esm/internal/exporter.js
	/**
	* @internal
	* Shared functionality used by Exporters while exporting data, including suppression of Traces.
	*/
	function _export(exporter, arg) {
		return new Promise((resolve) => {
			context.with(suppressTracing(context.active()), () => {
				exporter.export(arg, resolve);
			});
		});
	}
	//#endregion
	//#region node_modules/@opentelemetry/core/build/esm/index.js
	const internal = { _export };
	//#endregion
	//#region node_modules/@opentelemetry/resources/build/esm/default-service-name.js
	let serviceName;
	/**
	* Returns the default service name for OpenTelemetry resources.
	* In Node.js environments, returns "unknown_service:<process.argv0>".
	* In browser/edge environments, returns "unknown_service".
	*/
	function defaultServiceName() {
		if (serviceName === void 0) try {
			const argv0 = globalThis.process.argv0;
			serviceName = argv0 ? `unknown_service:${argv0}` : "unknown_service";
		} catch {
			serviceName = "unknown_service";
		}
		return serviceName;
	}
	//#endregion
	//#region node_modules/@opentelemetry/resources/build/esm/utils.js
	const isPromiseLike = (val) => {
		return val !== null && typeof val === "object" && typeof val.then === "function";
	};
	//#endregion
	//#region node_modules/@opentelemetry/resources/build/esm/ResourceImpl.js
	var ResourceImpl = class ResourceImpl {
		_rawAttributes;
		_asyncAttributesPending = false;
		_schemaUrl;
		_memoizedAttributes;
		static FromAttributeList(attributes, options) {
			const res = new ResourceImpl({}, options);
			res._rawAttributes = guardedRawAttributes(attributes);
			res._asyncAttributesPending = attributes.filter(([_, val]) => isPromiseLike(val)).length > 0;
			return res;
		}
		constructor(resource, options) {
			const attributes = resource.attributes ?? {};
			this._rawAttributes = Object.entries(attributes).map(([k, v]) => {
				if (isPromiseLike(v)) this._asyncAttributesPending = true;
				return [k, v];
			});
			this._rawAttributes = guardedRawAttributes(this._rawAttributes);
			this._schemaUrl = validateSchemaUrl(options?.schemaUrl);
		}
		get asyncAttributesPending() {
			return this._asyncAttributesPending;
		}
		async waitForAsyncAttributes() {
			if (!this.asyncAttributesPending) return;
			for (let i = 0; i < this._rawAttributes.length; i++) {
				const [k, v] = this._rawAttributes[i];
				this._rawAttributes[i] = [k, isPromiseLike(v) ? await v : v];
			}
			this._asyncAttributesPending = false;
		}
		get attributes() {
			if (this.asyncAttributesPending) diag.error("Accessing resource attributes before async attributes settled");
			if (this._memoizedAttributes) return this._memoizedAttributes;
			const attrs = {};
			for (const [k, v] of this._rawAttributes) {
				if (isPromiseLike(v)) {
					diag.debug(`Unsettled resource attribute ${k} skipped`);
					continue;
				}
				if (v != null) attrs[k] ??= v;
			}
			if (!this._asyncAttributesPending) this._memoizedAttributes = attrs;
			return attrs;
		}
		getRawAttributes() {
			return this._rawAttributes;
		}
		get schemaUrl() {
			return this._schemaUrl;
		}
		merge(resource) {
			if (resource == null) return this;
			const mergedSchemaUrl = mergeSchemaUrl(this, resource);
			const mergedOptions = mergedSchemaUrl ? { schemaUrl: mergedSchemaUrl } : void 0;
			return ResourceImpl.FromAttributeList([...resource.getRawAttributes(), ...this.getRawAttributes()], mergedOptions);
		}
	};
	function resourceFromAttributes(attributes, options) {
		return ResourceImpl.FromAttributeList(Object.entries(attributes), options);
	}
	function defaultResource() {
		return resourceFromAttributes({
			[ATTR_SERVICE_NAME]: defaultServiceName(),
			[ATTR_TELEMETRY_SDK_LANGUAGE]: SDK_INFO[ATTR_TELEMETRY_SDK_LANGUAGE],
			[ATTR_TELEMETRY_SDK_NAME]: SDK_INFO[ATTR_TELEMETRY_SDK_NAME],
			[ATTR_TELEMETRY_SDK_VERSION]: SDK_INFO[ATTR_TELEMETRY_SDK_VERSION]
		});
	}
	function guardedRawAttributes(attributes) {
		return attributes.map(([k, v]) => {
			if (isPromiseLike(v)) return [k, v.catch((err) => {
				diag.debug("promise rejection for resource attribute: %s - %s", k, err);
			})];
			return [k, v];
		});
	}
	function validateSchemaUrl(schemaUrl) {
		if (typeof schemaUrl === "string" || schemaUrl === void 0) return schemaUrl;
		diag.warn("Schema URL must be string or undefined, got %s. Schema URL will be ignored.", schemaUrl);
	}
	function mergeSchemaUrl(old, updating) {
		const oldSchemaUrl = old?.schemaUrl;
		const updatingSchemaUrl = updating?.schemaUrl;
		const isOldEmpty = oldSchemaUrl === void 0 || oldSchemaUrl === "";
		const isUpdatingEmpty = updatingSchemaUrl === void 0 || updatingSchemaUrl === "";
		if (isOldEmpty) return updatingSchemaUrl;
		if (isUpdatingEmpty) return oldSchemaUrl;
		if (oldSchemaUrl === updatingSchemaUrl) return oldSchemaUrl;
		diag.warn("Schema URL merge conflict: old resource has \"%s\", updating resource has \"%s\". Resulting resource will have undefined Schema URL.", oldSchemaUrl, updatingSchemaUrl);
	}
	//#endregion
	//#region node_modules/@opentelemetry/sdk-logs/build/esm/utils/validation.js
	/**
	* Validates if a value is a valid AnyValue for Log Attributes according to OpenTelemetry spec.
	* Log Attributes support a superset of standard Attributes and must support:
	* - Scalar values: string, boolean, signed 64-bit integer, or double precision floating point
	* - Byte arrays (Uint8Array)
	* - Arrays of any values (heterogeneous arrays allowed)
	* - Maps from string to any value (nested objects)
	* - Empty values (null/undefined)
	*
	* @param val - The value to validate
	* @returns true if the value is a valid AnyValue, false otherwise
	*/
	function isLogAttributeValue(val) {
		return isLogAttributeValueInternal(val, /* @__PURE__ */ new WeakSet());
	}
	function isLogAttributeValueInternal(val, visited) {
		if (val == null) return true;
		if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") return true;
		if (val instanceof Uint8Array) return true;
		if (typeof val === "object") {
			if (visited.has(val)) return false;
			visited.add(val);
			if (Array.isArray(val)) {
				for (const item of val) if (!isLogAttributeValueInternal(item, visited)) return false;
				return true;
			}
			const obj = val;
			if (obj.constructor !== Object && obj.constructor !== void 0) return false;
			for (const key in obj) if (Object.prototype.hasOwnProperty.call(obj, key) && !isLogAttributeValueInternal(obj[key], visited)) return false;
			return true;
		}
		return false;
	}
	var AddAttributeDecision;
	(function(AddAttributeDecision) {
		AddAttributeDecision[AddAttributeDecision["DROP_INVALID"] = 0] = "DROP_INVALID";
		AddAttributeDecision[AddAttributeDecision["DROP_LIMIT_REACHED"] = 1] = "DROP_LIMIT_REACHED";
		AddAttributeDecision[AddAttributeDecision["ADD_NEW"] = 2] = "ADD_NEW";
		AddAttributeDecision[AddAttributeDecision["ADD_OVERWRITE_EXISTING"] = 3] = "ADD_OVERWRITE_EXISTING";
	})(AddAttributeDecision || (AddAttributeDecision = {}));
	function addAttribute(attributes, limits, currentAttributesCount, key, value) {
		if (key.length === 0) {
			diag.warn(`Invalid attribute key: ${key}`);
			return AddAttributeDecision.DROP_INVALID;
		}
		if (!isLogAttributeValue(value)) {
			diag.warn(`Invalid attribute value set for key: ${key}`);
			return AddAttributeDecision.DROP_INVALID;
		}
		const isNewKey = !Object.prototype.hasOwnProperty.call(attributes, key);
		if (isNewKey && currentAttributesCount >= limits.attributeCountLimit) return AddAttributeDecision.DROP_LIMIT_REACHED;
		attributes[key] = truncateToSize(value, limits.attributeValueLengthLimit);
		if (isNewKey) return AddAttributeDecision.ADD_NEW;
		return AddAttributeDecision.ADD_OVERWRITE_EXISTING;
	}
	function truncateToSize(value, limit) {
		if (limit <= 0) {
			diag.warn(`Attribute value limit must be positive, got ${limit}`);
			return value;
		}
		if (value == null) return value;
		if (typeof value === "string") {
			if (value.length <= limit) return value;
			return value.substring(0, limit);
		}
		if (value instanceof Uint8Array) return value;
		if (Array.isArray(value)) return value.map((val) => truncateToSize(val, limit));
		if (typeof value === "object") {
			const truncatedObj = {};
			for (const [k, v] of Object.entries(value)) truncatedObj[k] = truncateToSize(v, limit);
			return truncatedObj;
		}
		return value;
	}
	/**
	* Normalize attributes for use on the instrumentation scope. Drops invalid attributes and keeps track of
	* how many were dropped.
	*
	* @param limits
	* @param attributes
	*/
	function normalizeScopeAttributes(limits, attributes) {
		if (attributes == null) return {};
		const normalizedAttributes = {};
		let currentAttributesCount = 0;
		let droppedAttributesCount = 0;
		for (const [key, value] of Object.entries(attributes)) {
			const decision = addAttribute(normalizedAttributes, limits, currentAttributesCount, key, value);
			if (decision === AddAttributeDecision.ADD_NEW) currentAttributesCount += 1;
			else if (decision === AddAttributeDecision.DROP_INVALID) droppedAttributesCount += 1;
			else if (decision === AddAttributeDecision.DROP_LIMIT_REACHED) droppedAttributesCount += 1;
		}
		return {
			attributes: currentAttributesCount > 0 ? normalizedAttributes : void 0,
			droppedAttributesCount
		};
	}
	//#endregion
	//#region node_modules/@opentelemetry/sdk-logs/build/esm/LogRecordImpl.js
	var LogRecordImpl = class {
		resource;
		instrumentationScope;
		attributes = {};
		_hrTime;
		_hrTimeObserved;
		_spanContext;
		_severityText;
		_severityNumber;
		_body;
		_eventName;
		_attributesCount = 0;
		_droppedAttributesCount = 0;
		_isReadonly = false;
		_logRecordLimits;
		get hrTime() {
			return this._hrTime;
		}
		set hrTime(hrTime) {
			if (this._isLogRecordReadonly()) return;
			this._hrTime = hrTime;
		}
		get hrTimeObserved() {
			return this._hrTimeObserved;
		}
		set hrTimeObserved(hrTimeObserved) {
			if (this._isLogRecordReadonly()) return;
			this._hrTimeObserved = hrTimeObserved;
		}
		get spanContext() {
			return this._spanContext;
		}
		set spanContext(spanContext) {
			if (this._isLogRecordReadonly()) return;
			this._spanContext = spanContext;
		}
		set severityText(severityText) {
			if (this._isLogRecordReadonly()) return;
			this._severityText = severityText;
		}
		get severityText() {
			return this._severityText;
		}
		set severityNumber(severityNumber) {
			if (this._isLogRecordReadonly()) return;
			this._severityNumber = severityNumber;
		}
		get severityNumber() {
			return this._severityNumber;
		}
		set body(body) {
			if (this._isLogRecordReadonly()) return;
			this._body = body;
		}
		get body() {
			return this._body;
		}
		get eventName() {
			return this._eventName;
		}
		set eventName(eventName) {
			if (this._isLogRecordReadonly()) return;
			this._eventName = eventName;
		}
		get droppedAttributesCount() {
			return this._droppedAttributesCount;
		}
		constructor(_sharedState, instrumentationScope, logRecord) {
			const { timestamp, observedTimestamp, eventName, severityNumber, severityText, body, attributes = {}, exception, context } = logRecord;
			const now = Date.now();
			this._hrTime = timeInputToHrTime(timestamp ?? now);
			this._hrTimeObserved = timeInputToHrTime(observedTimestamp ?? now);
			if (context) {
				const spanContext = trace.getSpanContext(context);
				if (spanContext && isSpanContextValid(spanContext)) this._spanContext = spanContext;
			}
			this.severityNumber = severityNumber;
			this.severityText = severityText;
			this.body = body;
			this.resource = _sharedState.resource;
			this.instrumentationScope = instrumentationScope;
			this._logRecordLimits = _sharedState.logRecordLimits;
			this._eventName = eventName;
			this.setAttributes(attributes);
			if (exception != null) this._setException(exception);
		}
		setAttribute(key, value) {
			if (this._isLogRecordReadonly()) return this;
			const decision = addAttribute(this.attributes, this._logRecordLimits, this._attributesCount, key, value);
			if (decision === AddAttributeDecision.DROP_LIMIT_REACHED) {
				this._droppedAttributesCount++;
				if (this._droppedAttributesCount === 1) diag.warn("Dropping extra attributes.");
			} else if (decision === AddAttributeDecision.ADD_NEW) this._attributesCount++;
			return this;
		}
		setAttributes(attributes) {
			for (const [k, v] of Object.entries(attributes)) this.setAttribute(k, v);
			return this;
		}
		setBody(body) {
			this.body = body;
			return this;
		}
		setEventName(eventName) {
			this.eventName = eventName;
			return this;
		}
		setSeverityNumber(severityNumber) {
			this.severityNumber = severityNumber;
			return this;
		}
		setSeverityText(severityText) {
			this.severityText = severityText;
			return this;
		}
		/**
		* @internal
		* A LogRecordProcessor may freely modify logRecord for the duration of the OnEmit call.
		* If logRecord is needed after OnEmit returns (i.e. for asynchronous processing) only reads are permitted.
		*/
		_makeReadonly() {
			this._isReadonly = true;
		}
		_setException(exception) {
			let hasMinimumAttributes = false;
			if (typeof exception === "string" || typeof exception === "number") {
				if (!Object.hasOwn(this.attributes, "exception.message")) this.setAttribute(ATTR_EXCEPTION_MESSAGE, String(exception));
				hasMinimumAttributes = true;
			} else if (exception && typeof exception === "object") {
				const exceptionObj = exception;
				if (exceptionObj.code) {
					if (!Object.hasOwn(this.attributes, "exception.type")) this.setAttribute(ATTR_EXCEPTION_TYPE, exceptionObj.code.toString());
					hasMinimumAttributes = true;
				} else if (exceptionObj.name) {
					if (!Object.hasOwn(this.attributes, "exception.type")) this.setAttribute(ATTR_EXCEPTION_TYPE, exceptionObj.name);
					hasMinimumAttributes = true;
				}
				if (exceptionObj.message) {
					if (!Object.hasOwn(this.attributes, "exception.message")) this.setAttribute(ATTR_EXCEPTION_MESSAGE, exceptionObj.message);
					hasMinimumAttributes = true;
				}
				if (exceptionObj.stack) {
					if (!Object.hasOwn(this.attributes, "exception.stacktrace")) this.setAttribute(ATTR_EXCEPTION_STACKTRACE, exceptionObj.stack);
					hasMinimumAttributes = true;
				}
			}
			if (!hasMinimumAttributes) diag.warn(`Failed to record an exception ${exception}`);
		}
		_isLogRecordReadonly() {
			if (this._isReadonly) diag.warn("Can not execute the operation on emitted log record");
			return this._isReadonly;
		}
	};
	//#endregion
	//#region node_modules/@opentelemetry/sdk-logs/build/esm/Logger.js
	var Logger = class {
		_instrumentationScope;
		_sharedState;
		_loggerConfig;
		constructor(instrumentationScope, sharedState) {
			this._instrumentationScope = instrumentationScope;
			this._sharedState = sharedState;
			this._loggerConfig = this._sharedState.getLoggerConfig(this._instrumentationScope);
		}
		emit(logRecord) {
			const currentContext = logRecord.context || context.active();
			if (!this.enabled(logRecord)) return;
			/**
			* If a Logger was obtained with include_trace_context=true,
			* the LogRecords it emits MUST automatically include the Trace Context from the active Context,
			* if Context has not been explicitly set.
			*/
			const logRecordInstance = new LogRecordImpl(this._sharedState, this._instrumentationScope, {
				context: currentContext,
				...logRecord
			});
			this._sharedState.loggerMetrics.emitLog();
			/**
			* the explicitly passed Context,
			* the current Context, or an empty Context if the Logger was obtained with include_trace_context=false
			*/
			this._sharedState.activeProcessor.onEmit(logRecordInstance, currentContext);
			/**
			* A LogRecordProcessor may freely modify logRecord for the duration of the OnEmit call.
			* If logRecord is needed after OnEmit returns (i.e. for asynchronous processing) only reads are permitted.
			*/
			logRecordInstance._makeReadonly();
		}
		enabled(options) {
			if (this._sharedState.hasShutdown) return false;
			const loggerConfig = this._loggerConfig;
			if (loggerConfig.disabled) return false;
			const severityNumber = options?.severityNumber;
			if (typeof severityNumber === "number" && severityNumber !== SeverityNumber.UNSPECIFIED && severityNumber < loggerConfig.minimumSeverity) return false;
			const currentContext = options?.context || context.active();
			if (loggerConfig.traceBased) {
				const spanContext = trace.getSpanContext(currentContext);
				if (spanContext && isSpanContextValid(spanContext)) {
					if (!((spanContext.traceFlags & TraceFlags.SAMPLED) === TraceFlags.SAMPLED)) return false;
				}
			}
			const enabledOpts = {
				context: currentContext,
				instrumentationScope: this._instrumentationScope,
				severityNumber: options?.severityNumber,
				eventName: options?.eventName
			};
			for (const processor of this._sharedState.processors) if (!processor.enabled || processor.enabled(enabledOpts)) return true;
			return false;
		}
	};
	//#endregion
	//#region node_modules/@opentelemetry/sdk-logs/build/esm/export/NoopLogRecordProcessor.js
	var NoopLogRecordProcessor = class {
		forceFlush() {
			return Promise.resolve();
		}
		onEmit(_logRecord, _context) {}
		shutdown() {
			return Promise.resolve();
		}
		enabled(_options) {
			return false;
		}
	};
	//#endregion
	//#region node_modules/@opentelemetry/sdk-logs/build/esm/MultiLogRecordProcessor.js
	/**
	* Implementation of the {@link LogRecordProcessor} that simply forwards all
	* received events to a list of {@link LogRecordProcessor}s.
	*/
	var MultiLogRecordProcessor = class {
		processors;
		constructor(processors) {
			this.processors = processors;
		}
		async forceFlush(options) {
			const timeout = options?.timeoutMillis ?? 3e4;
			await Promise.all(this.processors.map((processor) => callWithTimeout(processor.forceFlush(), timeout)));
		}
		onEmit(logRecord, context) {
			this.processors.forEach((processors) => processors.onEmit(logRecord, context));
		}
		async shutdown() {
			await Promise.all(this.processors.map((processor) => processor.shutdown()));
		}
		enabled(options) {
			for (const processor of this.processors) if (!processor.enabled || processor.enabled(options)) return true;
			return false;
		}
	};
	//#endregion
	//#region node_modules/@opentelemetry/sdk-logs/build/esm/internal/utils.js
	/**
	* Normalizes an AnyValue to a JSON-serializable [typeTag, payload] tuple.
	*
	* Using a type tag as the first element guarantees that two values can only
	* produce the same tuple when they have the same type AND the same data,
	* avoiding cross-type collisions such as:
	*   - null vs NaN vs Infinity (all become JSON `null` via JSON.stringify)
	*   - -0 vs 0 (both become JSON `0` via JSON.stringify)
	*   - string "null" vs the value null
	*
	* Object keys are sorted so that attribute maps with the same entries but
	* different insertion orders produce the same key.
	*/
	function normalizeAnyValue(value) {
		if (value === void 0) return ["u", null];
		if (value === null) return ["n", null];
		const valueType = typeof value;
		if (valueType === "string") return ["s", value];
		if (valueType === "boolean") return ["b", value];
		if (valueType === "number") {
			if (Number.isNaN(value)) return ["nan", null];
			if (value === Infinity) return ["inf", null];
			if (value === -Infinity) return ["-inf", null];
			if (Object.is(value, -0)) return ["n0", null];
			return ["d", value];
		}
		if (value instanceof Uint8Array) return ["bytes", Array.from(value)];
		if (Array.isArray(value)) return ["arr", value.map(normalizeAnyValue)];
		return ["map", Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, normalizeAnyValue(v)])];
	}
	/**
	* Converting the instrumentation scope object to a unique identifier string.
	* @param scope - The instrumentation scope to convert
	* @returns A unique string identifier for the scope
	*/
	function getInstrumentationScopeKey(scope) {
		return JSON.stringify([
			scope.name,
			scope.version || "",
			scope.schemaUrl || "",
			normalizeAnyValue(scope.attributes),
			scope.droppedAttributesCount ?? 0
		]);
	}
	//#endregion
	//#region node_modules/@opentelemetry/sdk-logs/build/esm/semconv.js
	/**
	* The number of logs submitted to enabled SDK Loggers.
	*
	* @experimental This metric is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
	*/
	const METRIC_OTEL_SDK_LOG_CREATED = "otel.sdk.log.created";
	/**
	* The number of log records for which the processing has finished, either successful or failed.
	*
	* @note For successful processing, `error.type` **MUST NOT** be set. For failed processing, `error.type` **MUST** contain the failure cause.
	* For the SDK Simple and Batching Log Record Processor a log record is considered to be processed already when it has been submitted to the exporter,
	* not when the corresponding export call has finished.
	*
	* @experimental This metric is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
	*/
	const METRIC_OTEL_SDK_PROCESSOR_LOG_PROCESSED = "otel.sdk.processor.log.processed";
	/**
	* The maximum number of log records the queue of a given instance of an SDK Log Record processor can hold.
	*
	* @note Only applies to Log Record processors which use a queue, e.g. the SDK Batching Log Record Processor.
	*
	* @experimental This metric is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
	*/
	const METRIC_OTEL_SDK_PROCESSOR_LOG_QUEUE_CAPACITY = "otel.sdk.processor.log.queue.capacity";
	/**
	* The number of log records in the queue of a given instance of an SDK log processor.
	*
	* @note Only applies to log record processors which use a queue, e.g. the SDK Batching Log Record Processor.
	*
	* @experimental This metric is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
	*/
	const METRIC_OTEL_SDK_PROCESSOR_LOG_QUEUE_SIZE = "otel.sdk.processor.log.queue.size";
	/**
	* A name uniquely identifying the instance of the OpenTelemetry component within its containing SDK instance.
	*
	* @example otlp_grpc_span_exporter/0
	* @example custom-name
	*
	* @note Implementations **SHOULD** ensure a low cardinality for this attribute, even across application or SDK restarts.
	* E.g. implementations **MUST NOT** use UUIDs as values for this attribute.
	*
	* Implementations **MAY** achieve these goals by following a `<otel.component.type>/<instance-counter>` pattern, e.g. `batching_span_processor/0`.
	* Hereby `otel.component.type` refers to the corresponding attribute value of the component.
	*
	* The value of `instance-counter` **MAY** be automatically assigned by the component and uniqueness within the enclosing SDK instance **MUST** be guaranteed.
	* For example, `<instance-counter>` **MAY** be implemented by using a monotonically increasing counter (starting with `0`), which is incremented every time an
	* instance of the given component type is started.
	*
	* With this implementation, for example the first Batching Span Processor would have `batching_span_processor/0`
	* as `otel.component.name`, the second one `batching_span_processor/1` and so on.
	* These values will therefore be reused in the case of an application restart.
	*
	* @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
	*/
	const ATTR_OTEL_COMPONENT_NAME = "otel.component.name";
	/**
	* A name identifying the type of the OpenTelemetry component.
	*
	* @example batching_span_processor
	* @example com.example.MySpanExporter
	*
	* @note If none of the standardized values apply, implementations **SHOULD** use the language-defined name of the type.
	* E.g. for Java the fully qualified classname **SHOULD** be used in this case.
	*
	* @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
	*/
	const ATTR_OTEL_COMPONENT_TYPE = "otel.component.type";
	/**
	* Enum value "simple_log_processor" for attribute {@link ATTR_OTEL_COMPONENT_TYPE}.
	*
	* The builtin SDK simple log record processor
	*
	* @experimental This enum value is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
	*/
	const OTEL_COMPONENT_TYPE_VALUE_SIMPLE_LOG_PROCESSOR = "simple_log_processor";
	/**
	* Describes a class of error the operation ended with.
	*
	* @example timeout
	* @example java.net.UnknownHostException
	* @example server_certificate_invalid
	* @example 500
	*
	* @note The `error.type` **SHOULD** be predictable, and **SHOULD** have low cardinality.
	*
	* When `error.type` is set to a type (e.g., an exception type), its
	* canonical class name identifying the type within the artifact **SHOULD** be used.
	*
	* Instrumentations **SHOULD** document the list of errors they report.
	*
	* The cardinality of `error.type` within one instrumentation library **SHOULD** be low.
	* Telemetry consumers that aggregate data from multiple instrumentation libraries and applications
	* should be prepared for `error.type` to have high cardinality at query time when no
	* additional filters are applied.
	*
	* If the operation has completed successfully, instrumentations **SHOULD NOT** set `error.type`.
	*
	* If a specific domain defines its own set of error identifiers (such as HTTP or RPC status codes),
	* it's **RECOMMENDED** to:
	*
	*   - Use a domain-specific attribute
	*   - Set `error.type` to capture all errors, regardless of whether they are defined within the domain-specific set or not.
	*/
	const ATTR_ERROR_TYPE = "error.type";
	//#endregion
	//#region node_modules/@opentelemetry/sdk-logs/build/esm/LoggerMetrics.js
	/**
	* Generates `otel.sdk.log.*` metrics.
	* https://opentelemetry.io/docs/specs/semconv/otel/sdk-metrics/#log-metrics
	*/
	var LoggerMetrics = class {
		createdLogs;
		constructor(meter) {
			this.createdLogs = meter.createCounter(METRIC_OTEL_SDK_LOG_CREATED, {
				unit: "{log_record}",
				description: "The number of logs submitted to enabled SDK Loggers."
			});
		}
		emitLog() {
			this.createdLogs.add(1);
		}
	};
	//#endregion
	//#region node_modules/@opentelemetry/sdk-logs/build/esm/version.js
	const VERSION$1 = "0.221.0";
	//#endregion
	//#region node_modules/@opentelemetry/sdk-logs/build/esm/internal/LoggerProviderSharedState.js
	const DEFAULT_LOGGER_CONFIG = {
		disabled: false,
		minimumSeverity: SeverityNumber.UNSPECIFIED,
		traceBased: false
	};
	/**
	* Default LoggerConfigurator that returns the default config for all loggers
	*/
	const DEFAULT_LOGGER_CONFIGURATOR = () => ({ ...DEFAULT_LOGGER_CONFIG });
	var LoggerProviderSharedState = class {
		loggers = /* @__PURE__ */ new Map();
		activeProcessor;
		registeredLogRecordProcessors = [];
		resource;
		logRecordLimits;
		processors;
		loggerMetrics;
		hasShutdown = false;
		_loggerConfigurator;
		_loggerConfigs = /* @__PURE__ */ new Map();
		constructor(resource, logRecordLimits, processors, loggerConfigurator, meterProvider) {
			this.resource = resource;
			this.logRecordLimits = logRecordLimits;
			this.processors = processors;
			if (processors.length > 0) {
				this.registeredLogRecordProcessors = processors;
				this.activeProcessor = new MultiLogRecordProcessor(this.registeredLogRecordProcessors);
			} else this.activeProcessor = new NoopLogRecordProcessor();
			this._loggerConfigurator = loggerConfigurator ?? DEFAULT_LOGGER_CONFIGURATOR;
			this.loggerMetrics = new LoggerMetrics(meterProvider ? meterProvider.getMeter("@opentelemetry/sdk-logs", VERSION$1) : createNoopMeter());
		}
		/**
		* Get the LoggerConfig for a given instrumentation scope.
		* Uses the LoggerConfigurator function to compute the config on first access
		* and caches the result.
		*
		* @experimental This feature is in development as per the OpenTelemetry specification.
		*/
		getLoggerConfig(instrumentationScope) {
			const key = getInstrumentationScopeKey(instrumentationScope);
			let config = this._loggerConfigs.get(key);
			if (config) return config;
			config = this._loggerConfigurator(instrumentationScope);
			this._loggerConfigs.set(key, config);
			return config;
		}
	};
	var LoggerProvider = class {
		_shutdownOnce;
		_sharedState;
		constructor(config = {}) {
			const mergedConfig = {
				resource: config.resource ?? defaultResource(),
				logRecordLimits: {
					attributeCountLimit: config.logRecordLimits?.attributeCountLimit ?? 128,
					attributeValueLengthLimit: config.logRecordLimits?.attributeValueLengthLimit ?? Infinity
				},
				loggerConfigurator: config.loggerConfigurator ?? DEFAULT_LOGGER_CONFIGURATOR,
				processors: config.processors ?? [],
				meterProvider: config.meterProvider
			};
			this._sharedState = new LoggerProviderSharedState(mergedConfig.resource, mergedConfig.logRecordLimits, mergedConfig.processors, mergedConfig.loggerConfigurator, mergedConfig.meterProvider);
			this._shutdownOnce = new BindOnceFuture(this._shutdown, this);
		}
		/**
		* Get a logger with the configuration of the LoggerProvider.
		*/
		getLogger(name, version, options) {
			if (this._shutdownOnce.isCalled) {
				diag.warn("A shutdown LoggerProvider cannot provide a Logger");
				return createNoopLogger();
			}
			if (!name) diag.warn("Logger requested without instrumentation scope name.");
			const instrumentationScope = {
				name: name || "unknown",
				version,
				schemaUrl: options?.schemaUrl,
				...normalizeScopeAttributes(this._sharedState.logRecordLimits, options?.attributes)
			};
			const key = getInstrumentationScopeKey(instrumentationScope);
			if (!this._sharedState.loggers.has(key)) this._sharedState.loggers.set(key, new Logger(instrumentationScope, this._sharedState));
			return this._sharedState.loggers.get(key);
		}
		/**
		* Notifies all registered LogRecordProcessor to flush any buffered data.
		*
		* Returns a promise which is resolved when all flushes are complete.
		*/
		forceFlush(options) {
			if (this._shutdownOnce.isCalled) {
				diag.warn("invalid attempt to force flush after LoggerProvider shutdown");
				return this._shutdownOnce.promise;
			}
			return this._sharedState.activeProcessor.forceFlush(options);
		}
		/**
		* Flush all buffered data and shut down the LoggerProvider and all registered
		* LogRecordProcessor.
		*
		* Returns a promise which is resolved when all flushes are complete.
		*/
		shutdown() {
			if (this._shutdownOnce.isCalled) {
				diag.warn("shutdown may only be called once per LoggerProvider");
				return this._shutdownOnce.promise;
			}
			return this._shutdownOnce.call();
		}
		_shutdown() {
			this._sharedState.hasShutdown = true;
			return this._sharedState.activeProcessor.shutdown();
		}
	};
	//#endregion
	//#region node_modules/@opentelemetry/sdk-logs/build/esm/export/LogRecordProcessorMetrics.js
	const componentCounter = /* @__PURE__ */ new Map();
	var LogRecordProcessorMetrics = class {
		processedLogs;
		queueSize;
		queueSizeCallback;
		standardAttrs;
		droppedAttrs;
		constructor(componentType, meter, queueConfig) {
			const counter = componentCounter.get(componentType) ?? 0;
			componentCounter.set(componentType, counter + 1);
			this.standardAttrs = {
				[ATTR_OTEL_COMPONENT_TYPE]: componentType,
				[ATTR_OTEL_COMPONENT_NAME]: `${componentType}/${counter}`
			};
			this.droppedAttrs = {
				...this.standardAttrs,
				[ATTR_ERROR_TYPE]: "queue_full"
			};
			this.processedLogs = meter.createCounter(METRIC_OTEL_SDK_PROCESSOR_LOG_PROCESSED, {
				unit: "{log_record}",
				description: "The number of log records for which the processing has finished, either successful or failed."
			});
			if (queueConfig) {
				const { capacity, getQueueSize } = queueConfig;
				meter.createUpDownCounter(METRIC_OTEL_SDK_PROCESSOR_LOG_QUEUE_CAPACITY, {
					unit: "{log_record}",
					description: "The maximum number of log records the queue of a given instance of an SDK log processor can hold."
				}).add(capacity, this.standardAttrs);
				this.queueSize = meter.createObservableUpDownCounter(METRIC_OTEL_SDK_PROCESSOR_LOG_QUEUE_SIZE, {
					unit: "{log_record}",
					description: "The number of log records in the queue of a given instance of an SDK log processor."
				});
				this.queueSizeCallback = (result) => result.observe(getQueueSize(), this.standardAttrs);
				this.queueSize.addCallback(this.queueSizeCallback);
			}
		}
		dropLogs(count) {
			this.processedLogs.add(count, this.droppedAttrs);
		}
		finishLogs(count, error) {
			if (!error) {
				this.processedLogs.add(count, this.standardAttrs);
				return;
			}
			const attrs = {
				...this.standardAttrs,
				[ATTR_ERROR_TYPE]: error.name
			};
			this.processedLogs.add(count, attrs);
		}
		shutdown() {
			if (this.queueSize && this.queueSizeCallback) this.queueSize.removeCallback(this.queueSizeCallback);
		}
	};
	//#endregion
	//#region node_modules/@opentelemetry/sdk-logs/build/esm/export/SimpleLogRecordProcessor.js
	/**
	* An implementation of the {@link LogRecordProcessor} interface that exports
	* each {@link LogRecord} as it is emitted.
	*
	* NOTE: This {@link LogRecordProcessor} exports every {@link LogRecord}
	* individually instead of batching them together, which can cause significant
	* performance overhead with most exporters. For production use, please consider
	* using the {@link BatchLogRecordProcessor} instead.
	*/
	var SimpleLogRecordProcessor = class {
		_exporter;
		_metrics;
		_shutdownOnce;
		_unresolvedExports;
		constructor(options) {
			this._exporter = options.exporter;
			this._shutdownOnce = new BindOnceFuture(this._shutdown, this);
			this._unresolvedExports = /* @__PURE__ */ new Set();
			this._metrics = new LogRecordProcessorMetrics(OTEL_COMPONENT_TYPE_VALUE_SIMPLE_LOG_PROCESSOR, options?.selfObsMeterProvider ? options.selfObsMeterProvider.getMeter("@opentelemetry/sdk-logs") : createNoopMeter());
		}
		onEmit(logRecord, _context) {
			if (this._shutdownOnce.isCalled) return;
			const doExport = () => internal._export(this._exporter, [logRecord]).then((result) => {
				this._metrics.finishLogs(1, result.error);
				if (result.code !== ExportResultCode.SUCCESS) globalErrorHandler(result.error ?? /* @__PURE__ */ new Error(`SimpleLogRecordProcessor: log record export failed (status ${result})`));
			}).catch(globalErrorHandler);
			if (logRecord.resource.asyncAttributesPending) {
				const exportPromise = logRecord.resource.waitForAsyncAttributes?.().then(() => {
					this._unresolvedExports.delete(exportPromise);
					return doExport();
				}, globalErrorHandler);
				if (exportPromise != null) this._unresolvedExports.add(exportPromise);
			} else doExport();
		}
		async forceFlush() {
			await Promise.all(Array.from(this._unresolvedExports));
		}
		shutdown() {
			return this._shutdownOnce.call();
		}
		_shutdown() {
			this._metrics.shutdown();
			return this._exporter.shutdown();
		}
	};
	//#endregion
	//#region node_modules/@opentelemetry/instrumentation/build/esm/shimmer.js
	let logger = console.error.bind(console);
	function defineProperty(obj, name, value) {
		const enumerable = !!obj[name] && Object.prototype.propertyIsEnumerable.call(obj, name);
		Object.defineProperty(obj, name, {
			configurable: true,
			enumerable,
			writable: true,
			value
		});
	}
	const wrap = (nodule, name, wrapper) => {
		if (!nodule || !nodule[name]) {
			logger("no original function " + String(name) + " to wrap");
			return;
		}
		if (!wrapper) {
			logger("no wrapper function");
			logger((/* @__PURE__ */ new Error()).stack);
			return;
		}
		const original = nodule[name];
		if (typeof original !== "function" || typeof wrapper !== "function") {
			logger("original object and wrapper must be functions");
			return;
		}
		const wrapped = wrapper(original, name);
		defineProperty(wrapped, "__original", original);
		defineProperty(wrapped, "__unwrap", () => {
			if (nodule[name] === wrapped) defineProperty(nodule, name, original);
		});
		defineProperty(wrapped, "__wrapped", true);
		defineProperty(nodule, name, wrapped);
		return wrapped;
	};
	const massWrap = (nodules, names, wrapper) => {
		if (!nodules) {
			logger("must provide one or more modules to patch");
			logger((/* @__PURE__ */ new Error()).stack);
			return;
		} else if (!Array.isArray(nodules)) nodules = [nodules];
		if (!(names && Array.isArray(names))) {
			logger("must provide one or more functions to wrap on modules");
			return;
		}
		nodules.forEach((nodule) => {
			names.forEach((name) => {
				wrap(nodule, name, wrapper);
			});
		});
	};
	const unwrap = (nodule, name) => {
		if (!nodule || !nodule[name]) {
			logger("no function to unwrap.");
			logger((/* @__PURE__ */ new Error()).stack);
			return;
		}
		const wrapped = nodule[name];
		if (!wrapped.__unwrap) logger("no original to unwrap to -- has " + String(name) + " already been unwrapped?");
		else {
			wrapped.__unwrap();
			return;
		}
	};
	const massUnwrap = (nodules, names) => {
		if (!nodules) {
			logger("must provide one or more modules to patch");
			logger((/* @__PURE__ */ new Error()).stack);
			return;
		} else if (!Array.isArray(nodules)) nodules = [nodules];
		if (!(names && Array.isArray(names))) {
			logger("must provide one or more functions to unwrap on modules");
			return;
		}
		nodules.forEach((nodule) => {
			names.forEach((name) => {
				unwrap(nodule, name);
			});
		});
	};
	function shimmer(options) {
		if (options && options.logger) if (typeof options.logger !== "function") logger("new logger isn't a function, not replacing");
		else logger = options.logger;
	}
	shimmer.wrap = wrap;
	shimmer.massWrap = massWrap;
	shimmer.unwrap = unwrap;
	shimmer.massUnwrap = massUnwrap;
	//#endregion
	//#region node_modules/@opentelemetry/instrumentation/build/esm/instrumentation.js
	/**
	* Base abstract internal class for instrumenting node and web plugins
	*/
	var InstrumentationAbstract = class {
		_config = {};
		_tracer;
		_meter;
		_logger;
		_diag;
		instrumentationName;
		instrumentationVersion;
		constructor(instrumentationName, instrumentationVersion, config) {
			this.instrumentationName = instrumentationName;
			this.instrumentationVersion = instrumentationVersion;
			this.setConfig(config);
			this._diag = diag.createComponentLogger({ namespace: instrumentationName });
			this._tracer = trace.getTracer(instrumentationName, instrumentationVersion);
			this._meter = metrics.getMeter(instrumentationName, instrumentationVersion);
			this._logger = logs.getLogger(instrumentationName, instrumentationVersion);
			this._updateMetricInstruments();
		}
		_wrap = wrap;
		_unwrap = unwrap;
		_massWrap = massWrap;
		_massUnwrap = massUnwrap;
		get meter() {
			return this._meter;
		}
		/**
		* Sets MeterProvider to this plugin
		* @param meterProvider
		*/
		setMeterProvider(meterProvider) {
			this._meter = meterProvider.getMeter(this.instrumentationName, this.instrumentationVersion);
			this._updateMetricInstruments();
		}
		get logger() {
			return this._logger;
		}
		/**
		* Sets LoggerProvider to this plugin
		* @param loggerProvider
		*/
		setLoggerProvider(loggerProvider) {
			this._logger = loggerProvider.getLogger(this.instrumentationName, this.instrumentationVersion);
		}
		/**
		* @experimental
		*
		* Get module definitions defined by {@link init}.
		* This can be used for experimental compile-time instrumentation.
		*
		* @returns an array of {@link InstrumentationModuleDefinition}
		*/
		getModuleDefinitions() {
			const initResult = this.init() ?? [];
			if (!Array.isArray(initResult)) return [initResult];
			return initResult;
		}
		/**
		* Sets the new metric instruments with the current Meter.
		*/
		_updateMetricInstruments() {}
		getConfig() {
			return this._config;
		}
		/**
		* Sets InstrumentationConfig to this plugin
		* @param config
		*/
		setConfig(config) {
			this._config = {
				enabled: true,
				...config
			};
		}
		/**
		* Sets TracerProvider to this plugin
		* @param tracerProvider
		*/
		setTracerProvider(tracerProvider) {
			this._tracer = tracerProvider.getTracer(this.instrumentationName, this.instrumentationVersion);
		}
		get tracer() {
			return this._tracer;
		}
		/**
		* Execute span customization hook, if configured, and log any errors.
		* Any semantics of the trigger and info are defined by the specific instrumentation.
		* @param hookHandler The optional hook handler which the user has configured via instrumentation config
		* @param triggerName The name of the trigger for executing the hook for logging purposes
		* @param span The span to which the hook should be applied
		* @param info The info object to be passed to the hook, with useful data the hook may use
		*/
		_runSpanCustomizationHook(hookHandler, triggerName, span, info) {
			if (!hookHandler) return;
			try {
				hookHandler(span, info);
			} catch (e) {
				this._diag.error("Error running span customization hook due to exception in handler", { triggerName }, e);
			}
		}
	};
	//#endregion
	//#region node_modules/@opentelemetry/instrumentation/build/esm/platform/browser/instrumentation.js
	/**
	* Base abstract class for instrumenting web plugins
	*/
	var InstrumentationBase = class extends InstrumentationAbstract {
		constructor(instrumentationName, instrumentationVersion, config) {
			super(instrumentationName, instrumentationVersion, config);
			if (this._config.enabled) this.enable();
		}
	};
	//#endregion
	//#region src/core/constants.ts
	/**
	* Do11y — Documentation Observability
	*
	* OTel semantic convention attribute keys and event names.
	*
	* Standard attrs from https://opentelemetry.io/docs/specs/semconv/.
	* Custom do11y attrs use the `browser.do11y.*` namespace.
	*/
	const VERSION = "0.2.0";
	const ATTR_URL_PATH = "url.path";
	const ATTR_URL_FRAGMENT = "url.fragment";
	const ATTR_URL_QUERY = "url.query";
	const ATTR_DEVICE_TYPE = "device.type";
	const ATTR_BROWSER_FAMILY = "browser.family";
	const ATTR_BROWSER_LANGUAGE = "browser.language";
	const ATTR_DO11Y_PAGE_TITLE = "browser.do11y.page_title";
	const ATTR_DO11Y_VIEWPORT_CATEGORY = "browser.do11y.viewport_category";
	const ATTR_DO11Y_TIMEZONE_OFFSET = "browser.do11y.timezone_offset";
	const ATTR_DO11Y_REFERRER_CATEGORY = "browser.do11y.referrer_category";
	const ATTR_DO11Y_AI_PLATFORM = "browser.do11y.ai_platform";
	const ATTR_DO11Y_IS_FIRST_PAGE = "browser.do11y.is_first_page";
	const ATTR_DO11Y_PREVIOUS_PATH = "browser.do11y.previous_path";
	const ATTR_DO11Y_REFERRER_DOMAIN = "browser.do11y.referrer_domain";
	const ATTR_DO11Y_LINK_TYPE = "browser.do11y.link.type";
	const ATTR_DO11Y_LINK_TARGET_URL = "browser.do11y.link.target_url";
	const ATTR_DO11Y_LINK_TARGET_DOMAIN = "browser.do11y.link.target_domain";
	const ATTR_DO11Y_LINK_TEXT = "browser.do11y.link.text";
	const ATTR_DO11Y_LINK_CONTEXT = "browser.do11y.link.context";
	const ATTR_DO11Y_LINK_SECTION = "browser.do11y.link.section";
	const ATTR_DO11Y_LINK_INDEX = "browser.do11y.link.index";
	const ATTR_DO11Y_SCROLL_THRESHOLD = "browser.do11y.scroll.threshold";
	const ATTR_DO11Y_SCROLL_PERCENT = "browser.do11y.scroll.percent";
	const ATTR_DO11Y_TOTAL_TIME_SECONDS = "browser.do11y.page_exit.total_time_seconds";
	const ATTR_DO11Y_ACTIVE_TIME_SECONDS = "browser.do11y.page_exit.active_time_seconds";
	const ATTR_DO11Y_ENGAGEMENT_RATIO = "browser.do11y.page_exit.engagement_ratio";
	const ATTR_DO11Y_MAX_SCROLL_DEPTH = "browser.do11y.page_exit.max_scroll_depth";
	const ATTR_DO11Y_SEARCH_TRIGGER = "browser.do11y.search.trigger";
	const ATTR_DO11Y_CODE_LANGUAGE = "browser.do11y.code.language";
	const ATTR_DO11Y_CODE_SECTION = "browser.do11y.code.section";
	const ATTR_DO11Y_CODE_INDEX = "browser.do11y.code.index";
	const ATTR_DO11Y_SECTION_HEADING = "browser.do11y.section.heading";
	const ATTR_DO11Y_SECTION_HEADING_LEVEL = "browser.do11y.section.heading_level";
	const ATTR_DO11Y_SECTION_VISIBLE_SECONDS = "browser.do11y.section.visible_seconds";
	const ATTR_DO11Y_TAB_LABEL = "browser.do11y.tab.label";
	const ATTR_DO11Y_TAB_GROUP = "browser.do11y.tab.group";
	const ATTR_DO11Y_TAB_IS_DEFAULT = "browser.do11y.tab.is_default";
	const ATTR_DO11Y_TOC_HEADING = "browser.do11y.toc.heading";
	const ATTR_DO11Y_TOC_HEADING_LEVEL = "browser.do11y.toc.heading_level";
	const ATTR_DO11Y_TOC_POSITION = "browser.do11y.toc.position";
	const ATTR_DO11Y_FEEDBACK_RATING = "browser.do11y.feedback.rating";
	const ATTR_DO11Y_EXPAND_SUMMARY = "browser.do11y.expand.summary";
	const ATTR_DO11Y_EXPAND_ACTION = "browser.do11y.expand.action";
	const ATTR_DO11Y_EXPAND_SECTION = "browser.do11y.expand.section";
	const EVENT_PAGE_VIEW = "browser.do11y.page_view";
	const EVENT_PAGE_EXIT = "browser.do11y.page_exit";
	const EVENT_SCROLL_DEPTH = "browser.do11y.scroll_depth";
	const EVENT_LINK_CLICK = "browser.do11y.link_click";
	const EVENT_SEARCH_OPENED = "browser.do11y.search_opened";
	const EVENT_CODE_COPIED = "browser.do11y.code_copied";
	const EVENT_SECTION_VISIBLE = "browser.do11y.section_visible";
	const EVENT_TAB_SWITCH = "browser.do11y.tab_switch";
	const EVENT_TOC_CLICK = "browser.do11y.toc_click";
	const EVENT_FEEDBACK = "browser.do11y.feedback";
	const EVENT_EXPAND_COLLAPSE = "browser.do11y.expand_collapse";
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
	//#endregion
	//#region src/core/presets.ts
	const FRAMEWORK_PRESETS = {
		mintlify: {
			searchSelector: "#search-bar-entry, #search-bar-entry-mobile, [class*=\"search\"]",
			copyButtonSelector: "button[class*=\"copy\"], button[aria-label*=\"copy\" i]",
			codeBlockSelector: "pre, [class*=\"code\"]",
			navigationSelector: "nav, [role=\"navigation\"], #navbar, #sidebar, [class*=\"nav\"], [class*=\"sidebar\"]",
			footerSelector: "footer, [role=\"contentinfo\"], [class*=\"footer\"]",
			contentSelector: "main, article, [role=\"main\"], [class*=\"content\"]",
			tabContainerSelector: "tabs, [role=\"tablist\"], [class*=\"tab\"]",
			tocSelector: "#table-of-contents, [data-testid=\"table-of-contents\"], [class*=\"table-of-contents\"], [class*=\"toc\"]",
			feedbackSelector: "feedback-toolbar, #feedback-thumbs-up, #feedback-thumbs-down, [class*=\"feedback\"], [class*=\"helpful\"]"
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
			copyButtonSelector: "button.copy, .vp-code-copy, button.copy[title*=\"Copy\"]",
			codeBlockSelector: "div[class*=\"language-\"], pre, [class*=\"code\"]",
			navigationSelector: "nav, [role=\"navigation\"], .VPNav, .VPSidebar, [class*=\"nav\"], [class*=\"sidebar\"]",
			footerSelector: "footer, [role=\"contentinfo\"], .VPFooter, [class*=\"footer\"]",
			contentSelector: "main, article, [role=\"main\"], .VPContent, [class*=\"content\"]",
			tabContainerSelector: ".vp-code-group .tabs, [role=\"tablist\"]",
			tocSelector: ".VPDocAsideOutline, .VPLocalNavOutlineDropdown, a.outline-link",
			feedbackSelector: "[class*=\"feedback\"], [class*=\"helpful\"]"
		},
		starlight: {
			searchSelector: "site-search button[data-open-modal], sl-doc-search .DocSearch-Button, button[aria-label*=\"search\" i]",
			copyButtonSelector: ".expressive-code .copy button, .copy button[data-code]",
			codeBlockSelector: ".expressive-code pre, pre",
			navigationSelector: "nav, [role=\"navigation\"], [class*=\"sidebar\"]",
			footerSelector: "footer, [role=\"contentinfo\"], [class*=\"footer\"]",
			contentSelector: "main, .sl-markdown-content, [role=\"main\"]",
			tabContainerSelector: "starlight-tabs [role=\"tablist\"], [role=\"tablist\"]",
			tocSelector: ".right-sidebar-panel, starlight-toc, mobile-starlight-toc",
			feedbackSelector: "[class*=\"feedback\"], [class*=\"helpful\"]"
		},
		docsy: {
			searchSelector: ".td-search input, .td-search__input, #docsearch-0, #docsearch-1",
			copyButtonSelector: "button[aria-label*=\"copy\" i], button[title*=\"copy\" i], .td-click-to-copy",
			codeBlockSelector: ".highlight, pre.chroma, pre",
			navigationSelector: "nav, [role=\"navigation\"], .td-sidebar, .td-navbar, [class*=\"sidebar\"]",
			footerSelector: "footer, [role=\"contentinfo\"], .td-footer, [class*=\"footer\"]",
			contentSelector: "main, article, [role=\"main\"], .td-content, [class*=\"content\"]",
			tabContainerSelector: ".nav-tabs[role=\"tablist\"], [role=\"tablist\"], .tab-content",
			tocSelector: ".td-toc, nav[id=\"TableOfContents\"], [class*=\"toc\"]",
			feedbackSelector: ".feedback--answer, [class*=\"feedback\"], [class*=\"helpful\"]"
		}
	};
	/**
	* Apply framework-specific selectors to the config.
	* For 'custom', uses whatever the user set in config; for named
	* frameworks, loads the preset and lets explicit config values override.
	*/
	function applyFrameworkSelectors(config) {
		const preset = FRAMEWORK_PRESETS[config.framework];
		if (preset) SELECTOR_KEYS.forEach((key) => {
			if (!config[key]) config[key] = preset[key];
		});
		else if (config.framework !== "custom") {
			if (config.debug) console.warn(`[Do11y] Unknown framework "${config.framework}". Falling back to generic selectors. Supported: ` + Object.keys(FRAMEWORK_PRESETS).join(", ") + ", custom");
		}
		const fallback = FRAMEWORK_PRESETS.mintlify;
		if (!fallback) return;
		SELECTOR_KEYS.forEach((key) => {
			if (!config[key]) config[key] = fallback[key];
		});
	}
	//#endregion
	//#region src/core/privacy.ts
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
			return null;
		}
	}
	//#endregion
	//#region src/core/dom-utils.ts
	function getElementClassName(el) {
		if (typeof el.className === "string") return el.className;
		const svgClass = el.className;
		if (svgClass && typeof svgClass.baseVal === "string") return svgClass.baseVal;
		return "";
	}
	function languageFromClassName(className) {
		const match = className.match(/(?:^|\s)language-([\w-]+)(?:\s|$)/);
		return match ? match[1] : null;
	}
	/**
	* Read the code block language from the element and its ancestors.
	* Frameworks often put `language-*` on a wrapper div (VitePress, Prism)
	* rather than on the pre/code element itself.
	*/
	function extractCodeLanguage(start) {
		if (!start) return "unknown";
		let el = start;
		for (let depth = 0; el && depth < 12; depth++, el = el.parentElement) {
			for (const attr of [
				"language",
				"data-language",
				"data-lang",
				"data-code-lang"
			]) {
				const value = el.getAttribute(attr);
				if (value) return value;
			}
			const fromClass = languageFromClassName(getElementClassName(el));
			if (fromClass) return fromClass;
			const langText = el.querySelector(":scope > span.lang")?.textContent?.trim();
			if (langText) return langText;
			const deepLang = el.querySelector("[data-language], [data-lang], [data-code-lang], [class*=\"language-\"], [language]");
			if (deepLang) {
				const dl = deepLang.getAttribute("language") ?? deepLang.getAttribute("data-language") ?? deepLang.getAttribute("data-lang") ?? deepLang.getAttribute("data-code-lang") ?? languageFromClassName(getElementClassName(deepLang));
				if (dl) return dl;
			}
		}
		return "unknown";
	}
	function resolveTocHash(href) {
		if (href.startsWith("#")) return href;
		const hashIndex = href.indexOf("#");
		if (hashIndex === -1) return null;
		const pathPart = href.slice(0, hashIndex);
		if (!pathPart || pathPart === window.location.pathname || pathPart === `${window.location.pathname}${window.location.search}`) return href.slice(hashIndex);
		return null;
	}
	function resolveTocContainer(link, config) {
		const selector = validateSelector(config.tocSelector) ?? ".table-of-contents, .VPDocAsideOutline, .VPLocalNavOutlineDropdown, [class*=\"toc\"], [class*=\"TableOfContents\"], [class*=\"page-outline\"], .right-sidebar-panel, starlight-toc";
		let container = link.closest(selector);
		if (!container) return null;
		if (container === link || container.tagName === "A") container = link.closest(".VPDocAsideOutline, .VPLocalNavOutlineDropdown, nav, aside, .right-sidebar-panel, starlight-toc") ?? container.parentElement;
		return container;
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
	//#endregion
	//#region src/core/context.ts
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
	function getBrowserContext() {
		return {
			[ATTR_DO11Y_VIEWPORT_CATEGORY]: categorizeViewport(),
			[ATTR_BROWSER_FAMILY]: getBrowserFamily(),
			[ATTR_DEVICE_TYPE]: getDeviceType(),
			[ATTR_BROWSER_LANGUAGE]: (navigator.language || "").split("-")[0] || "unknown",
			[ATTR_DO11Y_TIMEZONE_OFFSET]: (/* @__PURE__ */ new Date()).getTimezoneOffset() / 60
		};
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
			[ATTR_URL_PATH]: window.location.pathname,
			[ATTR_URL_FRAGMENT]: window.location.hash || null,
			[ATTR_URL_QUERY]: window.location.search ? "has_params" : null,
			[ATTR_DO11Y_PAGE_TITLE]: sanitizeText(document.title, 150)
		};
	}
	//#endregion
	//#region src/core/session.ts
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
			const stored = sessionStorage.getItem("do11y_session");
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
			saveSession$1(session);
		}
		return session;
	}
	function saveSession$1(session) {
		try {
			sessionStorage.setItem("do11y_session", JSON.stringify(session));
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
		saveSession$1(session);
		return session;
	}
	//#endregion
	//#region src/core/tracking/scroll.ts
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
	* Check and track scroll depth thresholds.
	* Reads from the detected scroll container when present, otherwise
	* falls back to the window/document.
	*
	* If the page fits entirely in the viewport (no scrollbar), all
	* thresholds are marked as reached since the user can see 100% of
	* the content without scrolling.
	*/
	function checkScrollDepth(config, emit) {
		let scrollTop;
		let totalHeight;
		let viewportHeight;
		if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
			scrollTop = scrollContainer.scrollTop;
			totalHeight = scrollContainer.scrollHeight;
			viewportHeight = scrollContainer.clientHeight;
		} else if (document.documentElement) {
			scrollTop = window.scrollY || document.documentElement.scrollTop;
			totalHeight = document.documentElement.scrollHeight;
			viewportHeight = window.innerHeight;
		} else return;
		const docHeight = totalHeight - viewportHeight;
		if (docHeight <= 0) {
			config.scrollThresholds.forEach((threshold) => {
				if (!trackedScrollDepths.has(threshold)) {
					trackedScrollDepths.add(threshold);
					emit(EVENT_SCROLL_DEPTH, {
						[ATTR_DO11Y_SCROLL_THRESHOLD]: threshold,
						[ATTR_DO11Y_SCROLL_PERCENT]: 100
					});
				}
			});
			return;
		}
		const scrollPercent = Math.round(scrollTop / docHeight * 100);
		config.scrollThresholds.forEach((threshold) => {
			if (scrollPercent >= threshold && !trackedScrollDepths.has(threshold)) {
				trackedScrollDepths.add(threshold);
				emit(EVENT_SCROLL_DEPTH, {
					[ATTR_DO11Y_SCROLL_THRESHOLD]: threshold,
					[ATTR_DO11Y_SCROLL_PERCENT]: scrollPercent
				});
			}
		});
	}
	function setupScrollTracking(config, emit) {
		const cleanupFns = [];
		if (!config.trackScrollDepth) return () => {};
		if (config.contentSelector) {
			const contentEl = document.querySelector(config.contentSelector);
			if (contentEl) scrollContainer = findScrollableAncestor(contentEl);
		}
		let ticking = false;
		function onScroll() {
			if (!ticking) {
				window.requestAnimationFrame(() => {
					checkScrollDepth(config, emit);
					ticking = false;
				});
				ticking = true;
			}
		}
		window.addEventListener("scroll", onScroll);
		cleanupFns.push(() => window.removeEventListener("scroll", onScroll));
		if (scrollContainer) {
			scrollContainer.addEventListener("scroll", onScroll);
			cleanupFns.push(() => scrollContainer.removeEventListener("scroll", onScroll));
			if (config.debug) {
				const sc = scrollContainer;
				console.log("[do11y] Using container-based scroll tracking:", sc.className || sc.tagName);
			}
		}
		checkScrollDepth(config, emit);
		return () => {
			for (const fn of cleanupFns) fn();
		};
	}
	function resetTrackedScrollDepths() {
		trackedScrollDepths = /* @__PURE__ */ new Set();
	}
	function getTrackedScrollDepths() {
		return trackedScrollDepths;
	}
	//#endregion
	//#region src/core/tracking/sections.ts
	function emitSectionEvent(emit, el, elapsedMs) {
		emit(EVENT_SECTION_VISIBLE, {
			[ATTR_DO11Y_SECTION_HEADING]: sanitizeText(el.textContent?.trim() ?? "", 100),
			[ATTR_DO11Y_SECTION_HEADING_LEVEL]: parseInt(el.tagName.charAt(1), 10),
			[ATTR_DO11Y_SECTION_VISIBLE_SECONDS]: Math.round(elapsedMs / 1e3)
		});
	}
	let sectionObserver = null;
	let sectionTimers = {};
	function setupSectionVisibilityTracking(config, emit) {
		if (!config.trackSectionVisibility) return () => {};
		if (typeof IntersectionObserver === "undefined") return () => {};
		const threshold = config.sectionVisibleThreshold * 1e3;
		sectionObserver = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				const id = entry.target.getAttribute("data-do11y-section-id");
				if (!id) return;
				if (entry.isIntersecting) {
					if (!sectionTimers[id]) {
						const timer = {
							start: Date.now(),
							reported: false,
							timeoutId: null
						};
						timer.timeoutId = setTimeout(() => {
							if (sectionTimers[id] && !sectionTimers[id].reported) {
								emitSectionEvent(emit, entry.target, threshold);
								sectionTimers[id].reported = true;
							}
						}, threshold);
						sectionTimers[id] = timer;
					}
				} else {
					if (sectionTimers[id]) {
						if (sectionTimers[id].timeoutId) clearTimeout(sectionTimers[id].timeoutId);
						if (!sectionTimers[id].reported) {
							const elapsed = Date.now() - sectionTimers[id].start;
							if (elapsed >= threshold) {
								emitSectionEvent(emit, entry.target, elapsed);
								sectionTimers[id].reported = true;
							}
						}
					}
					delete sectionTimers[id];
				}
			});
		}, { threshold: .5 });
		observeHeadings();
		return () => disconnectSectionObserver();
	}
	function observeHeadings() {
		if (!sectionObserver) return;
		document.querySelectorAll("h2, h3").forEach((h, i) => {
			h.setAttribute("data-do11y-section-id", "section-" + i);
			sectionObserver.observe(h);
		});
	}
	function flushVisibleSections(config, emit) {
		if (!sectionObserver) return;
		const now = Date.now();
		const threshold = config.sectionVisibleThreshold * 1e3;
		Object.keys(sectionTimers).forEach((id) => {
			const timer = sectionTimers[id];
			if (timer && !timer.reported) {
				if (timer.timeoutId) clearTimeout(timer.timeoutId);
				const elapsed = now - timer.start;
				if (elapsed >= threshold) {
					const escapedId = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(id) : id.replace(/["\\]/g, "\\$&");
					const el = document.querySelector("[data-do11y-section-id=\"" + escapedId + "\"]");
					if (el) emitSectionEvent(emit, el, elapsed);
				}
			}
		});
		sectionTimers = {};
	}
	function disconnectSectionObserver() {
		if (sectionObserver) {
			flushVisibleSections({
				trackSectionVisibility: false,
				sectionVisibleThreshold: 0
			}, () => {});
			sectionObserver.disconnect();
			sectionObserver = null;
		}
	}
	//#endregion
	//#region src/core/tracking/engagement.ts
	let pageLoadTime = Date.now();
	let lastActivityTime = Date.now();
	let totalActiveTime = 0;
	let isPageVisible = true;
	let pageExited = false;
	/**
	* @param afterEmit Optional callback invoked after the exit event is emitted.
	*   Used by the standalone build to flush the transport before the page unloads.
	*/
	function emitPageExit(config, emit, afterEmit) {
		if (pageExited) return;
		pageExited = true;
		if (isPageVisible) totalActiveTime += Date.now() - lastActivityTime;
		const totalTime = Date.now() - pageLoadTime;
		const engagementRatio = totalTime > 0 ? totalActiveTime / totalTime : 0;
		let maxScroll = 0;
		getTrackedScrollDepths().forEach((depth) => {
			if (depth > maxScroll) maxScroll = depth;
		});
		flushVisibleSections(config, emit);
		const session = getSession();
		emit(EVENT_PAGE_EXIT, {
			[ATTR_DO11Y_TOTAL_TIME_SECONDS]: Math.round(totalTime / 1e3),
			[ATTR_DO11Y_ACTIVE_TIME_SECONDS]: Math.round(totalActiveTime / 1e3),
			[ATTR_DO11Y_ENGAGEMENT_RATIO]: Math.round(engagementRatio * 100) / 100,
			[ATTR_DO11Y_MAX_SCROLL_DEPTH]: maxScroll,
			[ATTR_DO11Y_REFERRER_CATEGORY]: session.referrerCategory,
			[ATTR_DO11Y_AI_PLATFORM]: session.aiPlatform
		});
		afterEmit?.();
	}
	function setupEngagementTracking(config, emit) {
		const visibilityHandler = () => {
			if (document.hidden) {
				if (isPageVisible) {
					totalActiveTime += Date.now() - lastActivityTime;
					isPageVisible = false;
				}
			} else {
				lastActivityTime = Date.now();
				isPageVisible = true;
			}
		};
		document.addEventListener("visibilitychange", visibilityHandler);
		const beforeUnloadHandler = () => {
			emitPageExit(config, emit);
		};
		window.addEventListener("beforeunload", beforeUnloadHandler);
		return () => {
			document.removeEventListener("visibilitychange", visibilityHandler);
			window.removeEventListener("beforeunload", beforeUnloadHandler);
		};
	}
	function resetEngagementState() {
		pageLoadTime = Date.now();
		lastActivityTime = Date.now();
		totalActiveTime = 0;
		isPageVisible = true;
		pageExited = false;
	}
	/**
	* Reset only the page_exit guard flag, without affecting timing data.
	* Called by trackPageView() so that the guard is cleared even if
	* resetEngagementState() (which also resets it) was not invoked.
	*/
	function resetPageExitedGuard() {
		pageExited = false;
	}
	//#endregion
	//#region src/core/tracking/page-view.ts
	function trackPageView(config, emit) {
		resetPageExitedGuard();
		const session = updatePageSequence(window.location.pathname);
		const referrerDomain = getReferrerDomain();
		const referrerInfo = classifyReferrer(referrerDomain);
		if (session.pageCount === 1) {
			session.referrerCategory = referrerInfo.referrerCategory;
			session.aiPlatform = referrerInfo.aiPlatform;
			saveSession(session);
		}
		emit(EVENT_PAGE_VIEW, {
			[ATTR_DO11Y_REFERRER_DOMAIN]: referrerDomain,
			[ATTR_DO11Y_REFERRER_CATEGORY]: referrerInfo.referrerCategory,
			[ATTR_DO11Y_AI_PLATFORM]: referrerInfo.aiPlatform,
			[ATTR_DO11Y_IS_FIRST_PAGE]: session.pageCount === 1,
			[ATTR_DO11Y_PREVIOUS_PATH]: session.pageSequence.length > 1 ? session.pageSequence[session.pageSequence.length - 2].path : null
		});
	}
	function saveSession(session) {
		try {
			sessionStorage.setItem("do11y_session", JSON.stringify(session));
		} catch {}
	}
	//#endregion
	//#region src/core/tracking/links.ts
	function getLinkContext(link, config) {
		if (link.closest(config.navigationSelector)) return "navigation";
		if (link.closest(config.footerSelector)) return "footer";
		if (link.closest(config.contentSelector)) return "content";
		return "other";
	}
	function getLinkIndex(link, href) {
		if (typeof CSS === "undefined" || typeof CSS.escape !== "function") return 1;
		try {
			const allLinks = document.querySelectorAll("a[href=\"" + CSS.escape(href) + "\"]");
			for (let i = 0; i < allLinks.length; i++) if (allLinks[i] === link) return i + 1;
		} catch {}
		return 1;
	}
	function setupLinkTracking(config, emit) {
		const handler = (e) => {
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
			emit(EVENT_LINK_CLICK, {
				[ATTR_DO11Y_LINK_TYPE]: linkType,
				[ATTR_DO11Y_LINK_TARGET_URL]: href,
				[ATTR_DO11Y_LINK_TARGET_DOMAIN]: targetDomain,
				[ATTR_DO11Y_LINK_TEXT]: sanitizeText(link.textContent, 100),
				[ATTR_DO11Y_LINK_CONTEXT]: getLinkContext(link, config),
				[ATTR_DO11Y_LINK_SECTION]: sanitizeText(getNearestHeading(link), 100),
				[ATTR_DO11Y_LINK_INDEX]: getLinkIndex(link, href)
			});
		};
		document.addEventListener("click", handler, true);
		return () => document.removeEventListener("click", handler, true);
	}
	//#endregion
	//#region src/core/tracking/search.ts
	function setupSearchTracking(config, emit) {
		const clickHandler = (e) => {
			if (e.target.closest(config.searchSelector)) emit(EVENT_SEARCH_OPENED, {});
		};
		document.addEventListener("click", clickHandler, true);
		const keydownHandler = (e) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") emit(EVENT_SEARCH_OPENED, { [ATTR_DO11Y_SEARCH_TRIGGER]: "keyboard" });
		};
		document.addEventListener("keydown", keydownHandler);
		return () => {
			document.removeEventListener("click", clickHandler, true);
			document.removeEventListener("keydown", keydownHandler);
		};
	}
	//#endregion
	//#region src/core/tracking/copy.ts
	function getCodeBlockIndex(codeBlock, config) {
		if (!codeBlock) return 1;
		try {
			const allBlocks = document.querySelectorAll(config.codeBlockSelector);
			for (let i = 0; i < allBlocks.length; i++) if (allBlocks[i] === codeBlock) return i + 1;
		} catch {}
		return 1;
	}
	function setupCopyTracking(config, emit) {
		const handler = (e) => {
			const copyButton = e.target.closest(config.copyButtonSelector);
			if (copyButton) {
				const codeBlock = copyButton.closest("[class*=\"language-\"], [language]") ?? copyButton.closest(config.codeBlockSelector) ?? copyButton.closest(".expressive-code")?.querySelector("pre") ?? copyButton.closest("div, section")?.querySelector("pre") ?? copyButton.parentElement?.querySelector("pre") ?? null;
				const language = extractCodeLanguage((codeBlock ? codeBlock.tagName === "PRE" ? codeBlock.querySelector("code") : codeBlock.querySelector("code[class*=\"language-\"], code[language]") ?? codeBlock.querySelector("code") : null) ?? codeBlock ?? copyButton);
				emit(EVENT_CODE_COPIED, {
					[ATTR_DO11Y_CODE_LANGUAGE]: language,
					[ATTR_DO11Y_CODE_SECTION]: sanitizeText(getNearestHeading(codeBlock ?? copyButton), 100),
					[ATTR_DO11Y_CODE_INDEX]: getCodeBlockIndex(codeBlock, config)
				});
			}
		};
		document.addEventListener("click", handler, true);
		return () => document.removeEventListener("click", handler, true);
	}
	//#endregion
	//#region src/core/tracking/tabs.ts
	function setupTabSwitchTracking(config, emit) {
		if (!config.trackTabSwitches) return () => {};
		const handler = (e) => {
			let baseSel = "[role=\"tab\"], .tabs button, .tabs a, .tabbed-labels label";
			const safeTabSel = validateSelector(config.tabContainerSelector);
			if (safeTabSel) baseSel += ", " + safeTabSel + " button, " + safeTabSel + " a, " + safeTabSel + " label";
			const tab = e.target.closest(baseSel);
			if (!tab) return;
			if (tab.getAttribute("aria-selected") === "true" || tab.classList.contains("active") || tab.classList.contains("is-active")) return;
			const label = sanitizeText(tab.textContent, 50);
			if (!label) return;
			const section = sanitizeText(getNearestHeading(tab), 100);
			emit(EVENT_TAB_SWITCH, {
				[ATTR_DO11Y_TAB_LABEL]: label,
				[ATTR_DO11Y_TAB_GROUP]: section,
				[ATTR_DO11Y_TAB_IS_DEFAULT]: false
			});
		};
		document.addEventListener("click", handler);
		return () => document.removeEventListener("click", handler);
	}
	//#endregion
	//#region src/core/tracking/toc.ts
	function setupTocClickTracking(config, emit) {
		if (!config.trackTocClicks) return () => {};
		const handler = (e) => {
			const link = e.target.closest("a");
			if (!link) return;
			const tocContainer = resolveTocContainer(link, config);
			if (!tocContainer) return;
			const href = link.getAttribute("href");
			const hash = href ? resolveTocHash(href) : null;
			if (!hash) return;
			const headingText = sanitizeText(link.textContent, 100);
			let headingLevel = null;
			try {
				const targetId = hash.slice(1);
				const targetEl = document.getElementById(targetId);
				if (targetEl && /^H[1-6]$/.test(targetEl.tagName)) headingLevel = parseInt(targetEl.tagName.charAt(1), 10);
			} catch {}
			const tocLinks = tocContainer.querySelectorAll("a[href*=\"#\"]");
			let tocPosition = 1;
			for (let i = 0; i < tocLinks.length; i++) if (tocLinks[i] === link) {
				tocPosition = i + 1;
				break;
			}
			emit(EVENT_TOC_CLICK, {
				[ATTR_DO11Y_TOC_HEADING]: headingText,
				[ATTR_DO11Y_TOC_HEADING_LEVEL]: headingLevel,
				[ATTR_DO11Y_TOC_POSITION]: tocPosition
			});
		};
		document.addEventListener("click", handler, true);
		return () => document.removeEventListener("click", handler, true);
	}
	//#endregion
	//#region src/core/tracking/feedback.ts
	function setupFeedbackTracking(config, emit) {
		if (!config.trackFeedback) return () => {};
		const handler = (e) => {
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
			emit(EVENT_FEEDBACK, { [ATTR_DO11Y_FEEDBACK_RATING]: rating });
		};
		document.addEventListener("click", handler);
		return () => document.removeEventListener("click", handler);
	}
	//#endregion
	//#region src/core/tracking/expand.ts
	function setupExpandCollapseTracking(config, emit) {
		if (!config.trackExpandCollapse) return () => {};
		const toggleHandler = (e) => {
			const details = e.target;
			if (details.tagName !== "DETAILS") return;
			const summary = details.querySelector("summary");
			const label = sanitizeText(summary ? summary.textContent : "", 100);
			emit(EVENT_EXPAND_COLLAPSE, {
				[ATTR_DO11Y_EXPAND_SUMMARY]: label,
				[ATTR_DO11Y_EXPAND_ACTION]: details.open ? "expand" : "collapse",
				[ATTR_DO11Y_EXPAND_SECTION]: sanitizeText(getNearestHeading(details), 100)
			});
		};
		document.addEventListener("toggle", toggleHandler, true);
		const clickHandler = (e) => {
			const trigger = e.target.closest("[aria-expanded], [class*=\"accordion\"] button, [class*=\"collapsible\"] button");
			if (!trigger) return;
			if (trigger.closest("details")) return;
			if (trigger.closest("nav, [role=\"navigation\"], header")) return;
			const wasExpanded = trigger.getAttribute("aria-expanded") === "true";
			emit(EVENT_EXPAND_COLLAPSE, {
				[ATTR_DO11Y_EXPAND_SUMMARY]: sanitizeText(trigger.textContent, 100),
				[ATTR_DO11Y_EXPAND_ACTION]: wasExpanded ? "collapse" : "expand",
				[ATTR_DO11Y_EXPAND_SECTION]: sanitizeText(getNearestHeading(trigger), 100)
			});
		};
		document.addEventListener("click", clickHandler);
		return () => {
			document.removeEventListener("toggle", toggleHandler, true);
			document.removeEventListener("click", clickHandler);
		};
	}
	//#endregion
	//#region src/instrumentation/config.ts
	/**
	* Build a normalized Do11yConfig from the instrumentation's user config.
	* This bridges the gap between the simplified DocsInstrumentationConfig
	* and the full Do11yConfig used by the core tracking modules.
	*/
	function buildConfig(userConfig) {
		return {
			framework: userConfig.framework ?? "mintlify",
			debug: userConfig.debug ?? false,
			trackScrollDepth: userConfig.trackScrollDepth ?? true,
			scrollThresholds: userConfig.scrollThresholds ?? [
				25,
				50,
				75,
				90
			],
			trackOutboundLinks: userConfig.trackOutboundLinks ?? true,
			trackInternalLinks: userConfig.trackInternalLinks ?? true,
			trackSectionVisibility: userConfig.trackSectionVisibility ?? true,
			sectionVisibleThreshold: userConfig.sectionVisibleThreshold ?? 3,
			trackTabSwitches: userConfig.trackTabSwitches ?? true,
			trackTocClicks: userConfig.trackTocClicks ?? true,
			trackExpandCollapse: userConfig.trackExpandCollapse ?? true,
			trackFeedback: userConfig.trackFeedback ?? true,
			searchSelector: userConfig.selectors?.searchSelector ?? null,
			copyButtonSelector: userConfig.selectors?.copyButtonSelector ?? null,
			codeBlockSelector: userConfig.selectors?.codeBlockSelector ?? null,
			navigationSelector: userConfig.selectors?.navigationSelector ?? null,
			footerSelector: userConfig.selectors?.footerSelector ?? null,
			contentSelector: userConfig.selectors?.contentSelector ?? null,
			tabContainerSelector: userConfig.selectors?.tabContainerSelector ?? null,
			tocSelector: userConfig.selectors?.tocSelector ?? null,
			feedbackSelector: userConfig.selectors?.feedbackSelector ?? null
		};
	}
	//#endregion
	//#region src/instrumentation/index.ts
	/**
	* Do11y — Documentation Observability
	*
	* OpenTelemetry Instrumentation for documentation sites.
	*
	* This is the npm/bundler distribution path. Users install
	* @opentelemetry/browser-sdk and @manototh/do11y, then register
	* DocsInstrumentation to get docs-specific events (scroll depth,
	* tab switches, code copies, etc.) flowing through the same OTel
	* pipeline as their auto-instrumentations.
	*
	* Example:
	*   import { startBrowserSdk } from '@opentelemetry/browser-sdk';
	*   import { DocsInstrumentation } from '@manototh/do11y/instrumentation';
	*
	*   startBrowserSdk({
	*     serviceName: 'my-docs',
	*     exportConfig: { url: 'https://otel.example.com/v1/logs' },
	*     instrumentations: [
	*       new DocsInstrumentation({ framework: 'mintlify' }),
	*     ],
	*   });
	*/
	let mutationObserver = null;
	let pathPollId = null;
	let popstateHandler = null;
	let pathChangeTimer = null;
	let lastEmitTime = {};
	const RATE_LIMIT_MS = 100;
	/**
	* OpenTelemetry instrumentation for documentation sites.
	*
	* Emits log records for documentation-specific events (page views,
	* scroll depth, tab switches, code copies, etc.) through the
	* OpenTelemetry API. Works alongside @opentelemetry/browser-sdk
	* and other browser instrumentations.
	*/
	var DocsInstrumentation = class extends InstrumentationBase {
		constructor(config = {}) {
			super("@manototh/do11y", VERSION, config);
			this._do11yConfig = {};
			this._cleanupFns = [];
		}
		/**
		* Init is called by the base class constructor.
		* For browser instrumentations that don't patch Node.js modules,
		* this can return void.
		*/
		init() {}
		/**
		* Enable the instrumentation: register all DOM event listeners.
		*/
		enable() {
			this._do11yConfig = buildConfig(this.getConfig());
			applyFrameworkSelectors(this._do11yConfig);
			const logger = logs.getLogger("@manototh/do11y");
			const emit = (eventName, eventData) => {
				const now = Date.now();
				if (RATE_LIMIT_MS > 0 && lastEmitTime[eventName]) {
					if (now - lastEmitTime[eventName] < RATE_LIMIT_MS) return;
				}
				lastEmitTime[eventName] = now;
				logger.emit({
					eventName,
					severityNumber: 9,
					attributes: {
						"browser.do11y.version": VERSION,
						...getBrowserContext(),
						...getPageInfo(),
						...eventData
					},
					body: ""
				});
			};
			this._cleanupFns = [
				setupLinkTracking(this._do11yConfig, emit),
				setupScrollTracking(this._do11yConfig, emit),
				setupEngagementTracking(this._do11yConfig, emit),
				setupSearchTracking(this._do11yConfig, emit),
				setupCopyTracking(this._do11yConfig, emit),
				setupSectionVisibilityTracking(this._do11yConfig, emit),
				setupTabSwitchTracking(this._do11yConfig, emit),
				setupTocClickTracking(this._do11yConfig, emit),
				setupFeedbackTracking(this._do11yConfig, emit),
				setupExpandCollapseTracking(this._do11yConfig, emit)
			];
			trackPageView(this._do11yConfig, emit);
			let lastPath = window.location.pathname;
			const onDomMutated = () => {
				observeHeadings();
			};
			const handlePathChange = () => {
				if (window.location.pathname === lastPath) return;
				if (pathChangeTimer) clearTimeout(pathChangeTimer);
				pathChangeTimer = setTimeout(() => {
					pathChangeTimer = null;
					if (window.location.pathname === lastPath) return;
					lastPath = window.location.pathname;
					emitPageExit(this._do11yConfig, emit);
					resetTrackedScrollDepths();
					resetEngagementState();
					trackPageView(this._do11yConfig, emit);
					observeHeadings();
				}, 500);
			};
			mutationObserver = new MutationObserver(() => {
				onDomMutated();
				handlePathChange();
			});
			if (document.body) mutationObserver.observe(document.body, {
				childList: true,
				subtree: true
			});
			else {
				const bodyCheckId = window.setInterval(() => {
					if (document.body) {
						mutationObserver.observe(document.body, {
							childList: true,
							subtree: true
						});
						clearInterval(bodyCheckId);
					}
				}, 100);
			}
			popstateHandler = handlePathChange;
			window.addEventListener("popstate", popstateHandler);
			pathPollId = window.setInterval(handlePathChange, 200);
		}
		/**
		* Disable the instrumentation: tear down all event listeners and observers.
		*/
		disable() {
			if (pathChangeTimer) {
				clearTimeout(pathChangeTimer);
				pathChangeTimer = null;
			}
			for (const fn of this._cleanupFns) fn();
			this._cleanupFns = [];
			if (mutationObserver) {
				mutationObserver.disconnect();
				mutationObserver = null;
			}
			if (pathPollId !== null) {
				clearInterval(pathPollId);
				pathPollId = null;
			}
			if (popstateHandler) {
				window.removeEventListener("popstate", popstateHandler);
				popstateHandler = null;
			}
			this._do11yConfig = {};
		}
	};
	//#endregion
	//#region tests/harness/index.ts
	/**
	* Do11y — Test harness for instrumentation tests.
	*
	* This is a small IIFE bundle that sets up an OpenTelemetry LoggerProvider
	* with a Supabase-backed LogRecordExporter, then enables DocsInstrumentation.
	* Events are sent to a Supabase table for test validation via REST API query.
	*
	* Built by rolldown → tests/harness/do11y-test-harness.js
	*
	* The test runner calls __do11yTestSetConfig() with framework, Supabase
	* credentials, and test-run metadata, then __do11yTestInit() to bootstrap.
	* No in-memory exporter — validation is always via Supabase query.
	*
	* Window API exposed to test runners:
	*   __do11yTestSetConfig(c) → void  (set config before init)
	*   __do11yTestInit()       → void  (teardown + setup with current config)
	*   __do11yTestReset()      → void  (re-init with same config)
	*/
	var SupabaseLogRecordExporter = class {
		constructor(supabaseUrl, supabaseKey, table, testRunId, testFramework) {
			this.url = `${supabaseUrl}/rest/v1/${table}`;
			this.headers = {
				"apikey": supabaseKey,
				"Authorization": `Bearer ${supabaseKey}`,
				"Content-Type": "application/json",
				"Prefer": "return=minimal"
			};
			this.testRunId = testRunId;
			this.testFramework = testFramework;
		}
		export(logRecords, resultCallback) {
			const payloads = logRecords.map((record) => {
				const payload = {
					eventName: record.eventName,
					...record.attributes
				};
				if (this.testRunId) payload._testRunId = this.testRunId;
				if (this.testFramework) payload._testFramework = this.testFramework;
				return { payload };
			});
			const body = JSON.stringify(payloads);
			try {
				const xhr = new XMLHttpRequest();
				xhr.open("POST", this.url, false);
				for (const [key, val] of Object.entries(this.headers)) xhr.setRequestHeader(key, val);
				xhr.send(body);
				resultCallback({ code: xhr.status >= 200 && xhr.status < 300 ? 0 : 1 });
			} catch {
				resultCallback({ code: 1 });
			}
		}
		async flush() {}
		shutdown() {
			return Promise.resolve();
		}
	};
	let instrumentation = null;
	let harnessConfig = {};
	let supabaseExporter = null;
	let loggerProvider = null;
	let harnessEmit = null;
	function setup() {
		supabaseExporter = new SupabaseLogRecordExporter(harnessConfig.supabaseUrl, harnessConfig.supabaseKey, harnessConfig.supabaseTable ?? "do11y_events", harnessConfig.testRunId, harnessConfig.testFramework);
		loggerProvider = new LoggerProvider({ processors: [new SimpleLogRecordProcessor({ exporter: supabaseExporter })] });
		logs.setGlobalLoggerProvider(loggerProvider);
		const logger = logs.getLogger("@manototh/do11y");
		harnessEmit = (eventName, eventData) => {
			logger.emit({
				eventName,
				severityNumber: 9,
				attributes: {
					"browser.do11y.version": "0.2.0",
					...getBrowserContext(),
					...getPageInfo(),
					...eventData
				},
				body: ""
			});
		};
		instrumentation = new DocsInstrumentation(harnessConfig);
		instrumentation.enable();
	}
	function teardown() {
		if (instrumentation) {
			instrumentation.disable();
			instrumentation = null;
		}
		loggerProvider = null;
		supabaseExporter = null;
	}
	window.__do11yTestSetConfig = function(c) {
		harnessConfig = c;
	};
	window.__do11yTestInit = function() {
		teardown();
		try {
			setup();
		} catch (err) {
			_bootError = String(err);
			console.error("[Do11y Harness] setup() failed:", err);
		}
	};
	let _bootError = null;
	window.__do11yTestDidBoot = function() {
		return _bootError || (instrumentation !== null ? "ok" : "not-booted");
	};
	window.__do11yTestReset = function() {
		teardown();
		setup();
	};
	/**
	* Emit page_exit event using the existing harness emit function.
	* Test runners call this before closing the page to ensure the exit event
	* is captured. The sync XHR exporter guarantees delivery.
	*/
	window.__do11yTestEmitPageExit = function() {
		if (harnessEmit) emitPageExit(harnessConfig, harnessEmit);
	};
	//#endregion
})();
