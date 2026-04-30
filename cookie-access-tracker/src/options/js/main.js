const extensionAPI = typeof browser !== "undefined" ? browser : chrome;

function addPattern(pattern) {
    var option = document.createElement('option');
    option.innerText = pattern;
    option.setAttribute('value', pattern);
    patternBlacklist.appendChild(option);
    patternInput.value = '';
}

function rmvPattern() {
    patternBlacklist.options[patternBlacklist.selectedIndex].remove()
}

function save_options() {
    let blacklist = [];
    patternBlacklist.childNodes.forEach(o => blacklist.push(o.value));

    extensionAPI.storage.local.set({
        PatternBlacklist: blacklist, WebhookScope: webhook_scope.value, WebhookUrl: webhook_url.value
    }, function () {
        statusMsg.textContent = 'Options saved.';
        setTimeout(function () {
            window.close();
        }, 750);
    });
}

function restore_options() {
    extensionAPI.storage.local.get(null, function (i) {
        webhook_scope.value = i.WebhookScope;
        webhook_url.value = i.WebhookUrl;
        for (let pattern of i.PatternBlacklist ?? []) {
            addPattern(pattern)
        }
    });
}

addBtn.onclick = () => { addPattern(patternInput.value) };
rmvBtn.onclick = rmvPattern
saveBtn.onclick = save_options;

restore_options();
