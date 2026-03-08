var pushState = History.prototype.pushState;
var originalWindowAddEventListener = Window.prototype.addEventListener;
var originalMsgPortAddEventListener = MessagePort.prototype.addEventListener;
var originalMsgPortPostMessage = MessagePort.prototype.postMessage;
var originalServiceWorkerAddEventListener = ServiceWorkerContainer.prototype.addEventListener;
var originalServiceWorkerPostMessage = ServiceWorker.prototype.postMessage;
var originalWorkerAddEventListener = Worker.prototype.addEventListener;
var originalWorkerPostMessage = Worker.prototype.postMessage;
var originalSharedWorkerAddEventListener = SharedWorker.prototype.addEventListener;
var originalSharedWorkerPostMessage = SharedWorker.prototype.postMessage;
var originalBroadcastChannelAddEventListener = BroadcastChannel.prototype.addEventListener;
var originalBroadcastChannelPostMessage = BroadcastChannel.prototype.postMessage;
var originalFunctionToString = Function.prototype.toString;
var originalBind = Function.prototype.bind;
var originalWindowOnmessageSetter = window.__lookupSetter__('onmessage');
var originalWindowOnmessageErrorSetter = window.__lookupSetter__('onmessageerror');
const anarchyDomains = new Set(['https://firebasestorage.googleapis.com', 'https://www.gstatic.com', 'https://ssl.gstatic.com', 'https://googlechromelabs.github.io', 'https://storage.googleapis.com']);
var loaded = false;

function sendToContentScript(detail) {
	var storeEvent = new CustomEvent('postMessageTracker:data', { 'detail': detail });
	document.dispatchEvent(storeEvent);
}

function getBrowsingContextIdentifier(source) {
	var hops = "";
	try {
		if (!source)
			source = window;

		if (source.top != source && source.top == window.top) {
			var w = source;
			while (top != w) {
				var x = 0;
				for (var i = 0; i < w.parent.frames.length; i++) {
					if (w == w.parent.frames[i])
						x = i;
				}
				hops = "frames[" + x + "]" + (hops.length ? '.' : '') + hops;
				w = w.parent;
			};
			hops = "top" + (hops.length ? '.' + hops : '')
		} else {
			hops = source.top == window.top 
				? "top" 
				: source instanceof MessagePort 
					? "MessagePort"
					: source instanceof ServiceWorker || source instanceof ServiceWorkerContainer
						? "ServiceWorker"
						: source instanceof SharedWorker
						? "SharedWorker"
						:  source instanceof Worker 
						? "Worker" 
						: source instanceof BroadcastChannel 
						? `BroadcastChannel(${source.name})`
						: "diffwin";
		}
	} catch {}
	
	return hops;
}

function logListener(source, listener, pattern_before, additional_offset) {
	// ignore extensions
	if (document.currentScript != null && document.currentScript.src.includes("extension://")) {
		return
	}

	offset = 1 + (additional_offset || 0)
	try { throw new Error(''); } catch (error) { stack = error.stack || ''; }
	
	stack = stack.split('\n').filter(l => !l.includes("extension://")).map(function (line) { return line.trim(); });
	fullstack = stack.slice(offset);

	if (pattern_before) {
		nextitem = false;
		stack = stack.filter(function (e) {
			if (nextitem) { nextitem = false; return true; }
			if (e.match(pattern_before))
				nextitem = true;
			return false;
		});
		stack = stack[0];
	} else {
		do {
			last = stack[offset];
			offset++
		} while (stack[offset] != undefined && !last.includes("Window.addEventListener"));
		stack = last;
	}
	listener_str = listener.__postmessagetrackername__ || listener.toString();
	sendToContentScript({ window: window.top == window ? '' : window.name, hops: getBrowsingContextIdentifier(source), domain: document.domain, stack: stack, fullstack: fullstack, listener: listener_str });
}

function isJQuery(instance) {
	if (!instance || !instance.message || !instance.message.length)
		return;

	var j = 0; 
	while (msg = instance.message[j++]) {
		if (!msg.handler)
			return;

		sendToContentScript({ 
			window: window.top == window ? '' : window.name, hops: getBrowsingContextIdentifier(), 
			domain: document.domain, 
			stack: 'jQuery', 
			listener: msg.handler.toString() 
		});
	};
}

