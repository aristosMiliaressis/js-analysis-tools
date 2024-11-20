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

	return stack.slice(1).join(' > ');
}

function getCrossWindowTargetingElements() {
	return [];
}

function getPathRelativeUriTargetingElements() {
	return [];
}

setInterval(() => {
	var details = {}
	details.frames = [].slice.call(document.getElementsByTagName('iframe')).map((elm) => { return { frame: elm.outerHTML, url: document.location, path: getDomPath(elm) } });
	details.target = getCrossWindowTargetingElements().map((elm) => { return { frame: elm.outerHTML, url: document.location, path: getDomPath(elm) } });
	details.rpo = getPathRelativeUriTargetingElements().map((elm) => { return { frame: elm.outerHTML, url: document.location, path: getDomPath(elm) } });
	details.dom = document.documentElement.outerHTML;
	details.path = document.location.pathname;
	chrome.runtime.sendMessage(details);
}, 500);

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	for (var frame of document.getElementsByTagName('iframe')) {
		var parser = new DOMParser()
		doc = parser.parseFromString(frame.outerHTML, 'text/html');
		const attrToRemove = ['style', 'title'];
		for (const elm of doc.querySelectorAll('*')) {
			for (const attrib of [...attrToRemove]) {
				if (elm.hasAttribute(attrib)) {
					elm.removeAttribute(attrib);
				}
			}
		}
		frame.setAttribute('title', doc.body.innerHTML);
		frame.style = 'border: 3px dashed green; margin: 5px; padding: 5px;'
	}
});

onunload = (e) => {
	chrome.runtime.sendMessage({ reset: true });
};

var origPushState = History.prototype.pushState;
History.prototype.pushState = function (state, title, url) {
	chrome.runtime.sendMessage({ reset: true });

	return origPushState.apply(this, arguments);
};