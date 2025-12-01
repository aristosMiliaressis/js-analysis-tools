const extensionAPI = typeof browser !== "undefined" ? browser : chrome;
const port = extensionAPI.runtime.connect({ name: "Extension MessageChannel" });

extensionAPI.tabs.query({ active: true, currentWindow: true }, function (tabs) {
	port.postMessage({ tabId: tabs[0].id });
});

port.onMessage.addListener(function (cookies) {
	populatePopupData(cookies);
});

function populatePopupData(cookies) {
	const MAX_URL_LENGTH = 200;
	let elementList = document.createElement('ul');
	elementList.id = 'x';

	for (let setCookie of cookies) {
		element = document.createElement('li');

		origin = document.createElement('b');
		origin.innerText = setCookie.origin + ' ';
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
		pre.innerText = setCookie.value;
		element.appendChild(pre);

		elementList.appendChild(element);
	}

	document.querySelector('#content').appendChild(elementList);
}
