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
		for (let pattern of i.options.messageMatchers) {
            addPattern(pattern)
        }
	});
}

addBtn.onclick = () => { addPattern(patternInput.value) };
rmvBtn.onclick = rmvPattern
saveBtn.onclick = save_options;

restore_options();