function detectJQueryListeners(key) {
	sendToContentScript({ log: ['Found key', key, typeof window[key], window[key] ? window[key].toString() : window[key]] });
	if (typeof window[key] == 'function' && typeof window[key]._data == 'function') {
		sendToContentScript({ log: ['found jq function', window[key].toString()] });
		ev = window[key]._data(window, 'events');
		isJQuery(ev);
	//we look for jQuery-expandos to identify events being added later on by jQuery's dispatcher
	} else if (window[key] && (expando = window[key].expando)) {
		sendToContentScript({ log: ['Use expando', expando] });
		var i = 1;
		while (instance = window[expando + i++]) {
			isJQuery(instance.events);
		}
	} else if (window[key]) {
		sendToContentScript({ log: ['Use events directly', window[key].toString()] });
		isJQuery(window[key].events);
	}
}

function runJQueryFetcher() {
	sendToContentScript({ log: 'Run jquery fetcher' });
	var all = Object.getOwnPropertyNames(window);
	var len = all.length;
	for (var i = 0; i < len; i++) {
		var key = all[i];
		if (key.indexOf('jQuery') !== -1) {
			detectJQueryListeners(key);
		}
	}
	loaded = true;
}

function detectWrapper(listener) {
	var listener_str = originalFunctionToString.apply(listener)
	if (listener_str.match(/\.deep.*apply.*captureException/s)) return 'raven';
	else if (listener_str.match(/arguments.*(start|typeof).*err.*finally.*end/s) && listener["nr@original"] && typeof listener["nr@original"] == "function") return 'newrelic';
	else if (listener_str.match(/rollbarContext.*rollbarWrappedError/s) && listener._isWrap &&
		(typeof listener._wrapped == "function" || typeof listener._rollbar_wrapped == "function")) return 'rollbar';
	else if (listener_str.match(/autoNotify.*(unhandledException|notifyException)/s) && typeof listener.bugsnag == "function") return 'bugsnag';
	else if (listener_str.match(/call.*arguments.*typeof.*apply/s) && typeof listener.__sentry_original__ == "function") return 'sentry';
	else if (listener_str.match(/function.*function.*\.apply.*arguments/s) && typeof listener.__trace__ == "function") return 'bugsnag2';
	return false;
}

function whois(origin) {
	if (origin === 'null') return 'OPAQUE ' + origin;
	if (origin === '*') return 'UNSAFE ' + origin;
	if (origin.startsWith('http://')) return 'UNSAFE ' + origin;
	if (anarchyDomains.has(origin)) return 'UNSAFE ' + origin;
	return origin;
}

function onEgressMsg(targetThis, data) {
	const target = targetThis instanceof MessagePort 
		? 'port'
		: targetThis instanceof Worker
		? 'worker'
		: targetThis instanceof SharedWorker
		? "sharedworker"
		: targetThis instanceof ServiceWorker || targetThis instanceof ServiceWorkerContainer
		? 'serviceworker'
		: targetThis instanceof BroadcastChannel
		? 'broadcast'
		: getBrowsingContextIdentifier(targetThis);
	
	const targetOrigin = targetThis instanceof MessagePort 
		? 'UNKNOWN_ORIGIN'
		: targetThis instanceof Worker
		? ''
		: targetThis instanceof SharedWorker
		? ''
		: targetThis instanceof ServiceWorker || targetThis instanceof ServiceWorkerContainer
		? ''
		: targetThis instanceof BroadcastChannel
		? ''
		: 'UNKNOWN_ORIGIN';

	const source = getBrowsingContextIdentifier();
	const sourceOrigin = whois(window.origin);

	var msg = `%c${source}%c <${sourceOrigin}> → %c${target}%c ${targetOrigin.length > 0 ? `<${targetOrigin}>`: ''} `;
	console.log(msg, "color: red", '', "color: green", '', data);

	sendToContentScript({ href: location.href,
		cookie: document.cookie, 
		localStorage: Object.values(localStorage),
		sessionStorage: Object.values(sessionStorage),
		message: {source:source, origin:sourceOrigin, destination: target, destinationOrigin:targetOrigin, data:data}, 
		isObj: !(typeof data == 'string'), 
		source: source + " <" + sourceOrigin + ">", 
		destination: target + " <" + targetOrigin + ">" });
}

