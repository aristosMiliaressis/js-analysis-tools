var port = chrome.extension.connect({ name: "Sample Communication" });

window.onload = () => {
	chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
		port.postMessage({ tabId: tabs[0].id });
	});

	port.onMessage.addListener(function (msg) {
		listFrames(msg.frames);
	});

	openTab('iframe');

	var highlightCb = document.querySelector('.active-content').querySelector('[name=highlight]');
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

iframeTabButton.onclick = (evt) => openTab('iframe');
targetTabButton.onclick = (evt) => openTab('target');
rpoTabButton.onclick = (evt) => openTab('rpo');

function listFrames(frames) {
	var x = document.createElement('ol');
	x.id = 'x';

	for (var i = 0; i < frames.length; i++) {
		frame = frames[i]
		el = document.createElement('li');

		bel = document.createElement('b');
		br = document.createElement('br');
		bel.innerText = frame.url.href;
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
	document.querySelector('.active-content').appendChild(x);
}

function openTab(tabName) {
	var i, tabcontent, tablinks;
	tabcontent = document.getElementsByClassName("tabcontent");
	for (i = 0; i < tabcontent.length; i++) {
		tabcontent[i].style.display = "none";
		tabcontent[i].className = tabcontent[i].className.replace(" active-content", "");
	}
	tablinks = document.getElementsByClassName("tablinks");
	for (i = 0; i < tablinks.length; i++) {
		tablinks[i].className = tablinks[i].className.replace(" active", "");
	}
	document.getElementById(tabName).style.display = "block";
	document.getElementById(tabName).className += " active-content";
	document.getElementById(tabName + 'TabButton').className += " active";
}