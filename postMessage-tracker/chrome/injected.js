/*
History is needed to hijack pushState-changes
addEventListener to hijack the message-handlers getting registered
defineSetter to handle old way of setting onmessage
beforeunload to track page changes (since we see no diff btw fragmentchange/pushstate and real location change

we also look for event.dispatch.apply in the listener, if it exists, we find a earlier stack-row and use that one
also, we look for jQuery-expandos to identify events being added later on by jQuery's dispatcher
*/
(function (pushstate, msgeventlistener, msgporteventlistener) {
	var loaded = false;
	var originalFunctionToString = Function.prototype.toString;

	var originalBind = Function.prototype.bind; 
	window.BindedFunctionLookupTable = new Map();
	Function.prototype.bind = function () {
		var bindedFunction = originalBind.call(this, ...arguments) 
		window.BindedFunctionLookupTable[bindedFunction.name] = this.toString();
		return bindedFunction;
	}

	var m = function (detail) {
		var storeEvent = new CustomEvent('postMessageTracker', { 'detail': detail });
		document.dispatchEvent(storeEvent);
	};
	var h = function (p) {
		var hops = "";
		try {
			if (!p) p = window;
			if (p.top != p && p.top == window.top) {
				var w = p;
				while (top != w) {
					var x = 0;
					for (var i = 0; i < w.parent.frames.length; i++) {
						if (w == w.parent.frames[i]) x = i;
					};
					hops = "frames[" + x + "]" + (hops.length ? '.' : '') + hops;
					w = w.parent;
				};
				hops = "top" + (hops.length ? '.' + hops : '')
			} else {
				hops = p.top == window.top ? "top" : "diffwin";
			}
		} catch (e) {

		}
		return hops;
	};
	var jq = function (instance) {
		if (!instance || !instance.message || !instance.message.length) return;
		var j = 0; while (e = instance.message[j++]) {
			listener = e.handler; if (!listener) return;
			m({ window: window.top == window ? '' : window.name, hops: h(), domain: document.domain, stack: 'jQuery', listener: listener.toString() });
		};
	};
	var l = function (listener, pattern_before, additional_offset) {
		offset = 2 + (additional_offset || 0)
		try { throw new Error(''); } catch (error) { stack = error.stack || ''; }
		// ignore chrome extensions
		if (document.currentScript != null && document.currentScript.src.includes("chrome-extension://")) {
			return
		}
		stack = stack.split('\n').map(function (line) { return line.trim(); });
		fullstack = stack.slice();
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
			} while (last.includes("Window.addEventListener"));
			fullstack = stack.slice(offset - 1);
			stack = last;
		}
		listener_str = listener.__postmessagetrackername__ || listener.toString();
		m({ window: window.top == window ? '' : window.name, hops: h(), domain: document.domain, stack: stack, fullstack: fullstack, listener: listener_str });
	};
	var jqc = function (key) {
		m({ log: ['Found key', key, typeof window[key], window[key] ? window[key].toString() : window[key]] });
		if (typeof window[key] == 'function' && typeof window[key]._data == 'function') {
			m({ log: ['found jq function', window[key].toString()] });
			ev = window[key]._data(window, 'events');
			jq(ev);
		} else if (window[key] && (expando = window[key].expando)) {
			m({ log: ['Use expando', expando] });
			var i = 1; while (instance = window[expando + i++]) {
				jq(instance.events);
			}
		} else if (window[key]) {
			m({ log: ['Use events directly', window[key].toString()] });
			jq(window[key].events);
		}
	};
	var j = function () {
		m({ log: 'Run jquery fetcher' });
		var all = Object.getOwnPropertyNames(window);
		var len = all.length;
		for (var i = 0; i < len; i++) {
			var key = all[i];
			if (key.indexOf('jQuery') !== -1) {
				jqc(key);
			}
		}
		loaded = true;
	};
	History.prototype.pushState = function (state, title, url) {
		m({ pushState: true });
		return pushstate.apply(this, arguments);
	};
	var original_setter = window.__lookupSetter__('onmessage');
	window.__defineSetter__('onmessage', function (listener) {
		if (listener) {
			l(listener.toString());
		}
		original_setter(listener);
	});
	var c = function (listener) {
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

	var onmsgport = function (e) {
		if (e.data && (e.data.wappalyzer !== undefined || e.data.ext == "domlogger" || e.data.ext == "domlogger++" || e.data.untrustedTypes !== undefined)) {
			return
		}
        try {
            obj = JSON.parse(e.data) // hides DOM INvader messages
            if (Array.isArray(obj) && obj.length == 3 && obj[1].length == 1) {
                return
            }
        } catch (e) {
            // not a json
        }
		var p = (e.ports.length ? '%cport' + e.ports.length + '%c ' : '');
		var msg = '%cport%c→%c' + h(e.source) + '%c ' + p + (typeof e.data == 'string' ? e.data : 'j ' + JSON.stringify(e.data));
		var logMsg = "port → " + h(e.source) + " <" + location.href + "> " + (e.ports.length ? 'port' + e.ports.length + ' : ' : ' : ') + (typeof e.data == 'string' ? e.data : 'j ' + JSON.stringify(e.data));
		if (p.length) {
			console.log(msg, "color: blue", '', "color: red", '', "color: blue", '');
		} else {
			console.log(msg, "color: blue", '', "color: red", '');
		}

		var storeEvent = new CustomEvent('postMessageTracker', { 'detail': { message: logMsg } });
		document.dispatchEvent(storeEvent);
	};
	const anarchyDomains = new Set(['https://firebasestorage.googleapis.com', 'https://www.gstatic.com', 'https://ssl.gstatic.com', 'https://googlechromelabs.github.io', 'https://storage.googleapis.com']);
	function whois(origin) {
        if (origin === 'null') return 'OPAQUE ' + origin;
        if (origin === '*') return 'UNSAFE ' + origin;
        if (origin.startsWith('http://')) return 'UNSAFE ' + origin;
        if (anarchyDomains.has(origin)) return 'UNSAFE ' + origin;
        return origin;
    }
	var onmsg = function (e) {
		if (e.data && (e.data.wappalyzer !== undefined || e.data.ext == "domlogger" || e.data.ext == "domlogger++" || e.data.untrustedTypes !== undefined)) {
			return
		}
		var p = (e.ports.length ? '%cport' + e.ports.length + '%c ' : '');
		const me = whois(window.origin);
        const source = whois(e.origin);
		var msg = '%c' + h(e.source) + `%c <${source}> → %c` + h() + `%c <${me}> ` + p + (typeof e.data == 'string' ? e.data : 'j ' + JSON.stringify(e.data));
		var logMsg = h(e.source) + " <" + source + "> → " + h() + " <" + me + "> " + (e.ports.length ? 'port' + e.ports.length + ' :' : ' :') + (typeof e.data == 'string' ? e.data : 'j ' + JSON.stringify(e.data));
		if (p.length) {
			console.log(msg, "color: red", '', "color: green", '', "color: blue", '');
		} else {
			console.log(msg, "color: red", '', "color: green", '');
		}
		var storeEvent = new CustomEvent('postMessageTracker', { 'detail': { message: logMsg } });
		document.dispatchEvent(storeEvent);
	};
	window.addEventListener('message', onmsg)
	MessagePort.prototype.addEventListener = function (type, listener, useCapture) {
		if (!this.__postmessagetrackername__) {
			this.__postmessagetrackername__ = true;
			this.addEventListener('message', onmsgport);
		}
		return msgporteventlistener.apply(this, arguments);
	}

	Window.prototype.addEventListener = function (type, listener, useCapture) {
		if (type == 'message') {
			var pattern_before = false, offset = 0;
			if (listener.toString().indexOf('event.dispatch.apply') !== -1) {
				m({ log: 'We got a jquery dispatcher' });
				pattern_before = /init\.on|init\..*on\]/;
				if (loaded) { setTimeout(j, 100); }
			}
			//console.log('yo')
			//debugger;
			var unwrap = function (listener) {
				found = c(listener);
				//console.log('found', found)
				if (found == 'raven') {
					var fb = false, ff = false, v = null;
					for (key in listener) {
						var v = listener[key];
						if (typeof v == "function") { ff++; f = v; }
						if (typeof v == "boolean") fb++;
					}
					if (ff == 1 && fb == 1) {
						m({ log: 'We got a raven wrapper' });
						offset++;
						listener = unwrap(f);
					}
				} else if (found == 'newrelic') {
					m({ log: 'We got a newrelic wrapper' });
					offset++;
					listener = unwrap(listener["nr@original"]);
				} else if (found == 'sentry') {
					m({ log: 'We got a sentry wrapper' });
					offset++;
					listener = unwrap(listener["__sentry_original__"]);
				} else if (found == 'rollbar') {
					m({ log: 'We got a rollbar wrapper' });
					offset += 2;
				} else if (found == 'bugsnag') {
					offset++;
					var clr = null;
					try { clr = arguments.callee.caller.caller.caller } catch (e) { }
					if (clr && !c(clr)) { //dont care if its other wrappers
						m({ log: 'We got a bugsnag wrapper' });
						listener.__postmessagetrackername__ = clr.toString();
					} else if (clr) { offset++ }
				} else if (found == 'bugsnag2') {
					offset++;
					var clr = null;
					try { clr = arguments.callee.caller.caller.arguments[1]; } catch (e) { }
					if (clr && !c(clr)) { //dont care if its other wrappers
						listener = unwrap(clr);
						m({ log: 'We got a bugsnag2 wrapper' });
						listener.__postmessagetrackername__ = clr.toString();
					} else if (clr) { offset++; }
				}
				if (listener.name.indexOf('bound ') === 0) {
					listener.__postmessagetrackername__ = window.BindedFunctionLookupTable[listener.name];
				}
				return listener;
			};

			if (typeof listener == "function") {
				listener = unwrap(listener);
				l(listener, pattern_before, offset);
			}
		}
		return msgeventlistener.apply(this, arguments);
	};
	window.addEventListener('load', j);
	window.addEventListener('postMessageTrackerUpdate', j);
})(History.prototype.pushState, Window.prototype.addEventListener, MessagePort.prototype.addEventListener)