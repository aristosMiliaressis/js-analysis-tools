
document.addEventListener('cookieAccessTracker', function (event) {
	chrome.runtime.sendMessage(event.detail);
});

//we use this to separate fragment changes with location changes
window.addEventListener('beforeunload', function (event) {
	var storeEvent = new CustomEvent('cookieAccessTracker', { 'detail': { reset: true } });
	document.dispatchEvent(storeEvent);
});