function onIngressMsg(e) {
	if (e.data && (e.data.wappalyzer !== undefined || e.data.ext == "domlogger" || e.data.ext == "domlogger++" || e.data.untrustedTypes !== undefined)) {
		return
	}

	const target = getBrowsingContextIdentifier();
	const targetOrigin = whois(window.origin);

	const source = e.target instanceof MessagePort 
		? 'port'
		: e.target instanceof Worker
		? 'worker'
		: e.target instanceof SharedWorker
		? "sharedworker"
		: e.target instanceof ServiceWorker || e.target instanceof ServiceWorkerContainer
		? 'serviceworker'
		: e.target instanceof BroadcastChannel
		? 'broadcast'
		: getBrowsingContextIdentifier(e.source);
	
	const sourceOrigin = this instanceof MessagePort 
		? 'UNKNOWN_ORIGIN'
		: this instanceof Worker
		? ''
		: this instanceof SharedWorker
		? ''
		: this instanceof ServiceWorker || this instanceof ServiceWorkerContainer
		? ''
		: this instanceof BroadcastChannel
		? ''
		: whois(e.origin);

	var msg = `%c${source}%c ${sourceOrigin.length > 0 ? `<${sourceOrigin}>`: ''} → %c${target}%c <${targetOrigin}> `;
	console.log(msg, "color: red", '', "color: green", '', e.data);

	sendToContentScript({ href: location.href,
		cookie: document.cookie, 
		localStorage: Object.values(localStorage),
		sessionStorage: Object.values(sessionStorage),
		message: {source:source, origin:sourceOrigin, destination: target, destinationOrigin:targetOrigin, data:e.data}, 
		isObj: !(typeof e.data == 'string'), 
		source: source + " <" + sourceOrigin + ">", 
		destination: target + " <" + targetOrigin + ">" });
}

function unwrap(listener) {
	var offset = 0;
	found = detectWrapper(listener);
	if (found == 'raven') {
		var fb = false, ff = false, v = null;
		for (key in listener) {
			var v = listener[key];
			if (typeof v == "function") { ff++; f = v; }
			if (typeof v == "boolean") fb++;
		}
		if (ff == 1 && fb == 1) {
			sendToContentScript({ log: 'We got a raven wrapper' });
			offset++;
			unwrapped = unwrap(f);
			listener = unwrapped.listener;
			offset = unwrapped.offset;
		}
	} else if (found == 'newrelic') {
		sendToContentScript({ log: 'We got a newrelic wrapper' });
		offset++;
		unwrapped = unwrap(listener["nr@original"]);
		listener = unwrapped.listener;
		offset = unwrapped.offset;
	} else if (found == 'sentry') {
		sendToContentScript({ log: 'We got a sentry wrapper' });
		offset++;
		unwrapped = unwrap(listener["__sentry_original__"]);
		listener = unwrapped.listener;
		offset = unwrapped.offset;
	} else if (found == 'rollbar') {
		sendToContentScript({ log: 'We got a rollbar wrapper' });
		offset += 2;
	} else if (found == 'bugsnag') {
		offset++;
		var clr = null;
		try { clr = arguments.callee.caller.caller.caller } catch (e) { }
		if (clr && !detectWrapper(clr)) { //dont care if its other wrappers
			sendToContentScript({ log: 'We got a bugsnag wrapper' });
			listener.__postmessagetrackername__ = clr.toString();
		} else if (clr) { offset++ }
	} else if (found == 'bugsnag2') {
		offset++;
		var clr = null;
		try { clr = arguments.callee.caller.caller.arguments[1]; } catch (e) { }
		if (clr && !detectWrapper(clr)) { //dont care if its other wrappers
			unwrapped = unwrap(clr);
			listener = unwrapped.listener;
			offset = unwrapped.offset;
			sendToContentScript({ log: 'We got a bugsnag2 wrapper' });
			listener.__postmessagetrackername__ = clr.toString();
		} else if (clr) { offset++; }
	}
	if (listener.name?.indexOf('bound ') === 0) {
		listener.__postmessagetrackername__ = window.BindedFunctionLookupTable[listener.name];
	}
	return {listener, offset};
}

