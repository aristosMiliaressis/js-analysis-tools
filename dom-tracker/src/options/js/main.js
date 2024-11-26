const extensionAPI = typeof browser !== "undefined" ? browser : chrome;

function save_options() {
    extensionAPI.storage.sync.set({
        options: {
            webhook_url: webhook_url.value.length > 0 ? webhook_url.value : '',
            popup_iframe: popup_iframe.checked,
            popup_target: popup_target.checked,
            popup_rpo: popup_rpo.checked,
            webhook_iframe: webhook_iframe.checked,
            webhook_target: webhook_target.checked,
            webhook_rpo: webhook_rpo.checked,
            webhook_dom: webhook_dom.checked,
        }
    }, function () {
        statusMsg.textContent = 'Options saved.';
        setTimeout(function () {
            window.close();
        }, 750);
    });
}

function restore_options() {
    extensionAPI.storage.sync.get({
        options: {}
    }, function (i) {
        webhook_url.value = i.options.webhook_url || '';
        popup_iframe.checked = i.options.popup_iframe === undefined ? true : i.options.popup_iframe;
        popup_target.checked = i.options.popup_target === undefined ? true : i.options.popup_target;
        popup_rpo.checked = i.options.popup_rpo === undefined ? true : i.options.popup_rpo;
        webhook_iframe.checked = i.options.webhook_iframe === undefined ? false : i.options.webhook_iframe;
        webhook_target.checked = i.options.webhook_target === undefined ? false : i.options.webhook_target;
        webhook_rpo.checked = i.options.webhook_rpo === undefined ? false : i.options.webhook_rpo;
        webhook_dom.checked = i.options.webhook_dom === undefined ? true : i.options.webhook_dom;
    });
}

restore_options();

save.onclick = save_options;
