const extensionAPI = typeof browser !== "undefined" ? browser : chrome;

// query data out of the dom on interval
var interval = setInterval(() => {
	var details = {}
	details.frames = [].slice.call(document.getElementsByTagName('iframe')).map((elm) => { return { outerHTML: elm.outerHTML, url: document.location, path: getDomPath(elm) } });
	details.targets = getCrossWindowTargetingElements().map((elm) => { return { outerHTML: elm.outerHTML, url: document.location, path: getDomPath(elm) } });
	details.rpo = getPathRelativeUriTargetingElements().map((elm) => { return { outerHTML: elm.outerHTML, url: document.location, path: getDomPath(elm) } });
	details.dom = document.documentElement.outerHTML;
	details.location = document.location.href;
	details.localStorage = localStorage;
	details.sessionStorage = sessionStorage;
	details.cookies = document.cookie;
	extensionAPI.runtime.sendMessage(details);
	
	applyTabOptions(true);
}, 500);

// sends data to webhook & reset tab data
onbeforeunload = (e) => {
	clearInterval(interval);
	extensionAPI.runtime.sendMessage({ reset: true });
};

// detect History API based navigations
var origPushState = History.prototype.pushState;
History.prototype.pushState = function (state, title, url) {
	clearInterval(interval);
	extensionAPI.runtime.sendMessage({ reset: true });

	return origPushState.apply(this, arguments);
};

applyTabOptions();

// respond to messages about changes to popup checkboxes
extensionAPI.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
	applyTabOptions(true);
});

function applyTabOptions(skipMsg) {
	extensionAPI.storage.local.get({
		options: {}
	}, function (i) {
		if (document.getElementById('dom-tracker-stylesheet') == null) {
			var style = document.createElement('style');
			style.id = 'dom-tracker-stylesheet';
			css = `iframe.dom-tracker-highlight {display: block !important; visibility: visible !important; border: 3px dashed green !important; margin: 5px !important; padding: 5px !important;}	
		a.dom-tracker-highlight, form.dom-tracker-highlight, area.dom-tracker-highlight {display: block !important; visibility: visible !important; border: 3px dashed yellow !important; margin: 5px !important; padding: 5px !important;}`;
			style.appendChild(document.createTextNode(css));
			document.body.appendChild(style);
		}
		
		if (i.options.highlight_iframe) {
			for (var frame of document.getElementsByTagName('iframe')) {
				frame.classList.add('dom-tracker-highlight');
			}
		} else {
			for (var frame of document.getElementsByTagName('iframe')) {
				frame.classList.remove('dom-tracker-highlight');
			}
		}
		
		if (i.options.highlight_target) {
			for (var elem of getCrossWindowTargetingElements()) {
				elem.classList.add('dom-tracker-highlight');
			}
		} else {
			for (var elem of getCrossWindowTargetingElements()) {
				elem.classList.remove('dom-tracker-highlight');
			}
		}
		
		if (!skipMsg && i.options.detect_quirks_mode) {
			// detects quirks mode for PRSSI exploitation
			document.compatMode != 'CSS1Compat' && alert(`${location.href} page is in quirks mode!`);
		}
	});
}
			
/// UTILITY FUNCTIONS ///
function getWindowPath() {
	var hops = "";
	if (window.top != window) {
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
	return hops;
}

function getDomPath(el) {
	var stack = [];
	
	while (el.parentNode != null) {
		var sibCount = 0;
		var sibIndex = 0;
		for (var i = 0; i < el.parentNode.childNodes.length; i++) {
			var sib = el.parentNode.childNodes[i];
			if (sib.nodeName == el.nodeName) {
				if (sib === el) {
					sibIndex = sibCount;
				}
				sibCount++;
			}
		}
		if (el.hasAttribute('id') && el.id != '') {
			stack.unshift(el.nodeName.toLowerCase() + '#' + el.id);
		} else if (sibCount > 1) {
			stack.unshift(el.nodeName.toLowerCase() + ':eq(' + sibIndex + ')');
		} else {
			stack.unshift(el.nodeName.toLowerCase());
		}
		el = el.parentNode;
	}
	
	stack.unshift(getWindowPath());

	return stack.slice(0).join(' > ');
}

function isPathRelative(href) {
	return href != null && !href.startsWith('/')
		&& !['http:', 'https:', 'data:', 'file:', 'javascript:',
			'mailto:', 'malto:', 'tel:'].some(scheme => href.startsWith(scheme));
}

function getPathRelativeUriTargetingElements() {
	let elements = new Array();

	var styles = document.getElementsByTagName('style');
	var links = document.getElementsByTagName('link');
	var anchors = document.getElementsByTagName('a');

	for (let style of styles) {
		if (isPathRelative(style.getAttribute('src'))) {
			elements.push(style);
		}
	}

	for (let link of links) {
		if (!['prefetch', 'preload', 'prerender', 'stylesheet'].includes(link.getAttribute('rel')))
			continue;

		if (isPathRelative(link.getAttribute('href'))) {
			elements.push(link);
		}
	}

	for (let anchor of anchors) {
		if (isPathRelative(anchor.getAttribute('href')) && anchor.getAttribute('download') != null) {
			elements.push(anchor);
		}
	}

	return elements;
}

function getCrossWindowTargetingElements() {
	let elements = new Array();

	for (let form of document.querySelectorAll('form[target]'))
		elements.push(form);

	for (let base of document.querySelectorAll('base[target]'))
		elements.push(base);

	for (let anchor of document.querySelectorAll('a[target]')) {
		if (anchor.getAttribute('target') != "_blank" && anchor.getAttribute('target') != "_self" && anchor.getAttribute('target') != "")
			elements.push(anchor);
	}

	for (let area of document.querySelectorAll('area[target]'))
		elements.push(area);

	return elements;
}