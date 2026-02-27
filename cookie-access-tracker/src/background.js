const extensionAPI = typeof browser !== "undefined" ? browser : chrome;

var tab_data = [];

function refreshCount(tab) {
	extensionAPI.tabs.query({ active: true }, function (tabs) {
		if (tab.id != tabs[0].id) return;
		
		cookieCount = tab_data[tab.id]?.length || 0;

		if (!extensionAPI.runtime.lastError) {
			extensionAPI.action.setBadgeText({ "text": cookieCount.toString(), tabId: tab.id });
			extensionAPI.action.setBadgeBackgroundColor({ color: [255, 128, 0, 255] });
		}
	});
}

function logToWebhook(data) {
	extensionAPI.storage.local.get({
		options: { }
	}, function(i) {
		if (i.options.WebhookUrl == "" || i.options.WebhookUrl == undefined) return;
		if (new URL(data.href).origin.match(i.options.WebhookScope) == null) return;

		try {
			fetch(i.options.WebhookUrl, {
				method: 'post',
				headers: {
					"Content-type": "application/json; charset=UTF-8"
				},
				body: JSON.stringify(data)
			});
		} catch(e) { }
	});
}

extensionAPI.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
	if (msg.reset) {
		tab_data[sender.tab.id] = [];
		refreshCount(sender.tab);
		return;
	}

	if (tab_data[sender.tab.id] == undefined) tab_data[sender.tab.id] = []
	if (tab_data[sender.tab.id].some(l => l.origin == msg.origin && l.name == msg.name && l.value == msg.value)) return;

	extensionAPI.storage.local.get({
        options: { PatternBlacklist: [] }
    }, function (i) {
        for (let pattern of i.options.PatternBlacklist) {
            let re = new RegExp(pattern)
			if (re.test(msg.assignment))
				return;
        }

		tab_data[sender.tab.id].push(msg);
		logToWebhook(msg);
	
		refreshCount(sender.tab);
    });
});

extensionAPI.runtime.onConnect.addListener(function (port) {
	port.onMessage.addListener(function (msg) {
		port.postMessage(tab_data[msg.tabId]);
	});
})
