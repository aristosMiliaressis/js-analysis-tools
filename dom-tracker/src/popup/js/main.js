const extensionAPI = typeof browser !== "undefined" ? browser : chrome;

iframeTabButton.onclick = (evt) => openTab('iframe');
targetTabButton.onclick = (evt) => openTab('target');
rpoTabButton.onclick = (evt) => openTab('rpo');

extensionAPI.storage.sync.get({
	options: {}
}, function (i) {
	if (!i.options.popup_iframe) iframeTabButton.style.display = "none";
	if (!i.options.popup_target) targetTabButton.style.display = "none";
	if (!i.options.popup_rpo) rpoTabButton.style.display = "none";
});

let data = {};
var port = extensionAPI.runtime.connect({ name: "Extension MessageChannel" });

port.onMessage.addListener(function (msg) {
	data = msg;
	openTab('iframe');
});

extensionAPI.tabs.query({ active: true, currentWindow: true }, function (tabs) {
	port.postMessage({ tabId: tabs[0].id });
});

function listElements() {
	var x = document.createElement('ol');
	x.id = 'x';

	for (let frame of data.frames) {
		if (!iframeTab.classList.contains('active-content'))
			continue;

		iframeTab.querySelectorAll('ol').forEach(e => e.remove());

		el = document.createElement('li');

		bel = document.createElement('b');
		br = document.createElement('br');
		bel.innerText = frame.url.href;
		win = document.createElement('code');
		win.innerText = frame.path;
		el.appendChild(bel);
		el.appendChild(br);
		el.appendChild(win);

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

		pre = document.createElement('pre');
		pre.innerHTML = hljs.highlight(
			doc.body.innerHTML,
			{ language: 'html', ignoreIllegals: true }
		).value;
		el.appendChild(pre);

		x.appendChild(el);
	}

	for (let target of data.targets) {
		if (!targetTab.classList.contains('active-content'))
			continue;

		targetTab.querySelectorAll('ol').forEach(e => e.remove());

		el = document.createElement('li');

		bel = document.createElement('b');
		br = document.createElement('br');
		bel.innerText = target.url.href;
		win = document.createElement('code');
		win.innerText = target.path;
		el.appendChild(bel);
		el.appendChild(br);
		el.appendChild(win);

		pre = document.createElement('pre');
		pre.innerHTML = hljs.highlight(
			target.outerHTML,
			{ language: 'html', ignoreIllegals: true }
		).value;
		el.appendChild(pre);

		x.appendChild(el);
	}

	for (let rpo of data.rpo) {
		if (!rpoTab.classList.contains('active-content'))
			continue;

		rpoTab.querySelectorAll('ol').forEach(e => e.remove());

		el = document.createElement('li');

		bel = document.createElement('b');
		br = document.createElement('br');
		bel.innerText = rpo.url.href;
		win = document.createElement('code');
		win.innerText = rpo.path;
		el.appendChild(bel);
		el.appendChild(br);
		el.appendChild(win);

		pre = document.createElement('pre');
		pre.innerHTML = hljs.highlight(
			rpo.outerHTML,
			{ language: 'html', ignoreIllegals: true }
		).value;
		el.appendChild(pre);

		x.appendChild(el);
	}

	document.querySelector('.active-content').appendChild(x);
}

function setupElementHighlightCheckbox() {
	var highlightCb = document.querySelector('.active-content [name=highlight]');
	
	extensionAPI.storage.sync.get({
		options: {}
	}, function (i) {	
		if (document.querySelector('#iframeTab.active-content') != null && i.options.highlight_iframe) {
			highlightCb.checked = true;
		} else if (document.querySelector('#targetTab.active-content') != null && i.options.highlight_target) {
			highlightCb.checked = true;
		} else if (document.querySelector('#rpoTab.active-content') != null && i.options.highlight_rpo) {
			highlightCb.checked = true;
		}
	});
	
	highlightCb.addEventListener('change', (event) => {
		extensionAPI.storage.sync.get({
			options: {}
		}, function (i) {
			if (document.querySelector('#iframeTab.active-content') != null) {
				i.options.highlight_iframe = highlightCb.checked;
			} else if (document.querySelector('#targetTab.active-content') != null) {
				i.options.highlight_target = highlightCb.checked;
			} else if (document.querySelector('#rpoTab.active-content') != null) {
				i.options.highlight_rpo = highlightCb.checked;
			}
			
			extensionAPI.storage.sync.set(i);
			
			extensionAPI.tabs.query({ active: true, currentWindow: true }, function (tabs) {
				extensionAPI.tabs.sendMessage(tabs[0].id, 
				{ 
					highlight_iframe: i.options.highlight_iframe,
					highlight_target: i.options.highlight_target,
					highlight_rpo: i.options.highlight_rpo
				});
			});
		});
	});
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
	document.getElementById(tabName + 'Tab').style.display = "block";
	document.getElementById(tabName + 'Tab').className += " active-content";
	document.getElementById(tabName + 'TabButton').className += " active";

	setupElementHighlightCheckbox();
	listElements();
}