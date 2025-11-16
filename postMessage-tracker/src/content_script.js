
document.addEventListener('postMessageTracker', function (event) {
	chrome.runtime.sendMessage(event.detail);
});

//we use this to separate fragment changes with location changes
window.addEventListener('beforeunload', function (event) {
	var storeEvent = new CustomEvent('postMessageTracker', { 'detail': { changePage: true } });
	document.dispatchEvent(storeEvent);
});
