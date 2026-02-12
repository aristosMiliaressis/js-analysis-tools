const extensionAPI = typeof browser !== "undefined" ? browser : chrome;

(function () {
	switch (document.contentType) {
		case 'application/xml':
			return;
	}
	
	var cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie') ||
                 Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');
	if (cookieDesc && cookieDesc.configurable) {
		Object.defineProperty(document, 'cookie', {
			get: function () {
				return cookieDesc.get.call(document);
			},
			set: function (val) {
				try { throw new Error(''); } catch (error) { stack = error.stack || ''; }
				stack = stack.split('\n').slice(2).map(function (line) { return line.trim(); });

				var hops = "";
				try {
					if (window.top != window && window.top == window.top) {
						var w = window;
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
						hops = "top";
					}
				} catch (e) {

				}

				var storeEvent = new CustomEvent('cookieAccessTracker', { 'detail': { 
					assignment: val, 
					name:val.split('=')[0],
					value:val.split('=')[1].split(';')[0],
					attributes:val.split('=').slice(1).join('=').split(';').slice(1).join('; '),
					origin: window.origin, 
					href: location.href,
					window: window.top == window ? '' : window.name,
					fullstack: stack,
					stack: stack[stack.length-1],
					hops: hops
				}});
				document.dispatchEvent(storeEvent);

				cookieDesc.set.call(document, val);
			}
		});
	}

})();
