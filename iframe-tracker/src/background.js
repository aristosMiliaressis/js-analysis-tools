var tab_frames = {};
var tab_dom = {};

function refreshCount(tab) {
	count = tab_frames[tab.id] ? tab_frames[tab.id].length : 0;

	if (localStorage.getItem('iframe-tracker-highlight') == 'true') {
		chrome.tabs.sendMessage(tab.id, { highlight: true }, function (response) { });
	}
	if (!chrome.runtime.lastError) {
		chrome.browserAction.setBadgeText({ "text": '' + count, tabId: tab.id });
		if (count > 0) {
			chrome.browserAction.setBadgeBackgroundColor({ color: [0, 255, 0, 255] });
		} else {
			chrome.browserAction.setBadgeBackgroundColor({ color: [0, 0, 0, 0] });
		}
	}
}

function logListener(msg) {
	chrome.storage.sync.get({
		options: ''
	}, function (i) {
		log_url = i.options.log_url;
		if (!log_url.length) return;

		var data = JSON.stringify(msg);
		try {
			fetch(log_url, {
				method: 'post',
				headers: {
					"Content-type": "application/json; charset=UTF-8"
				},
				body: data
			});
		} catch (e) { }
	});
}

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
	if (msg.reset) {
		logListener({ iframes: tab_frames[sender.tab.id] })
		logListener(tab_dom[sender.tab.id])
		tab_frames[sender.tab.id] = [];
		refreshCount(sender.tab);
		return
	}

	if (!tab_frames[sender.tab.id]) {
		tab_frames[sender.tab.id] = [];
		tab_dom[sender.tab.id] = [];
	}

	knownFrames = Object.assign({}, ...tab_frames[sender.tab.id].map((f) => ({ [f.path + ':' + f.url.href]: f })));
	currentFrames = Object.assign({}, ...msg.frames.map((f) => ({ [f.path + ':' + f.url.href]: f })));
	mergedFrames = Object.values(Object.assign({}, knownFrames, currentFrames));

	tab_frames[sender.tab.id] = mergedFrames;
	tab_dom[sender.tab.id] = { dom: msg.dom, path: msg.path };

	refreshCount(sender.tab);
});

chrome.tabs.onUpdated.addListener(function (tabId, props) {
	if (props.status == "complete") {
		chrome.tabs.get(tabId, function (tab) {
			refreshCount(tab);
		});
	}
});

chrome.tabs.onActivated.addListener(function (activeInfo) {
	chrome.tabs.get(activeInfo.tabId, function (tab) {
		tab_frames[tab.id] = [];
		refreshCount(tab);
	});
});

chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
	chrome.tabs.get(tabs[0].id, function (tab) {
		refreshCount(tab);
	});
});

chrome.extension.onConnect.addListener(function (port) {
	port.onMessage.addListener(function (msg) {
		port.postMessage({ frames: tab_frames[msg.tabId] });
	});
})
