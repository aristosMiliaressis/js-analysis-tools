const extensionAPI = typeof browser !== "undefined" ? browser : chrome;

iframeTabButton.onclick = (evt) => openTab('iframe');
targetTabButton.onclick = (evt) => openTab('target');
rpoTabButton.onclick = (evt) => openTab('rpo');

extensionAPI.storage.local.get({
	options: { popup_iframe: true, popup_target: true, popup_rpo: true }
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
		doc.body.children[0].classList.remove('dom-tracker-highlight')
		if (doc.body.children[0].classList == "")
			doc.body.children[0].removeAttribute("class")

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
		
		var parser = new DOMParser()
		doc = parser.parseFromString(target.outerHTML, 'text/html');
		doc.body.children[0].classList.remove('dom-tracker-highlight')
		if (doc.body.children[0].classList == "")
			doc.body.children[0].removeAttribute("class")

		pre = document.createElement('pre');
		pre.innerHTML = hljs.highlight(
			doc.body.innerHTML,
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
	var checkbox = document.querySelector('.active-content [name=checkbox]');
	
	extensionAPI.storage.local.get({
		options: {}
	}, function (i) {	
		if (document.querySelector('#iframeTab.active-content') != null && i.options.highlight_iframe) {
			checkbox.checked = true;
		} else if (document.querySelector('#targetTab.active-content') != null && i.options.highlight_target) {
			checkbox.checked = true;
		} else if (document.querySelector('#rpoTab.active-content') != null && i.options.detect_quirks_mode) {
			checkbox.checked = true;
		}
	});
	
	checkbox.addEventListener('change', (event) => {
		extensionAPI.storage.local.get({
			options: {}
		}, function (i) {
			if (document.querySelector('#iframeTab.active-content') != null) {
				i.options.highlight_iframe = checkbox.checked;
			} else if (document.querySelector('#targetTab.active-content') != null) {
				i.options.highlight_target = checkbox.checked;
			} else if (document.querySelector('#rpoTab.active-content') != null) {
				i.options.detect_quirks_mode = checkbox.checked;
			}
			
			extensionAPI.storage.local.set(i);
			
			extensionAPI.tabs.query({ active: true, currentWindow: true }, function (tabs) {
				extensionAPI.tabs.sendMessage(tabs[0].id, 
				{ 
					highlight_iframe: i.options.highlight_iframe,
					highlight_target: i.options.highlight_target,
					detect_quirks_mode: i.options.detect_quirks_mode
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