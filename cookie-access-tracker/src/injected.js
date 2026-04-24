const extensionAPI = typeof browser !== "undefined" ? browser : chrome;

var isInteger = /^[\d]+$/
var isFloat = /^[\d]+\.[\d]+$/
var isUUID = /^[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}$/i
var isHex = /^([A-F0-9]{2})+$/i
var isEmail = /^[^@]+@[^@]+\.[^@]{2,3}$/

function getBrowsingContextIdentifier() {
    var hops = "";
    try {
        if (window.top != window && window.top == window.top) {
            var w = window;
            while (top != w) {
                var x = 0;
                for (var i = 0; i < w.parent.frames.length; i++) {
                    if (w == w.parent.frames[i]) x = i;
                };
                hops = "frames[" + x + "]" + (hops.length ? '.' : '') + hops;
                w = w.parent;
            };
            hops = "top" + (hops.length ? '.' + hops : '')
        } else {
            hops = "top";
        }
    } catch (e) { }
    return hops;
}

function getPathCombinations(url) {
    const maxCombSize = 5;
    const pathSegments = url.pathname.split("/").filter((s) => s.length > 0);
    const combinations = [];

    for (let combSize = 1; combSize < maxCombSize; combSize++) {
        if (combSize + 1 > pathSegments.length) {
            break;
        }
        for (let i = 0; i < pathSegments.length - combSize + 1; i++) {
            combinations.push(pathSegments.slice(i, i + combSize).join("/"));
        }
    }

    const all = [
        ...combinations.filter((c) => c.length > 0),
        ...pathSegments,
    ];

    const uniqueCombinations = Array.from(new Set(all));

    return uniqueCombinations;
}

function extractQueryValues(q) {
    return Array.from(new URLSearchParams(q))
        .map((p) => p[1])
        .filter((p) => p.length > 0);
}

