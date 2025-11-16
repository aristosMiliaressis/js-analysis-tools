var tab_listeners = {};
var tab_messages = {};
var tab_push = {}, tab_lasturl = {};
var selectedId = -1;

function refreshCount() {
	listenerCount = tab_listeners[selectedId] ? tab_listeners[selectedId].length : 0;
	messageCount = tab_messages[selectedId] ? tab_messages[selectedId].length : 0;
	chrome.tabs.get(selectedId, function() {
		if (!chrome.runtime.lastError) {
			chrome.action.setBadgeText({"text": listenerCount+':'+messageCount, tabId: selectedId});
			if(listenerCount > 0) {
				chrome.action.setBadgeBackgroundColor({ color: [255, 0, 0, 255]});
			} else {
				chrome.action.setBadgeBackgroundColor({ color: [0, 0, 255, 0] });
			}
		}
	});
}

function logToWebhook(data) {
	chrome.storage.sync.get({
		options: { }
	}, function(i) {
		if (i.options.webhook_url == "" || i.options.webhook_url == undefined) return;
		if (new URL(data.parent_url).origin.match(i.options.webhook_scope) == null) return;

		if (!i.options.webhook_listeners && data.listener != undefined) return;
		if (!i.options.webhook_messages && data.message != undefined) return;

		data = JSON.stringify(data);
		try {
			fetch(i.options.webhook_url, {
				method: 'post',
				headers: {
					"Content-type": "application/json; charset=UTF-8"
				},
				body: data
			});
		} catch(e) { }
	});
}

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
	tabId = sender.tab.id;
	if(msg.listener) {
		if(msg.listener == 'function () { [native code] }') return;
		msg.parent_url = sender.tab.url;

		if(!tab_listeners[tabId]) tab_listeners[tabId] = [];
		if (tab_listeners[tabId].some(l => l.hops == msg.hops && l.stack == msg.stack)) return;
		tab_listeners[tabId][tab_listeners[tabId].length] = msg;

		logToWebhook(msg);
	} else if (msg.message) {
		msg.parent_url = sender.tab.url;

		if(!tab_messages[tabId]) tab_messages[tabId] = [];
		if (isInterestingMessage(msg))
			tab_messages[tabId][tab_messages[tabId].length] = msg;

		logToWebhook(msg);
	}

	if (msg.pushState) {
		tab_push[tabId] = true;
		tab_listeners[tabId] = [];
		tab_messages[tabId] = [];
	}

	if(msg.changePage) {
		delete tab_lasturl[tabId];
		tab_listeners[tabId] = [];
		tab_messages[tabId] = [];
	}

	if(msg.log) {
		console.log(msg.log);
	} else {
		refreshCount();
	}
});

function isInterestingMessage(msg) {
	msg.matches = {};

	const data = msg.message.split(':').slice(3).join(':');
	const uuidRegex = /[a-f0-9]{8}\-[a-f0-9]{4}\-[a-f0-9]{4}\-[a-f0-9]{4}\-[a-f0-9]{12}/ig;
	const urlWithParamsRegex = /(https?|wss?):\/\/[a-z0-9_\-\.]+\/[a-z0-9_\/%\-\.]*[\?#]/ig;
	const blobUrlRegex = /blob:[a-z0-9_\-\.]+/ig;
	const currentHrefRegex = RegExp(RegExp.escape(msg.href), "ig");
	const htmlTagRegex = /(<\/[a-z]+>|<[a-z]+ )/ig;


	data.matchAll(uuidRegex).toArray().forEach(match => msg.matches[data.indexOf(match[0])] = match[0])
	data.matchAll(urlWithParamsRegex).toArray().forEach(match => msg.matches[data.indexOf(match[0])] = match[0])
	data.matchAll(blobUrlRegex).toArray().forEach(match => msg.matches[data.indexOf(match[0])] = match[0])
	data.matchAll(currentHrefRegex).toArray().forEach(match => msg.matches[cdata.indexOf(match[0])] = match[0])
	data.matchAll(htmlTagRegex).toArray().forEach(match => msg.matches[data.indexOf(match[0])] = match[0])
    
	for (value of [...msg.cookie.split(';').map(c => c.split('=')[1]),
					...msg.localStorage,
					...msg.sessionStorage]) {
		if (!value) continue;

		let regex = RegExp(RegExp.escape(value), "ig");
		if (value.length >= 12)
			data.matchAll(regex).toArray().forEach(match => msg.matches[data.indexOf(match[0])] = match[0])
	}
	
	return Object.keys(msg.matches).length > 0;
}

chrome.tabs.onUpdated.addListener(function(tabId, props) {
	if (props.status == "complete") {
		if(tabId == selectedId) refreshCount();
	} else if(props.status) {
		if(tab_push[tabId]) {
			//this was a pushState, ignore
			delete tab_push[tabId];
		} else {
			//if(props.url && tab_lasturl[tabId] && props.url.split('#')[0] == tab_lasturl[tabId]) {
				//same url as before, only a hash change, ignore
			//} else 
			if(!tab_lasturl[tabId]) {
				//wipe on other statuses, but only if lastpage is not set (aka, changePage did not run)
				tab_listeners[tabId] = [];
				tab_messages[tabId] = [];
			}
		}
	}
	if(props.status == "loading")
		tab_lasturl[tabId] = true;
});

chrome.tabs.onActivated.addListener(function(activeInfo) {
	selectedId = activeInfo.tabId;
	refreshCount();
});

chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
	selectedId = tabs[0].id;
	refreshCount();
});

chrome.runtime.onConnect.addListener(function(port) {
	port.onMessage.addListener(function(msg) {
		port.postMessage({listeners:tab_listeners, messages:tab_messages});
	});
})