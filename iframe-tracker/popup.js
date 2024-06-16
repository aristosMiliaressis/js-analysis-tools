var port = chrome.extension.connect({ name: "Sample Communication" });

window.onload = () => {
	chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
		chrome.tabs.get(tabs[0].id, function (tab) {
			port.postMessage({ origin: new URL(tab.url).origin });
		});
	});

	port.onMessage.addListener(function (msg) {
		listFrames(msg.frames);
	});

	var highlightCb = document.getElementById('highlight');
	if (localStorage.getItem('iframe-tracker-highlight') == 'true') {
		highlightCb.checked = true;
	}
	highlightCb.addEventListener('change', (event) => {
		chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
			localStorage.setItem('iframe-tracker-highlight', event.target.checked)
			chrome.tabs.sendMessage(tabs[0].id, { highlight: event.target.checked });
		});
	})
}

function listFrames(frames) {
	var x = document.getElementById('x');
	x.parentElement.removeChild(x);
	x = document.createElement('ol');
	x.id = 'x';

	document.getElementById('h').innerText = frames.length ? frames[0].url.origin : '';

	for (var i = 0; i < frames.length; i++) {
		frame = frames[i]
		el = document.createElement('li');

		bel = document.createElement('b');
		br = document.createElement('br');
		bel.innerText = frame.url.pathname;
		win = document.createElement('code');
		win.innerText = frame.path;
		el.appendChild(bel);
		el.appendChild(br);
		el.appendChild(win);

		// sel = document.createElement('span');
		// if(frame.fullstack) sel.setAttribute('title', frame.fullstack.join("\n\n"));
		// seltxt = document.createTextNode(frame.stack);

		// sel.appendChild(seltxt);
		// el.appendChild(sel);

		var parser = new DOMParser()
		doc = parser.parseFromString(frame.frame, 'text/html');
		const attrToRemove = ['style', 'title'];
		for (const elm of doc.querySelectorAll('*')) {
			for (const attrib of [...attrToRemove]) {
				if (elm.hasAttribute(attrib)) {
					elm.removeAttribute(attrib);
				}
			}
		}

		pre = document.createElement('pre');
		pre.innerHTML = hljs.highlight(
			doc.body.innerHTML,
			{ language: 'html', ignoreIllegals: true }
		).value;
		el.appendChild(pre);

		x.appendChild(el);
	}
	document.getElementById('content').appendChild(x);
}