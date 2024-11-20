function save_options() {
    var log_url = document.getElementById('log-url').value;
    var popup_iframe = document.getElementById('popup_iframe').checked;
    var popup_target = document.getElementById('popup_target').checked;
    var popup_rpo = document.getElementById('popup_rpo').checked;
    var webhook_iframe = document.getElementById('webhook_iframe').checked;
    var webhook_target = document.getElementById('webhook_target').checked;
    var webhook_rpo = document.getElementById('webhook_rpo').checked;
    var webhook_dom = document.getElementById('webhook_dom').checked;
    chrome.storage.sync.set({
        options: {
            log_url: log_url.length > 0 ? log_url : '',
            popup_iframe: popup_iframe,
            popup_target: popup_target,
            popup_rpo: popup_rpo,
            webhook_iframe: webhook_iframe,
            webhook_target: webhook_target,
            webhook_rpo: webhook_rpo,
            webhook_dom: webhook_dom,
        }
    }, function () {
        var status = document.getElementById('status');
        status.textContent = 'Options saved.';
        setTimeout(function () {
            status.textContent = '';
            window.close();
        }, 750);
    });
}

function restore_options() {
    chrome.storage.sync.get({
        options: {}
    }, function (i) {
        document.getElementById('log-url').value = i.options.log_url || '';
        document.getElementById('popup_iframe').checked = i.options.popup_iframe === undefined ? true : i.options.popup_iframe;
        document.getElementById('popup_target').checked = i.options.popup_target === undefined ? true : i.options.popup_target;
        document.getElementById('popup_rpo').checked = i.options.popup_rpo === undefined ? true : i.options.popup_rpo;
        document.getElementById('webhook_iframe').checked = i.options.webhook_iframe === undefined ? true : i.options.webhook_iframe;
        document.getElementById('webhook_target').checked = i.options.webhook_target === undefined ? true : i.options.webhook_target;
        document.getElementById('webhook_rpo').checked = i.options.webhook_rpo === undefined ? true : i.options.webhook_rpo;
        document.getElementById('webhook_dom').checked = i.options.webhook_dom === undefined ? true : i.options.webhook_dom;
    });
}

document.addEventListener('DOMContentLoaded', function () {
    restore_options();
    document.getElementById('save').addEventListener('click', save_options);
});
