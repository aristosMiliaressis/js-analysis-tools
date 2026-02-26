const extensionAPI = typeof browser !== "undefined" ? browser : chrome;

let data = {};
let port = extensionAPI.runtime.connect({ name: "Sample Communication" });

listenersTabButton.onclick = async (evt) => await openTab('listeners');
messagesTabButton.onclick = async (evt) => await openTab('messages');

port.postMessage("get-stuff");
port.onMessage.addListener(async (msg) => {
	extensionAPI.tabs.query({active: true, currentWindow: true}, async (tabs) => {
		selectedId = tabs[0].id;
		data.listeners = msg.listeners[selectedId];
        data.messages = msg.messages[selectedId];
        await openTab('listeners');
	});
});

async function openTab(tabName) {
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

	await populatePopupData();
}

async function populatePopupData() {
  	const MAX_URL_LENGTH = 200;
	let x = document.createElement('ul');
	x.id = 'x';

	listenersTabButton.innerText = `LISTENERS (${data.listeners.length})`;
	messagesTabButton.innerText = `MESSAGES (${data.messages.length})`;

	for (let listener of data.listeners.reverse()) {
		if (!listenersTab.classList.contains('active-content'))
			continue;

		listenersTab.querySelectorAll('ul').forEach(e => e.remove());

		element = document.createElement('li');

		bel = document.createElement('b');
		bel.innerText = listener.domain + ' ';
		br = document.createElement('br');
		win = document.createElement('code');
		win.innerText = `${listener.hops} ${listener.window == '' ? '' : ' window.name: ' + listener.window}`;
		element.appendChild(bel);
		element.appendChild(win);
		element.appendChild(br);

		sel = document.createElement('span');
		if(listener.fullstack) { 
            sel.setAttribute('title', listener.fullstack.join("\n\n"));
            sel.onclick = async () => { await navigator.clipboard.writeText( listener.fullstack.join("\n\n"))};
        }
		seltxt = document.createTextNode(listener.stack);

		sel.appendChild(seltxt);
		element.appendChild(sel);

		pre = document.createElement('pre');
		pre.innerHTML = hljs.highlight(
			listener.listener,
			{ language: 'javascript' }
		  ).value;
		element.appendChild(pre);

		x.appendChild(element);
	}

	for (let message of data.messages.reverse()) {
		if (!messagesTab.classList.contains('active-content'))
			continue;

	 	messagesTab.querySelectorAll('ul').forEach(e => e.remove());

	 	element = document.createElement('li');

	 	url = document.createElement('b');
	 	url.innerText = message.href.substring(0, MAX_URL_LENGTH);
		url.setAttribute('title', message.href);
		url.onclick = async () => { await navigator.clipboard.writeText(message.href)};
		src = document.createElement('code');
		dst = document.createElement('code');
		src.innerText = "source: " + message.source;
		dst.innerText = "target: " + message.destination;
		element.appendChild(url);
		element.appendChild(document.createElement('br'));
        element.appendChild(src);
        element.appendChild(document.createElement('br'));
        element.appendChild(dst);

		pre = document.createElement('pre');
        let text = typeof message.message.data == 'string' ? message.message.data : JSON.stringify(message.message.data);
        for (match of Object.values(message.matches)) {
            pre.innerHTML += text.substring(0, text.indexOf(match)).replaceAll("<", "&lt;");
            pre.innerHTML += `<b style="color:red">${match.replaceAll("<", "&lt;")}</b>`;
            text = text.substring(text.indexOf(match)+match.length);
        }
        pre.innerHTML += text.replaceAll("<", "&lt;");

		element.appendChild(pre);

		x.appendChild(element);
	}

    document.querySelector('.active-content').innerHTML = '';
	document.querySelector('.active-content').appendChild(x);
}