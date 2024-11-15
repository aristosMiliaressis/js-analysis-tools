function save_options() {
    var log_url = document.getElementById('log-url').value;
    var popup_iframe = document.getElementById('popup_iframe').checked;
    var popup_form = document.getElementById('popup_form').checked;
    var popup_anchor = document.getElementById('popup_anchor').checked;
    var popup_button = document.getElementById('popup_button').checked;
    var popup_base = document.getElementById('popup_base').checked;
    var webhook_iframe = document.getElementById('webhook_iframe').checked;
    var webhook_form = document.getElementById('webhook_form').checked;
    var webhook_anchor = document.getElementById('webhook_anchor').checked;
    var webhook_button = document.getElementById('webhook_button').checked;
    var webhook_base = document.getElementById('webhook_base').checked;
    chrome.storage.sync.set({
        options: {
            log_url: log_url.length > 0 ? log_url : '',
            popup_iframe: popup_iframe,
            popup_form: popup_form,
            popup_anchor: popup_anchor,
            popup_button: popup_button,
            popup_base: popup_base,
            webhook_iframe: webhook_iframe,
            webhook_form: webhook_form,
            webhook_anchor: webhook_anchor,
            webhook_button: webhook_button,
            webhook_base: webhook_base,
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
        document.getElementById('popup_form').checked = i.options.popup_form;
        document.getElementById('popup_anchor').checked = i.options.popup_anchor;
        document.getElementById('popup_button').checked = i.options.popup_button;
        document.getElementById('popup_base').checked = i.options.popup_base;
        document.getElementById('webhook_iframe').checked = i.options.webhook_iframe === undefined ? true : i.options.webhook_iframe;
        document.getElementById('webhook_form').checked = i.options.webhook_form === undefined ? true : i.options.webhook_form;
        document.getElementById('webhook_anchor').checked = i.options.webhook_anchor === undefined ? true : i.options.webhook_anchor;
        document.getElementById('webhook_button').checked = i.options.webhook_button === undefined ? true : i.options.webhook_button;
        document.getElementById('webhook_base').checked = i.options.webhook_base === undefined ? true : i.options.webhook_base;
    });
}

document.addEventListener('DOMContentLoaded', function () {
    restore_options();
    document.getElementById('save').addEventListener('click', save_options);
});
