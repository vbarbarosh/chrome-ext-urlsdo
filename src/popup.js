console.log('hello from popup.js');

window.addEventListener('message', async function (event) {
    switch (event.data.action) {
    case 'api_init':
        await res(event, api_init());
        break;
    case 'api_settings_put':
        await res(event, api_settings_put(event.data.value))
        break;
    case 'api_settings_export':
        await res(event, api_settings_export());
        break;
    case 'api_settings_import':
        await res(event, api_settings_import());
        break;
    case 'api_exec':
        await res(event, api_exec(event.data.value));
        break;
    case 'api_preview':
        await res(event, api_preview(event.data.value));
        break;
    case 'api_close':
        window.top.close();
        break;
    }
});

async function res(event, promise)
{
    const {uid} = event.data;
    try {
        const value = await promise;
        event.source.postMessage({uid, value}, '*');
    }
    catch (error) {
        event.source.postMessage({uid, error: {message: error.message}}, '*');
    }
}

async function api_init()
{
    console.log('api_init');
    const [tab] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
    const key = new URL(tab.url).hostname;
    const tmp = await chrome.storage.local.get([key]);
    const defaults = {
        iframe: '#topbar-notifications',
        selector: '.notifications-list__item.is-unread a',
        action: 'click', // click or tab
        limit: 100,
    };
    return {key, value: tmp[key]};
}

async function api_settings_put({value})
{
    const [tab] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
    const key = new URL(tab.url).hostname;
    await chrome.storage.local.set({[key]: value});
}

async function api_settings_export()
{
    const settings = {};
    Object.entries(await chrome.storage.local.get(null)).forEach(function ([key, value]) {
        try {
            settings[key] = JSON.parse(value);
        }
        catch (error) {
            settings[key] = value;
        }
    });

    // https://stackoverflow.com/a/22113345
    // // remember to add "permissions": ["downloads"] to manifest.json
    // // this snippet is inside a onMessage() listener function
    // var imgurl = "https://www.google.com.hk/images/srpr/logo11w.png";
    // chrome.downloads.download({url:imgurl},function(downloadId){
    //     console.log("download begin, the downId is:" + downloadId);
    // });
    // remember to add "permissions": ["downloads"] to manifest.json
    // this snippet is inside a onMessage() listener function
    var imgurl = "https://www.google.com.hk/images/srpr/logo11w.png";

    const url = URL.createObjectURL(new Blob([json_stringify_pretty(settings)], {type: 'application/json'}));
    chrome.downloads.download({url, saveAs: true, filename: 'settings.json'},function(downloadId){
        console.log("download begin, the downId is:" + downloadId);
        URL.revokeObjectURL(url);
    });
}

async function api_settings_import()
{
    const file = await file_from_ask();
    const settings = {};
    Object.entries(await file_read_json(file)).forEach(function  ([key, value]) {
        settings[key] = typeof value == 'string' ? value : json_stringify_pretty(value);
    });
    await chrome.storage.local.set(settings);
}

async function api_preview({expr})
{
    const expr_obj = JSON.parse(expr);
    const [tab] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
    const [tmp] = await chrome.scripting.executeScript({
        target: {tabId: tab.id},
        func: function (expr_obj) {
            const doc = expr_obj.iframe
                ? document.querySelector(expr_obj.iframe).contentWindow.document
                : document;
            return Array.from(doc.querySelectorAll(expr_obj.selector)).map(v => v.href);
        },
        args: [expr_obj],
    });
    return tmp.result;
}

async function api_exec({action})
{
    const [tab] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
    const key = new URL(tab.url).hostname;
    const conf = await chrome.storage.local.get([key]);
    const expr = JSON.parse(conf[key]||'{}');

    const [tmp] = await chrome.scripting.executeScript({
        target: {tabId: tab.id},
        func: function (action, expr) {
            const doc = expr.iframe
                ? document.querySelector(expr.iframe).contentWindow.document
                : document;
            switch (action) {
            case 'click':
                Array.from(doc.querySelectorAll(expr.selector)).map(v => v.click());
                return null;
            case 'tab':
            case 'clipboard':
                return Array.from(doc.querySelectorAll(expr.selector)).map(v => v.href);
            default:
                return null;
            }
        },
        args: [action, expr],
    });
    if (action == 'tab') {
        tmp.result.forEach(url => chrome.tabs.create({url}));
    }
    else if (action == 'clipboard') {
        const type = 'text/plain';
        const blob = new Blob([tmp.result.concat('').join('\n')], {type});
        const data = [new ClipboardItem({[type]: blob})];
        navigator.clipboard.write(data);
        await new Promise(resolve => setTimeout(resolve, 1));
        window.top.close();
    }
}

let file_from_ask_input = null;
function file_from_ask()
{
    if (file_from_ask_input === null) {
        file_from_ask_input = jQuery('<input id="#select-file" type="file" style="display: none;" />').appendTo(document.body);
    }
    const input = file_from_ask_input;
    input.val(null);
    return new Promise(function (resolve, reject) {
        input.off('change').on('change', function (event) {
            resolve(event.target.files[0]);
        });
        input.click();
    });
}

function file_read_utf8(file)
{
    return new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.addEventListener('load', function () {
            resolve(reader.result);
        });
        reader.addEventListener('error', function (error) {
            reject(error);
        });
        reader.readAsText(file, 'utf8');
    });
}

async function file_read_json(file)
{
    return JSON.parse(await file_read_utf8(file));
}

function json_stringify_pretty(value)
{
    return JSON.stringify(value, null, 4) + '\n';
}
