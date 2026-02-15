const extensionAPI = typeof browser !== "undefined" ? browser : chrome;

var port = extensionAPI.runtime.connect({
	name: "Sample Communication"
});

function loaded() {
	port.postMessage("get-stuff");
	port.onMessage.addListener(function(msg) {
		extensionAPI.tabs.query({active: true, currentWindow: true}, function(tabs) {
			listListeners(msg.listeners[tabs[0].id]);
		});
	});
}

window.onload = loaded

function listListeners(listeners) {
	let x = document.createElement('ul');
	x.id = 'x';

	for(var i = 0; i < listeners.length; i++) {
		listener = listeners[i]
		el = document.createElement('li');

		bel = document.createElement('b');
		bel.innerText = listener.domain + ' ';
		br = document.createElement('br');
		win = document.createElement('code');
		win.innerText = `${listener.hops} ${listener.window == '' ? '' : ' window.name: ' + listener.window}`;
		el.appendChild(bel);
		el.appendChild(win);
		el.appendChild(br);

		sel = document.createElement('span');
		if(listener.fullstack) sel.setAttribute('title', listener.fullstack.join("\n\n"));
		seltxt = document.createTextNode(listener.stack);
		
		sel.appendChild(seltxt);
		el.appendChild(sel);

		pre = document.createElement('pre');
		pre.innerHTML = hljs.highlight(
			listener.listener,
			{ language: 'javascript' }
		  ).value;
		el.appendChild(pre);

		x.appendChild(el);
	}

	document.getElementById('content').innerHTML = '';
	document.getElementById('content').appendChild(x);
}