function save_options() {
	chrome.storage.sync.set({
		options: {
			webhook_url: webhook_url.value.length > 0 ? webhook_url.value : '',
			webhook_scope: webhook_scope.value.length > 0 ? webhook_scope.value : '',
			webhook_listeners: webhook_listeners.checked,
			webhook_messages: webhook_messages.checked
		}
	}, function() {
		var status = document.getElementById('status');
		status.textContent = 'Options saved.';
		setTimeout(function() {
			status.textContent = '';
			window.close();
		}, 750);
	});
}

function restore_options() {
	chrome.storage.sync.get({
		options: { }
	}, function(i) {
		webhook_url.value = i.options.webhook_url || '';
		webhook_scope.value = i.options.webhook_scope || '';
		webhook_listeners.checked = i.options.webhook_listeners === undefined ? false : i.options.webhook_listeners;
		webhook_messages.checked = i.options.webhook_messages === undefined ? true : i.options.webhook_messages;
	});
}



document.addEventListener('DOMContentLoaded', function () {
	restore_options();
	document.getElementById('save').addEventListener('click', save_options);
});

