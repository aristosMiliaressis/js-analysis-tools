const extensionAPI = typeof browser !== "undefined" ? browser : chrome;

document.addEventListener('cookieAccessTracker', function (event) {
	extensionAPI.runtime.sendMessage(event.detail);
});
