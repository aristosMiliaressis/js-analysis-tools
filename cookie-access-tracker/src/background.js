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

extensionAPI.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
	if (msg.reset) {
		tab_data[sender.tab.id] = [];
		refreshCount(sender.tab);
		return;
	}

	if (tab_data[sender.tab.id].some(l => l.hops == msg.hops && l.value.split('=')[0] == msg.value.split('=')[0])) return;

	extensionAPI.storage.local.get({
        options: { PatternBlacklist: [] }
    }, function (i) {
        for (let pattern of i.options.PatternBlacklist) {
            let re = new RegExp(pattern)
			if (re.test(msg.value))
				return;
        }

		tab_data[sender.tab.id].push(msg);
	
		refreshCount(sender.tab);
    });
});

extensionAPI.runtime.onConnect.addListener(function (port) {
	port.onMessage.addListener(function (msg) {
		port.postMessage(tab_data[msg.tabId]);
	});
})
