/*
History is needed to hijack pushState-changes
addEventListener to hijack the hashchange-handlers getting registered
defineSetter to handle old way of setting onhashchange
beforeunload to track page changes (since we see no diff btw fragmentchange/pushstate and real location change

we also look for event.dispatch.apply in the listener, if it exists, we find a earlier stack-row and use that one
also, we look for jQuery-expandos to identify events being added later on by jQuery's dispatcher
*/ 
var injectedJS = function(pushstate, eventlistener) {
    var originalFunctionToString = Function.prototype.toString;
	var m = function(detail) {
		var storeEvent = new CustomEvent('hashChangeTracker', {'detail':detail});
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
	var l = function(listener, pattern_before, additional_offset) {
		offset = 0 + (additional_offset||0)
		try { throw new Error(''); } catch (error) { stack = error.stack || ''; }
		// ignore chrome extensions
		if(stack.includes("chrome-extension://")) {
			return
		}
		stack = stack.split('\n').slice(3).map(function (line) { return line.trim(); });
		fullstack = stack.slice();
		if(pattern_before) {
			nextitem = false;
			stack = stack.filter(function(e){
				if(nextitem) { nextitem = false; return true; }
				if(e.match(pattern_before))
					nextitem = true;
				return false;
			});
			stack = stack[0];
		} else {
			stack = stack[offset];
		}
		listener_str = listener.__hashchangetrackername__ || listener.toString();

		m({window:window.top==window?'':window.name, hops: h(),domain:document.domain,stack:stack,fullstack:fullstack,listener:listener_str});
	};
	History.prototype.pushState = function(state, title, url) {
		m({pushState:true});
		return pushstate.apply(this, arguments);
	};
	var original_setter = window.__lookupSetter__('onhashchange');
	window.__defineSetter__('onhashchange', function(listener) {
		if(listener) {
			l(listener.toString());
		}
		original_setter(listener);
	});
	var c = function(listener) {
		var listener_str = originalFunctionToString.apply(listener)
		if(listener_str.match(/\.deep.*apply.*captureException/s)) return 'raven';
		else if(listener_str.match(/arguments.*(start|typeof).*err.*finally.*end/s) && listener["nr@original"] && typeof listener["nr@original"] == "function") return 'newrelic';
		else if(listener_str.match(/rollbarContext.*rollbarWrappedError/s) && listener._isWrap && 
					(typeof listener._wrapped == "function" || typeof listener._rollbar_wrapped == "function")) return 'rollbar';
		else if(listener_str.match(/autoNotify.*(unhandledException|notifyException)/s) && typeof listener.bugsnag == "function") return 'bugsnag';
		else if(listener_str.match(/call.*arguments.*typeof.*apply/s) && typeof listener.__sentry_original__ == "function") return 'sentry';
		else if(listener_str.match(/function.*function.*\.apply.*arguments/s) && typeof listener.__trace__ == "function") return 'bugsnag2';
		return false;
	}

	Window.prototype.addEventListener = function(type, listener, useCapture) {
		if(type=='hashchange') {
			var pattern_before = false, offset = 0;
//console.log('yo')
//debugger;
			var unwrap = function(listener) {
				found = c(listener);
//console.log('found', found)
				if(found == 'raven') {
					var fb = false, ff = false, v = null;
					for(key in listener) {
						var v = listener[key];
						if(typeof v == "function") { ff++; f = v; }
						if(typeof v == "boolean") fb++;
					}
					if(ff == 1 && fb == 1) {
						m({log:'We got a raven wrapper'});
						offset++;
						listener = unwrap(f);
					}
				} else if(found == 'newrelic') {
					m({log:'We got a newrelic wrapper'});
					offset++;
					listener = unwrap(listener["nr@original"]);
				} else if(found == 'sentry') {
					m({log:'We got a sentry wrapper'});
					offset++;
					listener = unwrap(listener["__sentry_original__"]);
				} else if(found == 'rollbar') {
					m({log:'We got a rollbar wrapper'});
					offset+=2;
				} else if(found == 'bugsnag') {
					offset++;
					var clr = null;
					try { clr = arguments.callee.caller.caller.caller } catch(e) { }
					if(clr && !c(clr)) { //dont care if its other wrappers
						m({log:'We got a bugsnag wrapper'});
						listener.__hashchangetrackername__ = clr.toString();
					} else if(clr) { offset++ }
				} else if(found == 'bugsnag2') {
					offset++;
					var clr = null;
					try { clr = arguments.callee.caller.caller.arguments[1]; } catch(e) { }
					if(clr && !c(clr)) { //dont care if its other wrappers
                        listener = unwrap(clr);
						m({log:'We got a bugsnag2 wrapper'});
						listener.__hashchangetrackername__ = clr.toString();
					} else if(clr) { offset++; }
				}
				if(listener.name.indexOf('bound ') === 0) {
					listener.__hashchangetrackername__ = listener.name;
				}
				return listener;
			};

            if(typeof listener == "function") {
    			listener = unwrap(listener);
				if (offset > 0) {offset--}
			    l(listener, pattern_before, offset);
            }
		}
		return eventlistener.apply(this, arguments);
	};
};

injectedJS = '(' + injectedJS.toString() + ')'+
             '(History.prototype.pushState, Window.prototype.addEventListener)';

document.addEventListener('hashChangeTracker', function(event) {
	chrome.runtime.sendMessage(event.detail);
});

//we use this to separate fragment changes with location changes
window.addEventListener('beforeunload', function(event) {
	var storeEvent = new CustomEvent('hashChangeTracker', {'detail':{changePage:true}});
	document.dispatchEvent(storeEvent);
});

(function() {
    switch(document.contentType) {
        case 'application/xml':
            return;
    }
    var script = document.createElement("script");
    script.setAttribute('type', 'text/javascript')
    script.appendChild(document.createTextNode(injectedJS));
    document.documentElement.appendChild(script);
})();