//we use this to separate fragment changes with location changes
window.addEventListener('beforeunload', function (event) {
	sendToContentScript({ changePage: true });
});

// detect history based navigation
History.prototype.pushState = function (state, title, url) {
	sendToContentScript({ pushState: true });
	return pushState.apply(this, arguments);
};

window.BindedFunctionLookupTable = new Map();
Function.prototype.bind = function () {
	var bindedFunction = originalBind.call(this, ...arguments) 
	window.BindedFunctionLookupTable[bindedFunction.name] = this.toString();
	return bindedFunction;
}

window.addEventListener('load', runJQueryFetcher);

window.addEventListener('message', onIngressMsg)

Window.prototype.addEventListener = function (type, listener, useCapture) {
	if (type == 'message' || type == 'messageerror') {
		var pattern_before = false;
		// we look for event.dispatch.apply in the listener, if it exists, we find a earlier stack-row and use that one
		if (listener.toString().indexOf('event.dispatch.apply') !== -1) {
			sendToContentScript({ log: 'We got a jquery dispatcher' });
			pattern_before = /init\.on|init\..*on\]/;
			if (loaded) setTimeout(runJQueryFetcher, 100)
		}

		if (typeof listener == "function") {
			unwrapped = unwrap(listener);
			logListener(this, unwrapped.listener, pattern_before, unwrapped.offset);
		}
	}
	return originalWindowAddEventListener.apply(this, arguments);
};

window.__defineSetter__('onmessage', function (listener) {
	if (listener) {
		var pattern_before = false;
		// we look for event.dispatch.apply in the listener, if it exists, we find a earlier stack-row and use that one
		if (listener.toString().indexOf('event.dispatch.apply') !== -1) {
			sendToContentScript({ log: 'We got a jquery dispatcher' });
			pattern_before = /init\.on|init\..*on\]/;
			if (loaded) setTimeout(runJQueryFetcher, 100)
		}

		if (typeof listener == "function") {
			unwrapped = unwrap(listener);
			logListener(this, unwrapped.listener, pattern_before, unwrapped.offset);
		}
	}
	originalWindowOnmessageSetter(listener);
});

window.__defineSetter__('onmessageerror', function (listener) {
	if (listener) {
		logListener(this, listener.toString());
	}
	originalWindowOnmessageErrorSetter(listener);
});

