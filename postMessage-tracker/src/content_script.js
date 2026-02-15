const extensionAPI = typeof browser !== "undefined" ? browser : chrome;

document.addEventListener('postMessageTracker', function (event) {
	extensionAPI.runtime.sendMessage(event.detail);
});

//we use this to separate fragment changes with location changes
window.addEventListener('beforeunload', function (event) {
	var storeEvent = new CustomEvent('postMessageTracker', { 'detail': { changePage: true } });
	document.dispatchEvent(storeEvent);
});
