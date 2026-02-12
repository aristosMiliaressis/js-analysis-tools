var _cookies = [];

const extensionAPI = typeof browser !== "undefined" ? browser : chrome;
const port = extensionAPI.runtime.connect({ name: "Extension MessageChannel" });

extensionAPI.tabs.query({ active: true, currentWindow: true }, function (tabs) {
	port.postMessage({ tabId: tabs[0].id });
});

port.onMessage.addListener(function (cookies) {
	_cookies = cookies;
	populatePopupData();
});

exportBtn.onclick = exportCookies;
clearBtn.onclick = clearCookies;

function populatePopupData() {
	const MAX_URL_LENGTH = 200;
	let elementList = document.createElement('ul');
	elementList.id = 'x';

	for (let setCookie of _cookies.reverse()) {
		element = document.createElement('li');

		origin = document.createElement('b');
		origin.innerText = setCookie.href.substring(0, MAX_URL_LENGTH);
		win = document.createElement('code');
		win.innerText = `${setCookie.hops} ${setCookie.window == '' ? '' : ' window.name: ' + setCookie.window}`;
		element.appendChild(origin);
		element.appendChild(document.createElement('br'));
		element.appendChild(win);
		element.appendChild(document.createElement('br'));

		sel = document.createElement('span');
		if(setCookie.fullstack) { 
            sel.setAttribute('title', setCookie.fullstack.join("\n\n"));
            sel.onclick = async () => { await navigator.clipboard.writeText( setCookie.fullstack.join("\n\n"))};
        }
		seltxt = document.createTextNode(setCookie.stack);

		sel.appendChild(seltxt);
		element.appendChild(sel);

		pre = document.createElement('pre');
		pre.innerText = setCookie.assignment;
		element.appendChild(pre);

		elementList.appendChild(element);
	}

	document.querySelector('#content').appendChild(elementList);
}

function exportCookies() {
	var jsonCookies = '';
	_cookies.forEach((cookie) => {
		jsonCookies += JSON.stringify(cookie) + '\n';
	});
	const blob = new Blob([jsonCookies], { type: 'application/jsonl' });
	const cookiesBlobUrl = URL.createObjectURL(blob);
	var a = document.createElement("a");
	a.setAttribute('style', 'display: none');
	a.href = cookiesBlobUrl;
	a.download = `cookie-tracker-${Math.floor(Date.now() / 1000)}.json`;
	a.click();
	URL.revokeObjectURL(cookiesBlobUrl);
}

function clearCookies() {
	_cookies = []
	var storeEvent = new CustomEvent('cookieAccessTracker', { 'detail': { reset: true } });
	document.dispatchEvent(storeEvent);
}