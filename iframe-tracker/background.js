var page_frames = {};

function refreshCount(origin) {
	count = page_frames[origin] ? page_frames[origin].length : 0;
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
		if (localStorage.getItem('iframe-tracker-highlight') == 'true') {
			chrome.tabs.sendMessage(tabs[0].id, {highlight: true}, function(response) {});
		}
		if (!chrome.runtime.lastError) {
			chrome.browserAction.setBadgeText({"text": ''+count, tabId: tabs[0].id});
			if (count > 0) {
				chrome.browserAction.setBadgeBackgroundColor({ color: [0, 255, 0, 255]});
			} else {
				chrome.browserAction.setBadgeBackgroundColor({ color: [0, 0, 255, 0] });
			}
		}
	});
}

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
	if (!page_frames[msg.origin]) {
		page_frames[msg.origin] = [];
	}
	
	knownFrames = Object.assign({}, ...page_frames[msg.origin].map((f) => ({[f.path+':'+f.url]: f})));
	currentFrames = Object.assign({}, ...msg.frames.map((f) => ({[f.path+':'+f.url]: f})));
	mergedFrames = Object.values(Object.assign({}, knownFrames, currentFrames));
	
	page_frames[msg.origin] = mergedFrames;

	refreshCount(msg.origin);
});

chrome.tabs.onUpdated.addListener(function(tabId, props) {
	if (props.status == "complete") {
		chrome.tabs.get(tabId, function(tab) {
			refreshCount(new URL(tab.url).origin);
		});
	}
});

chrome.tabs.onActivated.addListener(function(activeInfo) {
	chrome.tabs.get(activeInfo.tabId, function(tab) {
		refreshCount(new URL(tab.url).origin);
	});
});

chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
	chrome.tabs.get(tabs[0].id, function(tab) {
		refreshCount(new URL(tab.url).origin);
	});
});

chrome.extension.onConnect.addListener(function(port) {
	port.onMessage.addListener(function(msg) {
		port.postMessage({frames:page_frames[msg.origin]});
	});
})