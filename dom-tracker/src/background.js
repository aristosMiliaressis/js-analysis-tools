const extensionAPI = typeof browser !== "undefined" ? browser : chrome;

var tab_data = {};

function refreshCount(tab) {
	extensionAPI.tabs.query({ active: true }, function (tabs) {
		if (tab.id != tabs[0].id) return;
		
		let badgeCounters = Array();
		frameCount = tab_data[tab.id]?.frames ? tab_data[tab.id].frames.length : 0;
		targetCount = tab_data[tab.id]?.targets ? tab_data[tab.id].targets.length : 0;
		rpoCount = tab_data[tab.id]?.rpo ? tab_data[tab.id].rpo.length : 0;

		extensionAPI.storage.local.get({
			options: { popup_iframe: true, popup_target: true, popup_rpo: true }
		}, function (i) {
			if (i.options.popup_iframe) badgeCounters.push(frameCount);
			if (i.options.popup_target) badgeCounters.push(targetCount);
			if (i.options.popup_rpo) badgeCounters.push(rpoCount);

			if (!extensionAPI.runtime.lastError) {
				extensionAPI.action.setBadgeText({ "text": badgeCounters.join(':'), tabId: tab.id });
				extensionAPI.action.setBadgeBackgroundColor({ color: [255, 255, 0, 255] });
			}
		});
	}).then(()=>{});
}

function logToWebhook(msg) {
	extensionAPI.storage.local.get({
		options: {}
	}, function (i) {
		if (i.options.webhook_url == "" || i.options.webhook_url == undefined) return;
		if (!i.options.webhook_iframe) msg.iframes = undefined;
		if (!i.options.webhook_target) msg.targets = undefined;
		if (!i.options.webhook_rpo) msg.rpo = undefined;
		if (!i.options.webhook_dom) msg.dom = undefined;
		if (!i.options.webhook_local_storage) msg.localStorage = undefined;
		if (!i.options.webhook_session_storage) msg.sessionStorage = undefined;
		if (!i.options.webhook_cookies) msg.cookies = undefined;

		var data = JSON.stringify(msg);
		try {
			fetch(i.options.webhook_url, {
				method: 'post',
				headers: {
					"Content-type": "application/json; charset=UTF-8"
				},
				body: data
			});
		} catch (e) { }
	});
}

extensionAPI.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
	if (msg.reset) {
		logToWebhook(tab_data[sender.tab.id])
		tab_data[sender.tab.id] = { frames: [], targets: [], rpo: [] };
		refreshCount(sender.tab);
		return
	}

	if (tab_data[sender.tab.id] == undefined) {
		tab_data[sender.tab.id] = { frames: [], targets: [], rpo: [] };
	}

	knownFrames = Object.assign({}, ...tab_data[sender.tab.id].frames.map((f) => ({ [f.path + ':' + f.url.href]: f })));
	currentFrames = Object.assign({}, ...msg.frames.map((f) => ({ [f.path + ':' + f.url.href]: f })));

	knownTargets = Object.assign({}, ...tab_data[sender.tab.id].targets.map((f) => ({ [f.path + ':' + f.url.href]: f })));
	currentTargets = Object.assign({}, ...msg.targets.map((f) => ({ [f.path + ':' + f.url.href]: f })));

	knownRPO = Object.assign({}, ...tab_data[sender.tab.id].rpo.map((f) => ({ [f.path + ':' + f.url.href]: f })));
	currentRPO = Object.assign({}, ...msg.rpo.map((f) => ({ [f.path + ':' + f.url.href]: f })));

	tab_data[sender.tab.id].frames = Object.values(Object.assign({}, knownFrames, currentFrames));
	tab_data[sender.tab.id].targets = Object.values(Object.assign({}, knownTargets, currentTargets));
	tab_data[sender.tab.id].rpo = Object.values(Object.assign({}, knownRPO, currentRPO));
	tab_data[sender.tab.id].dom = msg.dom;
	tab_data[sender.tab.id].location = msg.location;
	tab_data[sender.tab.id].localStorage = msg.localStorage;
	tab_data[sender.tab.id].sessionStorage = msg.sessionStorage;
	tab_data[sender.tab.id].cookies = msg.cookies;

	refreshCount(sender.tab);
});

extensionAPI.tabs.onUpdated.addListener(function (tabId, props) {
	if (props.status == "complete") {
		extensionAPI.tabs.get(tabId, function (tab) {
			refreshCount(tab);
			
			extensionAPI.storage.local.get({
				options: {}
			}, function (i) {
				extensionAPI.tabs.sendMessage(tabId, 
				{ 
					highlight_iframe: i.options.highlight_iframe,
					highlight_target: i.options.highlight_target,
					detect_quirks_mode: i.options.detect_quirks_mode
				});
			});
		});
	}
});

extensionAPI.runtime.onConnect.addListener(function (port) {
	port.onMessage.addListener(function (msg) {
		port.postMessage(tab_data[msg.tabId]);
	});
})