document.addEventListener('postMessageTracker:conf', function (event) {
	if (event.detail.options.detectMessagePortMessages) {
		MessagePort.prototype.postMessage = function () {
			onEgressMsg(this, arguments[0]);
			originalMsgPortPostMessage.apply(this, arguments);
		}
	}

	if (event.detail.options.detectBroadcastChannelMessages) {
		BroadcastChannel.prototype.postMessage = function () {
			onEgressMsg(this, arguments[0]);
			originalBroadcastChannelPostMessage.apply(this, arguments);
		}
	}

	if (event.detail.options.detectWorkerMessages) {
		Worker.prototype.postMessage = function () {
			onEgressMsg(this, arguments[0]);
			originalWorkerPostMessage.apply(this, arguments);
		}
	}

	if (event.detail.options.detectSharedWorkerMessages) {
		SharedWorker.prototype.postMessage = function () {
			onEgressMsg(this, arguments[0]);
			originalSharedWorkerPostMessage.apply(this, arguments);
		}
	}

	if (event.detail.options.detectServiceWorkerMessages) {
		ServiceWorker.prototype.postMessage = function () {
			onEgressMsg(this, arguments[0]);
			originalServiceWorkerPostMessage.apply(this, arguments);
		}
	}

	if (event.detail.options.detectMessagePortListeners) {
		var originalMessagePortOnmessageSetter = Object.getOwnPropertyDescriptor(MessagePort.prototype, "onmessage").set;
		Object.defineProperty(MessagePort.prototype, "onmessage", {
			set: function onmessage() {
				if (!this.__postmessagetrackername__ && arguments[0]) {
					this.__postmessagetrackername__ = true;
					logListener(this, arguments[0].toString())
					if (event.detail.options.detectMessagePortMessages) 
						this.addEventListener('message', onIngressMsg);
				}
				originalMessagePortOnmessageSetter.apply(this, arguments);
			}
		});

		var originalMessagePortOnmessageerrorSetter = Object.getOwnPropertyDescriptor(MessagePort.prototype, "onmessageerror").set;
		Object.defineProperty(MessagePort.prototype, "onmessageerror", {
			set: function onmessageerror() {
				if (!this.__postmessagetrackername__ && arguments[0]) {
					this.__postmessagetrackername__ = true;
					logListener(this, arguments[0].toString())
					if (event.detail.options.detectMessagePortMessages)
						this.addEventListener('messageerror', onIngressMsg);
				}
				originalMessagePortOnmessageerrorSetter.apply(this, arguments);
			}
		});

		MessagePort.prototype.addEventListener = function (type, listener, useCapture) {
			if (!this.__postmessagetrackername__ && listener) {
				this.__postmessagetrackername__ = true;
				logListener(this, listener);
				if (event.detail.options.detectMessagePortMessages)
					this.addEventListener('message', onIngressMsg);
			}
			return originalMsgPortAddEventListener.apply(this, arguments);
		}
	}

	if (event.detail.options.detectWorkerListeners) {
		var originalWorkerOnmessageSetter = Object.getOwnPropertyDescriptor(Worker.prototype, "onmessage").set;
		Object.defineProperty(Worker.prototype, "onmessage", {
			set: function onmessage() {
				if (!this.__postmessagetrackername__ && arguments[0]) {
					this.__postmessagetrackername__ = true;
					logListener(this, arguments[0].toString())
					if (event.detail.options.detectWorkerMessages)
						this.addEventListener('message', onIngressMsg);
					originalWorkerOnmessageSetter.apply(this, arguments);
				}
			}
		});

		Worker.prototype.addEventListener = function (type, listener, useCapture) {
			if (!this.__postmessagetrackername__) {
				this.__postmessagetrackername__ = true;
				logListener(this, listener);
				if (event.detail.options.detectWorkerMessages)
					this.addEventListener('message', onIngressMsg);
			}
			return originalWorkerAddEventListener.apply(this, arguments);
		}
	}

	if (event.detail.options.detectSharedWorkerListeners) {
		SharedWorker.prototype.addEventListener = function (type, listener, useCapture) {
			if (!this.__postmessagetrackername__) {
				this.__postmessagetrackername__ = true;
				logListener(this, listener);
				if (event.detail.options.detectSharedWorkerMessages)
					this.addEventListener('message', onIngressMsg);
			}
			return originalSharedWorkerAddEventListener.apply(this, arguments);
		}
	}

	if (event.detail.options.detectServiceWorkerListeners) {
		ServiceWorkerContainer.prototype.addEventListener = function (type, listener, useCapture) {
			if (!this.__postmessagetrackername__) {
				this.__postmessagetrackername__ = true;
				logListener(this, listener);
				if (event.detail.options.detectServiceWorkerMessages)
					this.addEventListener('message', onIngressMsg);
			}
			return originalServiceWorkerAddEventListener.apply(this, arguments);
		}
	}

	if (event.detail.options.detectBroadcastChannelListeners) {
		BroadcastChannel.prototype.addEventListener = function (type, listener, useCapture) {
			if (!this.__postmessagetrackername__) {
				this.__postmessagetrackername__ = true;
				logListener(this, listener);
				if (event.detail.options.detectBroadcastChannelMessages)
					this.addEventListener('message', onIngressMsg);
			}
			return originalBroadcastChannelAddEventListener.apply(this, arguments);
		}
	}
});

document.dispatchEvent(new CustomEvent("postMessageTracker:init"));
