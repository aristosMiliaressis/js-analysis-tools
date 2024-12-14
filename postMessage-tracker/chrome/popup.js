var port = chrome.extension.connect({
	name: "Sample Communication"
});


function loaded() {
	port.postMessage("get-stuff");
	port.onMessage.addListener(function(msg) {
		chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
			selectedId = tabs[0].id;
			listListeners(msg.listeners[selectedId]);
		});
	});
}

window.onload = loaded
//addEventListener('DOMContentLoaded', loaded);

function listListeners(listeners) {
	var x = document.getElementById('x');
	x.parentElement.removeChild(x);
	x = document.createElement('ol');
	x.id = 'x';
	//console.log(listeners);
	document.getElementById('h').innerText = listeners.length ? listeners[0].parent_url : '';

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
	document.getElementById('content').appendChild(x);
	/*setTimeout(function() {
		document.body.style.display = 'block';
	}, 150);*/
}