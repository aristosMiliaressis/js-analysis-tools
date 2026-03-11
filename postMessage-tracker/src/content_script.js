const extensionAPI = typeof browser !== "undefined" ? browser : chrome;

document.addEventListener('postMessageTracker:data', function (event) {
	extensionAPI.runtime.sendMessage(event.detail);
});

document.addEventListener('postMessageTracker:init', function (_) {
  extensionAPI.storage.sync.get(null, function(config) {
		document.dispatchEvent(new CustomEvent("postMessageTracker:conf", { detail: config }));
	});
});