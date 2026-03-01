const extensionAPI = typeof browser !== "undefined" ? browser : chrome;

function save_options() {
	extensionAPI.storage.sync.set({
		options: {
			webhook_url: webhook_url.value.length > 0 ? webhook_url.value : '',
			webhook_scope: webhook_scope.value.length > 0 ? webhook_scope.value : ''
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
		options: { }
	}, function(i) {
		webhook_url.value = i.options.webhook_url || '';
		webhook_scope.value = i.options.webhook_scope || '';
	});
}

saveBtn.onclick = save_options;

restore_options();
