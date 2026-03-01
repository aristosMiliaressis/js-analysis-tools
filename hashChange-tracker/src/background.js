const extensionAPI = typeof browser !== "undefined" ? browser : chrome;

var tab_listeners = {};
var tab_push = {}, tab_lasturl = {};
var selectedId = -1;

function refreshCount() {
	txt = tab_listeners[selectedId] ? tab_listeners[selectedId].length : 0;
	extensionAPI.tabs.get(selectedId, function() {
		if (!extensionAPI.runtime.lastError) {
			extensionAPI.action.setBadgeText({"text": ''+txt, tabId: selectedId});
			if(txt > 0) {
				extensionAPI.action.setBadgeBackgroundColor({ color: [0, 255, 0, 255]});
			} else {
				extensionAPI.action.setBadgeBackgroundColor({ color: [0, 0, 255, 0] });
			}
		}
	});
}

function logToWebhook(data) {
	extensionAPI.storage.sync.get({
		options: { }
	}, function(i) {
		if (i.options.webhook_url == "" || i.options.webhook_url == undefined) return;
		if (new URL(data.href).origin.match(i.options.webhook_scope) == null) return;

		try {
			fetch(i.options.webhook_url, {
				method: 'post',
				headers: {
					"Content-type": "application/json; charset=UTF-8"
				},
				body: JSON.stringify({ ext: 'hashChange-tracker', data: data})
			});
		} catch(e) { }
	});
}

extensionAPI.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
	tabId = sender.tab.id;
	if(msg.listener) {
		if(msg.listener == 'function () { [native code] }') return;
		msg.href = sender.tab.url;
		logToWebhook(msg)

		if(!tab_listeners[tabId]) tab_listeners[tabId] = [];
		if (tab_listeners[tabId].some(l => l.hops == msg.hops && l.stack == msg.stack)) return;
		tab_listeners[tabId][tab_listeners[tabId].length] = msg;
	}

	if(msg.pushState) {
		tab_push[tabId] = true;
		tab_listeners[tabId] = [];
	}
	if(msg.changePage) {
		delete tab_lasturl[tabId];
		tab_listeners[tabId] = [];
	}

	if(msg.log) {
		console.log(msg.log);
	} else {
		refreshCount();
	}
});

extensionAPI.tabs.onUpdated.addListener(function(tabId, props) {
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
			}
		}
	}
	if(props.status == "loading")
		tab_lasturl[tabId] = true;
});

extensionAPI.tabs.onActivated.addListener(function(activeInfo) {
	selectedId = activeInfo.tabId;
	refreshCount();
});

extensionAPI.tabs.query({active: true, currentWindow: true}, function(tabs) {
	selectedId = tabs[0].id;
	refreshCount();
});

extensionAPI.runtime.onConnect.addListener(function(port) {
	port.onMessage.addListener(function(msg) {
		port.postMessage({listeners:tab_listeners});
	});
})