function matchInBase64Regex(text) {
    const results = [RegExp.escape(text)];
    const bytes = new TextEncoder().encode(text);

    const toBase64 = (buffer) => btoa(String.fromCharCode(...buffer)).replace(/=/g, '');
    const toUrlSafe = (b64) => b64.replace(/\+/g, '-').replace(/\//g, '_');

    const addWithUrlSafe = (b64) => {
        results.push(b64);
        const urlSafe = toUrlSafe(b64);
        if (b64 !== urlSafe) results.push(urlSafe);
    };

    // Normal encoding
    addWithUrlSafe(toBase64(bytes));

    // 1 zero-byte prefix → base64 adds 2 chars, so we strip first 2
    const offsetBy1 = new Uint8Array(1 + bytes.length);
    offsetBy1.set(bytes, 1);
    addWithUrlSafe(toBase64(offsetBy1).substring(2));

    // 2 zero-byte prefix → base64 adds 4 chars, so we strip first 4
    const offsetBy2 = new Uint8Array(2 + bytes.length);
    offsetBy2.set(bytes, 2);
    addWithUrlSafe(toBase64(offsetBy2).substring(4));

    const pattern = '(' + results.map(s => s.slice(0, -1)).join('|') + ')';
    return new RegExp(pattern, 'i');
}

function queryValuesScan(name, value) {
    const queryValues = extractQueryValues(location.search);

    const findings = [];

    queryValues.forEach((queryValue) => {
        if (queryValue === name || (name.length > 4 && matchInBase64Regex(name).test(queryValue))) {
            findings.push({
                type: "QueryValue",
                argumentValue: queryValue
            });
        }

        if (queryValue === value || (value.length > 4 && matchInBase64Regex(value).test(queryValue)) || (value.length > 4 && matchInBase64Regex(queryValue).test(value))) {
            findings.push({
                type: "QueryValue",
                argumentValue: queryValue
            });
        }
    });

    return findings;
}

function hashFragmentScan(name, value) {
    const hash = location.hash.split("#")[1];
    const hashValues = extractQueryValues(hash);

    if (hash === undefined) 
        return [];

    const findings = [];

    hashValues.forEach((hashValue) => {
        if (hashValue === name || (name.length > 4 && matchInBase64Regex(name).test(hashValue))) {
            findings.push({
                type: "HashFragment",
                argumentValue: hashValue
            });
        }

        if (hashValue === value || (value.length > 4 && matchInBase64Regex(value).test(hashValue)) || (value.length > 4 && matchInBase64Regex(hashValue).test(value))) {
            findings.push({
                type: "HashFragment",
                argumentValue: hashValue
            });
        }
    });

    const hashNoQuery = hash.split("?")[0];
    if (hashNoQuery === name || (name.length > 4 && matchInBase64Regex(name).test(hashNoQuery))) {
        findings.push({
            type: "HashFragment",
            argumentValue: hashNoQuery
        });
    }

    if (hashNoQuery === value || (value.length > 4 && matchInBase64Regex(value).test(hashNoQuery)) || (value.length > 4 && matchInBase64Regex(hashNoQuery).test(value))) {
        findings.push({
            type: "HashFragment",
            argumentValue: hashNoQuery
        });
    }

    if (hash === name || (name.length > 4 && matchInBase64Regex(name).test(hash))) {
        findings.push({
            type: "HashFragment",
            argumentValue: hash
        });
    }

    if (hash === value || (value.length > 4 && matchInBase64Regex(value).test(hash)) || (value.length > 4 && matchInBase64Regex(hash).test(value))) {
        findings.push({
            type: "HashFragment",
            argumentValue: hash
        });
    }

    const hashPathSegments = hash.split("?")[0].split('/')
    hashPathSegments.forEach((hashSegment) => {
        if (!isInteger.test(hashSegment)
        && !isFloat.test(hashSegment)
        && !isUUID.test(hashSegment)
        && !isHex.test(hashSegment)
        && !isEmail.test(hashSegment))
            return;

        if (hashSegment === name || (name.length > 4 && matchInBase64Regex(name).test(hashSegment))) {
            findings.push({
                type: "HashFragment",
                argumentValue: hashSegment
            });
        }

        if (hashSegment === value || (value.length > 4 && matchInBase64Regex(value).test(hashSegment)) || (value.length > 4 && matchInBase64Regex(hashSegment).test(value))) {
            findings.push({
                type: "HashFragment",
                argumentValue: hashSegment
            });
        }
    });

    return findings;
}

function pathArgumentScan(name, value) {
    const findings = [];

    const navPathSegments = getPathCombinations(new URL(location.href));

    navPathSegments.forEach((navSegment) => {
        if (!isInteger.test(navSegment)
            && !isFloat.test(navSegment)
            && !isUUID.test(navSegment)
            && !isHex.test(navSegment)
            && !isEmail.test(navSegment))
            return;

        if (navSegment === name || (name.length > 4 && matchInBase64Regex(name).test(navSegment))) {
            findings.push({
                type: "PathArgument",
                argumentValue: navSegment
            });
        }

        if (navSegment === value || (value.length > 4 && matchInBase64Regex(value).test(navSegment)) || (value.length > 4 && matchInBase64Regex(navSegment).test(value))) {
            findings.push({
                type: "PathArgument",
                argumentValue: navSegment
            });
        }
    });

    return findings;
}

(function () {
    switch (document.contentType) {
        case 'application/xml':
            return;
    }
    
    var cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie') ||
                 Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');
    if (cookieDesc && cookieDesc.configurable) {
        Object.defineProperty(document, 'cookie', {
            get: function () {
                return cookieDesc.get.call(document);
            },
            set: function (val) {
                try { throw new Error(''); } catch (error) { stack = error.stack || ''; }
                stack = stack.split('\n').slice(2).map(function (line) { return line.trim(); });

                const details = { 
                    assignment: val, 
                    name:val.split('=')[0],
                    value:val.split('=')[1].split(';')[0],
                    attributes:val.split('=').slice(1).join('=').split(';').slice(1).join('; '),
                    origin: window.origin, 
                    href: location.href,
                    window: window.top == window ? '' : window.name,
                    fullstack: stack,
                    stack: stack[stack.length-1],
                    hops: getBrowsingContextIdentifier()
                };

                if (details.value.length > 4) {
                    details.findings = [ 
                        ...queryValuesScan(details.name, details.value),
                        ...hashFragmentScan(details.name, details.value),
                        ...pathArgumentScan(details.name, details.value)
                    ];
                }

                var storeEvent = new CustomEvent('cookieAccessTracker', { 'detail': details });
                document.dispatchEvent(storeEvent);

                cookieDesc.set.call(document, val);
            }
        });
    }

    const originalCookieStoreSet = CookieStore.prototype.set;
    CookieStore.prototype.set = function() {
        try { throw new Error(''); } catch (error) { stack = error.stack || ''; }
        stack = stack.split('\n').slice(2).map(function (line) { return line.trim(); });

        var details = {
            origin: window.origin, 
            href: location.href,
            window: window.top == window ? '' : window.name,
            fullstack: stack,
            stack: stack[stack.length-1],
            hops: getBrowsingContextIdentifier()
        };

        if (typeof arguments[0] === "string") {
            details.name = arguments[0];
            details.value = arguments[1];
            details.assignment = `${details.name}=${details.value}`;
            details.attributes = '';
        } else {
            details.name = arguments[0].name;
            details.value = arguments[0].value;
            details.attributes = (arguments[0].domain == null ? '' : `domain=${arguments[0].domain}; `)
                               + (arguments[0].path == null ? '' : `path=${arguments[0].path}; `)
                               + (arguments[0].expires == null ? '' : `expires=${arguments[0].expires}; `)
                               + (arguments[0].sameSite == null ? '' : `sameSite=${arguments[0].sameSite}; `)
                               + (arguments[0].partitioned == null ? '' : `partitioned=${arguments[0].partitioned}; `)
                               + 'Secure';
            details.assignment = `${details.name}=${details.value}; ${details.attributes}`;
        }

        details.findings = [ 
            ...queryValuesScan(details.name, details.value),
            ...hashFragmentScan(details.name, details.value),
            ...pathArgumentScan(details.name, details.value)
        ];

        var storeEvent = new CustomEvent('cookieAccessTracker', { 'detail': details });
        document.dispatchEvent(storeEvent);

        return originalCookieStoreSet.apply(this, arguments);
    }
})();
