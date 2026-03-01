/**
 * Ported Config for UDAN-UI
 */

export const CONFIG = {
    current: "TEST",
    UDADebug: false,
    UDA_CONTAINER_CLASS: "udan-main-panel",
    UDA_CLICK_IGNORE_CLASS: "uda_exclude",
    UDA_DOMAIN: process.env.baseURL,
    UDA_API_URL: process.env.baseURL + "/api",
    UDASessionID: (
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15)
    ),
    UDA_POST_INTERVAL: 1000,
    UDALastMutationTime: 0,
    UDALogLevel: 0,
    RECORDING_IS_PLAYING: "UDAIsPlaying",
    RECORDING_MANUAL_PLAY: "UDAManualPlay",
    RECORDING_SWITCH_KEY: "UDARecordingSwitch",
    RECORDING_SEQUENCE: "UDAActiveRecordingData",
    SELECTED_RECORDING: "UDASelectedRecordedItem",
    USER_AUTH_DATA_KEY: "udaUserData",
    UserScreenAcceptance: "udaUserScreenAcceptance",
    USER_SESSION_KEY: "UDASessionKey",
    UDAKeyCloakKey: "UDAKeyCloak",
    USER_SESSION_ID: "UDASessionId",
    SYNC_INTERVAL: 1000,
    AUTO_PLAY_SLEEP_TIME: 2000,
    JARO_WEIGHT: 0.95,
    JARO_WEIGHT_PERSONAL: 0.90,
    lastClickedTime: null,
    specialNodeKey: "UDASpecialNodes",
    enableInfiniteScroll: true,
    enableInfiniteScrollPageLength: 10,
    UDA_URL_Param: 'UDA_Sequence_id',
    set Environment(value: any) {
        this.current = value.toString().toUpperCase();
        if (this.current === "PROD") {
            this.UDA_DOMAIN = "https://udan.nistapp.ai";
        } else {
            this.UDA_DOMAIN = "https://udantest.nistapp.ai";
        }
        this.UDA_API_URL = this.UDA_DOMAIN + "/api";
    },
    get Environment() {
        return this.current;
    },
    DEBOUNCE_INTERVAL: 1000,
    indexInterval: 1000,
    clickObjects: [],
    nodeId: 0,
    isRecording: false,
    htmlIndex: [],
    invokeTime: 2000,
    apiInvokeTime: 300,
    maxStringLength: 25,
    playNextAction: true,
    navigatedToNextPage: { check: false, url: '' },
    ignoreElements: ["script", "h1", "h2", "h3", "link", "noscript", "style"],
    ignoreAttributes: [
        'translate', 'draggable', 'spellcheck', 'tabindex', 'clientHeight', 'clientLeft', 'clientTop', 'clientWidth',
        'offsetHeight', 'offsetLeft', 'offsetTop', 'offsetWidth', 'scrollHeight', 'scrollLeft', 'scrollTop', 'scrollWidth',
        'baseURI', 'isConnected', 'ariaPressed', 'aria-pressed', 'nodePosition', 'outerHTML', 'innerHTML', 'style',
        'aria-controls', 'aria-activedescendant', 'ariaExpanded', 'autocomplete', 'aria-expanded', 'aria-owns', 'formAction',
        'ng-star-inserted', 'ng-star', 'aria-describedby', 'width', 'height', 'x', 'y', 'selectionStart', 'selectionEnd', 'required', 'validationMessage', 'selectionDirection',
        'naturalWidth', 'naturalHeight', 'complete', '_indexOf', 'value', 'defaultValue', 'min', 'max', 'nodeInfo', 'data-tooltip-id', 'addedclickrecord', 'checked', 'data-tribute',
        'hasclick', 'addedClickRecord', 'hasClick', 'valueAsNumber', 'udaIgnoreChildren', 'udaIgnoreClick', 'udaignorechildren', 'udaignoreclick', 'fdprocessedid', '__ngContext__',
        'd', 'text', 'textContent', 'cdk-describedby-host', 'inert', 'fill', 'disabled', 'hidden', 'data-activates'
    ],
    innerTextWeight: 5,
    ignoreNodesFromIndexing: ['ng-dropdown-panel', 'ckeditor', 'fusioncharts', 'ngb-datepicker', 'ngx-daterangepicker-material', 'uda-panel', 'mat-datepicker-content', 'ng-select'],
    ignoreNodesContainingClassNames: ['cke_dialog_container', 'cke_notifications_area', 'gldp-default', 'ajs-layer', 'aui-list', 'herknl', 'jstBlock'],
    cancelRecordingDuringRecordingNodes: [],
    addClickToSpecialNodes: ['ng-select', 'ngb-datepicker'],
    ignoreClicksOnSpecialNodes: ['ngx-daterangepicker-material'],
    customNameForSpecialNodes: {
        'ngb-datepicker': 'Date selector',
        'mat-datepicker-content': 'Date selector',
        'ngx-daterangepicker-material': 'Date Range Selector'
    },
    specialInputClickClassNames: ['ghx-dropdown-trigger', 'aui-list', 'jstBlock', 'mat-form-field-flex', 'mat-select-trigger'],
    commonTags: ['span', 'div'],
    tooltipDisplayedNodes: [],
    // replay variables
    autoplayCompleted: false,
    autoplayPaused: false,
    // manual click variables
    invokedActionManually: false,
    // personal node ignore attributes
    personalNodeIgnoreAttributes: [
        "innerText",
        "innerHTML",
        "outerText",
        "outerHTML",
        "nodeValue",
        "src",
        "naturalWidth",
        "naturalHeight",
        "currentSrc",
    ],
    //Azure content moderator attributes
    profanity: {
        enabled: true,
        provider: "azure",
        config: {
            key1: process.env.profanityKey,
            key2: process.env.profanityKey,
            endPoint: process.env.profanityUrl,
            region: process.env.profanityRegion,
        },
    },
    multilingual: {
        enabled: false,
        searchInLang: "en-US",
        selectedLang: "en-US",
        displayText: "",
        translatedText: "",
        translate: {
            provider: "google",
            apikey: process.env.googleTranslateApiKey,
            translateTo: "en",
            apiurl: process.env.googleTranslateUrl,
        },
    },
    // Flag to enable node type detection
    enableNodeTypeChangeSelection: true,
    set enableNodeTypeSelection(val) {
        this.enableNodeTypeChangeSelection = val;
        // this.showhtml();
    },
    get enableNodeTypeSelection() {
        return CONFIG.multilingual.enabled;
    },
    cspUserAcceptance: {
        storageName: "uda-csp-enabled",
        data: { proceed: true },
    },
    screenAcceptance: {
        storageName: "uda-user-screen-consent",
        data: { proceed: true },
    },
    ignoreDynamicAttributeText: ['_ng', '__context', '__zone_symbol', '']
};
