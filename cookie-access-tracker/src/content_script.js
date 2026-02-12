
document.addEventListener('cookieAccessTracker', function (event) {
	chrome.runtime.sendMessage(event.detail);
});
