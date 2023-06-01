console.log('hello from popup-sandboxed.js');

const default_expr = JSON.stringify({
    iframe: '#topbar-notifications',
    selector: '.notifications-list__item.is-unread a',
}, null, 4) + '\n';

new Vue({
    el: '#app',
    template: `
        <div class="mg15">
            <div class="hsplit">
                <h2 class="xm">{{ key }}</h2>
                <span class="fluid"></span>
                <div class="flex-row-center mi5">
                    <span>Settings:</span>
                    <button v-on:click="click_settings_import" class="fs8">import</button>
                    <button v-on:click="click_settings_export" class="fs8">export</button>
                </div>
                <button v-on:click="click_close" class="ml25">close</button>
            </div>
            <textarea v-model="expr" class="db ww h100"></textarea>
            <div class="flex-row flex-align-center mi10">
                <div>Urls found: {{ urls.length }}</div>
                <button v-on:click="click_tab" v-bind:disabled="!urls.length" class="green">open all in new tabs</button>
                <button v-on:click="click_click" v-bind:disabled="!urls.length" class="yellow">click all</button>
                <button v-on:click="click_clipboard" v-bind:disabled="!urls.length" class="magenta">copy to clipboard</button>
            </div>
            <div v-if="error" class="red">
                {{ error }}
            </div>
        </div>
    `,
    data: {
        error: null,
        key: null,
        expr: default_expr,
        expr_saved: null,
        urls: [],
        response: 0,
    },
    watch: {
        expr: m(async function (value) {
            if (value === this.expr_saved) {
                return;
            }
            try {
                JSON.parse(value);
            }
            catch (error) {
                return;
            }
            await api_settings_put(value);
            this.urls = await api_preview(this.expr);
        }),
    },
    methods: {
        click_tab: m(async function () {
            this.response = await api_exec({action: 'tab'});
        }),
        click_click: m(async function () {
            this.response = await api_exec({action: 'click'});
        }),
        click_clipboard: m(async function () {
            this.response = await api_exec({action: 'clipboard'});
        }),
        click_close: m(async function () {
            await api_close();
        }),
        click_settings_import: m(async function () {
            await api_settings_import();
        }),
        click_settings_export: m(async function () {
            await api_settings_export();
        }),
    },
    created: m(async function () {
        const {key, value} = await api_init();
        this.expr_saved = value || default_expr;
        this.key = key;
        this.expr = value || default_expr;
        this.urls = await api_preview(this.expr);
    }),
});

function m(fn)
{
    return async function (...args) {
        this.error = null;
        try {
            return await fn.apply(this, args);
        }
        catch (error) {
            this.error = error;
        }
    };
}

async function api(action, value)
{
    const uid = cuid();
    return new Promise(function (resolve, reject) {
        window.addEventListener('message', fn);
        function fn(event) {
            console.log('message received', event);
            if (event.data.uid !== uid) {
                return;
            }
            window.removeEventListener('message', fn);
            if (event.data.error) {
                reject(new Error(event.data.error.message));
            }
            else {
                resolve(event.data.value);
            }
        }
        window.top.postMessage({action, uid, value}, '*');
    });
}

async function api_init()
{
    return api('api_init');
}

async function api_exec({action})
{
    return api('api_exec', {action});
}

async function api_preview(expr)
{
    return api('api_preview', {expr});
}

async function api_close()
{
    return api('api_close');
}

async function api_settings_put(value)
{
    return api('api_settings_put', {value});
}

async function api_settings_export()
{
    return api('api_settings_export');
}

async function api_settings_import()
{
    return api('api_settings_import');
}
