const extensionAPI = typeof browser !== "undefined" ? browser : chrome;

function addPattern(pattern) {
    var option = document.createElement('option');
    option.innerText = pattern;
    option.setAttribute('value', pattern);
    messageMatchers.appendChild(option);
    patternInput.value = '';
}

function rmvPattern() {
    messageMatchers.options[messageMatchers.selectedIndex].remove()
}

function save_options() {
	let matchers = [];
    messageMatchers.childNodes.forEach(o => matchers.push(o.value));

	extensionAPI.storage.sync.set({
		options: {
			webhook_url: webhook_url.value.length > 0 ? webhook_url.value : '',
			webhook_scope: webhook_scope.value.length > 0 ? webhook_scope.value : '',
			webhook_listeners: webhook_listeners.checked,
			webhook_messages: webhook_messages.checked,
			detectMessagePortListeners: detectMessagePortListeners.checked,
			detectWorkerListeners: detectWorkerListeners.checked,
			detectServiceWorkerListeners: detectServiceWorkerListeners.checked,
			detectSharedWorkerListeners: detectSharedWorkerListeners.checked,
			detectBroadcastChannelListeners: detectBroadcastChannelListeners.checked,
			detectMessagePortMessages: detectMessagePortMessages.checked,
			detectWorkerMessages: detectWorkerMessages.checked,
			detectServiceWorkerMessages: detectServiceWorkerMessages.checked,
			detectSharedWorkerMessages: detectSharedWorkerMessages.checked,
			detectBoadcastChannelMessages: detectBoadcastChannelMessages.checked,
			detectBrowserStorageReflections: detectBrowserStorageReflections.checked,
			messageMatchers: matchers
		}
	}, function() {
		statusMsg.textContent = 'Options saved.';
		setTimeout(function() {
			statusMsg.textContent = '';
			window.close();
		}, 750);
	});
}

function restore_options() {
	extensionAPI.storage.sync.get({
		options: { messageMatchers: [] }
	}, function(i) {
		webhook_url.value = i.options.webhook_url || '';
		webhook_scope.value = i.options.webhook_scope || '';
		webhook_listeners.checked = i.options.webhook_listeners === undefined ? false : i.options.webhook_listeners;
		webhook_messages.checked = i.options.webhook_messages === undefined ? true : i.options.webhook_messages;
		detectMessagePortListeners.checked = i.options.detectMessagePortListeners === undefined ? true : i.options.detectMessagePortListeners;
		detectWorkerListeners.checked = i.options.detectWorkerListeners === undefined ? false : i.options.detectWorkerListeners;
		detectServiceWorkerListeners.checked = i.options.detectServiceWorkerListeners === undefined ? false : i.options.detectServiceWorkerListeners;
		detectSharedWorkerListeners.checked = i.options.detectSharedWorkerListeners === undefined ? false : i.options.detectSharedWorkerListeners;
		detectBroadcastChannelListeners.checked = i.options.detectBroadcastChannelListeners === undefined ? true : i.options.detectBroadcastChannelListeners;
		detectMessagePortMessages.checked = i.options.detectMessagePortMessages === undefined ? true : i.options.detectMessagePortMessages;
		detectWorkerMessages.checked = i.options.detectWorkerMessages === undefined ? false : i.options.detectWorkerMessages;
		detectServiceWorkerMessages.checked = i.options.detectServiceWorkerMessages === undefined ? false : i.options.detectServiceWorkerMessages;
		detectSharedWorkerMessages.checked = i.options.detectSharedWorkerMessages === undefined ? false : i.options.detectSharedWorkerMessages;
		detectBoadcastChannelMessages.checked = i.options.detectBoadcastChannelMessages === undefined ? true : i.options.detectBoadcastChannelMessages;
		detectBrowserStorageReflections.checked = i.options.detectBrowserStorageReflections === undefined ? true : i.options.detectBrowserStorageReflections;
		for (let pattern of i.options.messageMatchers) {
            addPattern(pattern)
        }
	});
}

addBtn.onclick = () => { addPattern(patternInput.value) };
rmvBtn.onclick = rmvPattern
saveBtn.onclick = save_options;

restore_options();
