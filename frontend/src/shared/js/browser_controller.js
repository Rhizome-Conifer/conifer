/* eslint-disable */

function toQueryString(obj) {
    var parts = [];
    for (var i in obj) {
        if (obj.hasOwnProperty(i)) {
            parts.push(encodeURIComponent(i) + "=" + encodeURIComponent(obj[i]));
        }
    }
    return parts.join("&");
}

var controllerScripts = [];
function loadScript(src) {
    return new Promise(function (resolve, reject) {
        var s;
        s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
        controllerScripts.push(s);
    });
}

export default function CBrowser(reqid, target_div, init_params) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;

    var cmd_host = undefined;
    var vnc_host = undefined;

    var connected = false;
    var ever_connected = false;

    var fail_count = 0;

    var min_width = 800;
    var min_height = 600;

    var rfb;
    var resizeTimeout;
    var vnc_pass = "secret";

    var countdownTimer = null;
    var end_time = undefined;
    var cid = undefined;

    var waiting_for_container = false;
    var waiting_for_vnc = false;

    init_params = init_params || {};

    init_params.api_prefix = init_params.api_prefix || "";

    var num_vnc_retries = init_params.num_vnc_retries || 3;

    var req_params = {};

    var maxRetry = 10;
    var retryCount = 0;

    var hasClipboard = false;
    var lastText = undefined;
    var stagedText = null;
    var clipEvents = ['paste'];
    var target_div_obj = document.querySelector(target_div);

    // setTimeout handles
    var timers = [];
    var retryHandle = null;

    function start() {
        if (!window.INCLUDE_URI) {
            if (!init_params.static_prefix) {
                init_params.static_prefix = "/static/";
            }

            window.INCLUDE_URI = init_params.static_prefix + "novnc/";

            Promise.all([
                loadScript(window.INCLUDE_URI + 'core/util.js'),
                loadScript(window.INCLUDE_URI + 'app/webutil.js'),
            ]).then(function (res) {
                var scripts = ["core/base64.js", "core/websock.js", "core/des.js", "core/input/keysymdef.js",
                                 "core/input/xtscancodes.js", "core/input/util.js", "core/input/devices.js",
                                 "core/display.js", "core/inflator.js", "core/rfb.js", "core/input/keysym.js"];

                var promises = []
                for(var i=0; i < scripts.length; i++) {
                    promises.push(loadScript(window.INCLUDE_URI + scripts[i]));
                }

                return Promise.all(promises);
            }).catch(err => console.log(err));
        }

        // Countdown updater
        if (init_params.on_countdown) {
            countdownTimer = setInterval(update_countdown, 1000);
        }

        init_html();

        setup_browser();
    }

    function clearTimers() {
        // clear intervals and timers
        clearInterval(countdownTimer);
        clearTimeout(retryHandle);
        for (const timer of timers) {
            clearTimeout(timer);
        }
        timers = [];
    }

    function close() {
        if (controller) {
            // cancel fetch requests
            controller.abort();
        }

        var cnvs = canvas();
        var _screen = screen();
        // ensure focus is freed
        lose_focus();
        _screen.removeEventListener('blur', lose_focus);
        _screen.removeEventListener('mouseleave', lose_focus);
        _screen.removeEventListener('mouseenter', grab_focus);
        cnvs.removeEventListener('click', grab_focus);

        clearTimers();

        for (var i = 0; i < controllerScripts.length; i++) {
            try {
                document.head.removeChild(controllerScripts[i]);
            } catch (e) {
                console.log('Error cleaning up after remote browser session', e);
            }
        }

        document.removeEventListener("visibilitychange", visibilityChangeCB);
    }

    function clipHandler(evt) {
        if (!hasClipboard) {
         return false;
        }

        var text = evt.clipboardData.getData('Text');

        if (connected && rfb && lastText != text) {
            // TODO: see `onVNCCopyCut()`
            rfb.clipboardPasteFrom(text);
            lastText = text;
        }
    }

    function init_clipboard() {
        if (!init_params.clipboard) {
            return;
        }

        lose_focus();
        hasClipboard = true;

        // if remote browser cut/copy opperation occured, insert into clipboard field
        if (stagedText) {
            document.querySelector(init_params.clipboard).value = stagedText;
            stagedText = null;
        }

        for (var i = 0; i < clipEvents.length; i++) {
            document.querySelector(init_params.clipboard).addEventListener(clipEvents[i], clipHandler);
        }
    }

    function destroy_clipboard() {
        if (!init_params.clipboard) {
            return;
        }

        grab_focus();
        hasClipboard = false;

        // clipboard DOM node is removed before destroy fires, so listeners should be removed automatically
        // for (var i = 0; i < clipEvents.length; i++) {
        //     document.querySelector(init_params.clipboard).removeEventListener(clipEvents[i], clipHandler);
        // }
    }

    function canvas() {
        return target_div_obj.querySelector('canvas');
    }

    function getMsgDiv() {
        return target_div_obj.querySelector("#browserMsg");
    }

    function screen() {
        return target_div_obj.querySelector("#noVNC_screen");
    }

    function init_html() {
        // ensure container is emptied of previous browsers
        target_div_obj.innerHTML = '';

        var msgDiv = document.createElement('div');
        msgDiv.setAttribute('id', 'browserMsg');
        msgDiv.setAttribute('class', 'loading');
        target_div_obj.appendChild(msgDiv)

        var _canvas = document.createElement('canvas')
        _canvas.setAttribute('tabindex', 0);
        var cnvsDiv = document.createElement('div');
        cnvsDiv.setAttribute('id', 'noVNC_screen');
        cnvsDiv.appendChild(_canvas)
        target_div_obj.appendChild(cnvsDiv);

        _canvas.style.display = 'none';

        var _screen = screen();
        _screen.addEventListener('blur', lose_focus);
        _screen.addEventListener('mouseleave', lose_focus);
        _screen.addEventListener('mouseenter', grab_focus);
        _canvas.addEventListener('click', grab_focus);
    }

    function setup_browser() {
        if (waiting_for_vnc || waiting_for_container) {
            return;
        }

        var msg;

        if (ever_connected) {
            msg = "Reconnecting to Remote Browser...";
        } else {
            msg = "Initializing Remote Browser...";
        }

        getMsgDiv().innerHTML = msg;
        getMsgDiv().style.display = 'block';

        const bcr = target_div_obj.getBoundingClientRect();
        let w = bcr.width;
        let h = bcr.height;

        if (!init_params.fill_window) {
            w *= 0.96;
            h -= 25;
        }

        if (w < h) {
            // flip mins for vertical layout
            var t = min_width;
            min_width = min_height;
            min_height = t;
        }

        req_params['width'] = Math.max(w, min_width);
        req_params['height'] = Math.max(h, min_height);
        req_params['width'] = parseInt(req_params['width'] / 8, 10) * 8;
        req_params['height'] = parseInt(req_params['height'] / 8, 10) * 8;

        req_params['reqid'] = reqid;

        init_browser();
    }

    function init_browser() {
        if (waiting_for_container) {
            return;
        }

        waiting_for_container = true;

        var init_url = init_params.api_prefix + "/init_browser?" + toQueryString(req_params);

        var options = { headers: new Headers({'x-requested-with': 'XMLHttpRequest'}) };

        if (controller) {
            options.signal = controller.signal;
        }

        // expects json response
        fetch(init_url, options)
            .then(function (res) { return res.json(); })
            .then(function (data) {
                waiting_for_container = false;
                handle_browser_response(data);
            })
            .catch(function (err) {
                console.log('fetch error', err);
                waiting_for_container = false;

                // user canceled
                if (err.name === 'AbortError') {
                    return;
                }

                if (!err || err.status !== 404) {
                    getMsgDiv().innerHTML = 'Reconnection to Remote Browser...';

                    if(retryCount++ < maxRetry) {
                        timers.push(setTimeout(init_browser, 1000));
                    }

                    return;
                }

                if (init_params.on_event) {
                    init_params.on_event('expire');
                } else {
                    getMsgDiv().innerHTML = 'Remote Browser Expired... Please try again...';
                    getMsgDiv().style.display = 'block';
                }
            });
    }

    function handle_browser_response(data) {
        if (data.cmd_host && data.vnc_host) {
            cmd_host = data.cmd_host;
            vnc_host = data.vnc_host;

            end_time = parseInt(Date.now() / 1000, 10) + data.ttl;

            vnc_pass = data.vnc_pass;

            if (init_params.audio) {
                canvas().addEventListener("click", function() {
                    if (data.audio == "opus") {
                        doAudio(data);
                    }
                });
            }

            if (init_params.on_event) {
                init_params.on_event("init", data);
            }

            timers.push(setTimeout(try_init_vnc, 1000));

        } else if (data.queue != undefined) {
            var msg = "Waiting for empty slot... ";
            if (data.queue == 0) {
                msg += "<b>You are next!</b>";
            } else {
                msg += "At most <b>" + data.queue + " user(s)</b> ahead of you";
            }
            getMsgDiv().innerHTML = msg;

            timers.push(setTimeout(init_browser, 3000));
        } else if (data.error_message && init_params.on_event) {
            init_params.on_event("error", data.error_message);
        }
    }

    function try_init_vnc() {
        if (do_vnc()) {
            // success!
            return;
        }

        fail_count++;

        if (fail_count <= num_vnc_retries) {
            getMsgDiv().innerHTML = "Retrying to connect to remote browser...";
            timers.push(setTimeout(init_browser, 1000));
        } else {
            if (init_params.on_event) {
                init_params.on_event("fail");
            } else {
                getMsgDiv().innerHTML = "Failed to connect to remote browser... Please try again later";
            }
        }
    }

    function lose_focus() {
        if (!rfb) return;
        rfb.get_keyboard().set_focused(false);
        rfb.get_mouse().set_focused(false);
    }

    function grab_focus() {
        if (!rfb) return;

        if (document.activeElement &&
            (document.activeElement.tagName == "INPUT" || document.activeElement.tagName == "TEXTAREA")) {
            lose_focus();
            return;
        }

        if (init_params.fill_window) {
            canvas().focus();
        }

        rfb.get_keyboard().set_focused(true);
        rfb.get_mouse().set_focused(true);
    }

    function clientPosition() {
        const bcr = target_div_obj.getBoundingClientRect();
        const c = canvas();
        const ch = c.getBoundingClientRect().height;
        const cw = c.getBoundingClientRect().width;

        if (!init_params.fill_window) {
            c.style.marginLeft = ((bcr.width - cw)/2) + 'px';
            c.style.marginTop = ((bcr.height - (ch + 25))/2) + 'px';
        }
    }

    function clientResize() {
        const bcr = target_div_obj.getBoundingClientRect();

        let w = bcr.width;
        let h = bcr.height;

        if (!init_params.fill_window) {
            w = Math.round(w * 0.96);
            h = h - 25;
        }

        if (rfb) {
            var s = rfb._display.autoscale(w, h);
            rfb.get_mouse().set_scale(s);
        }
    }

    function FBUComplete(rfb, fbu) {
        if (req_params['width'] < min_width || req_params['height'] < min_height) {
            clientResize();
        }

        clientPosition();
        rfb.set_onFBUComplete(function() { });
    }

    function onVNCCopyCut(rfb, text)
    {
        if (init_params.clipboard && hasClipboard) {
            // TODO: sort out how to send clipboard data to rb, currently `rfb.clipboardPasteFrom(text);`
            // triggers this fn
        } else if (init_params.clipboard) {
            stagedText = text;
        }
    }

    function do_vnc() {
        if (waiting_for_vnc) {
            return;
        }

        waiting_for_vnc = true;

        try {
            rfb = new RFB({'target':       canvas(),
                           'encrypt':      (window.location.protocol === "https:"),
                           'repeaterID':   '',
                           'true_color':   true,
                           'local_cursor': true,
                           'shared':       false,
                           'view_only':    false,
                           'onUpdateState':  updateState,
                           'onClipboard':    onVNCCopyCut,
                           'onFBUComplete':  FBUComplete});
        } catch (exc) {
            waiting_for_vnc = false;
            //updateState(null, 'fatal', null, 'Unable to create RFB client -- ' + exc);
            console.warn(exc);
            return false; // don't continue trying to connect
        }

        var hostport = vnc_host.split(":");
        var host = hostport[0];
        var port = hostport[1];
        var password = vnc_pass;
        var path = "websockify";

        // Proxy WS via the origin host, instead of making direct conn
        // 'proxy_ws' specifies the proxy path, port is appended
        if (init_params.proxy_ws) {
            path = init_params.proxy_ws + port;
            host = window.location.hostname;

            port = window.location.port;
            if (!port) {
                port = (window.location.protocol == "https:" ? 443 : 80);
            }
        }

        try {
            rfb.connect(host, port, password, path);
        } catch (exc) {
            waiting_for_vnc = false;
            console.warn(exc);
            return false;
        }

        waiting_for_vnc = false;
        return true;
    }

    function updateState(rfb, state, oldstate, msg) {
        if (state == "disconnecting") {
            connected = false;

            canvas().style.display = 'none';

            var reinit = !document.hidden;

            if (init_params.on_event) {
                init_params.on_event("disconnect");
            }

            if (reinit) {
                setup_browser();
            }
        } else if (state == "connected") {
            canvas().style.display = 'block';
            if (init_params.fill_window) {
                canvas().focus();
            }

            getMsgDiv().style.display = 'none';

            ever_connected = true;
            connected = true;
            fail_count = 0;

            if (init_params.on_event) {
                init_params.on_event("connect");
            }
        } else if (state == "connecting") {
            // do nothing
        }
    }

    window.onresize = function () {
        // When the window has been resized, wait until the size remains
        // the same for 0.5 seconds before sending the request for changing
        // the resolution of the session
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function(){
            clientResize();
            clientPosition();
        }, 500);
    };

    var did;
    function visibilityChangeCB() {
        if (document.hidden) {
            did = setTimeout(function() {
                if (rfb) {
                    rfb.disconnect();
                }
            },
            init_params.inactiveSecs * 1000);
        } else {
            clearTimeout(did);
            if (!connected) {
                if (init_params.on_event) {
                    init_params.on_event("reconnect");
                }

                setup_browser();
            }
        }
    }

    function update_countdown() {
        if (!end_time) {
            return;
        }
        var curr = Math.floor(new Date().getTime() / 1000);
        var secdiff = end_time - curr;

        if (secdiff < 0) {
            init_params.on_countdown(0, "00:00");
            return;
        }

        var min = Math.floor(secdiff / 60);
        var sec = secdiff % 60;
        if (sec <= 9) {
            sec = "0" + sec;
        }
        if (min <= 9) {
            min = "0" + min;
        }

        init_params.on_countdown(secdiff, min + ":" + sec);
    }

    if (init_params.inactiveSecs) {
        document.addEventListener("visibilitychange", visibilityChangeCB);
    }


       var audioCount = 0;

    function get_ws_url(browser_info) {
        var ws_url;

        ws_url = (window.location.protocol == "https:" ? "wss:" : "ws:");

        if (init_params.proxy_ws) {
            var audio_port = browser_info.cmd_host.split(":")[1];
            ws_url += window.location.host + "/" + init_params.proxy_ws + audio_port;
            ws_url += "&count=" + audioCount++;
        } else {
            ws_url += browser_info.cmd_host + "/audio_ws";
        }

        return ws_url;
    }

    var audioWS = null;

    function WSAudio(ws_url) {
        var MIME_TYPE = 'audio/webm; codecs="opus"';

        var MAX_BUFFERS = 250;
        var MIN_START_BUFFERS = 10;

        var MAX_ERRORS = 1;

        this.buffQ = [];
        this.buffCount = 0;

        this.ws_url = ws_url;
        this.lastTs = undefined;
        this.ws = null;

        this.errCount = 0;

        this.initing = false;
        this.updating = false;

        this.audio = null;
        this.mediasource = null;
        this.buffer = null;

        this.buffSize = 0;

        this.initAudio = function() {
            if (this.initing) {
                console.log("already initing");
                return;
            }

            this.initing = true;
            console.log("Init Audio");

            this.mediasource = new MediaSource();
            this.mediasource.addEventListener("sourceopen", this.sourceOpen.bind(this));

            this.mediasource.addEventListener("error", (function(event) {
                this.audioError("MediaSource Error", event);
            }).bind(this));

            this.audio = new Audio();
            this.audio.src = URL.createObjectURL(this.mediasource);
            this.audio.autoplay = true;
            this.audio.load();
            this.audio.play().catch(function() { });
        }

        this.sourceOpen = function() {
            if (this.mediasource.sourceBuffers.length) {
               console.log("source already open");
               return;
            }

            var buffer = null;

            try {
                buffer = this.mediasource.addSourceBuffer(MIME_TYPE);
            } catch (e) {
                console.log("Opening Source Error: " + e);
                return;
            }

            buffer.mode = "sequence";
            //buffer.timestampOffset = 0;

            buffer.addEventListener("error", (function(event) {
                this.audioError("buffer error: " + (this.buffCount), event);
            }).bind(this));

            buffer.addEventListener("updateend", this.updateNext.bind(this));

            this.buffer = buffer;
            this.initing = false;

            this.initWs();
        };

        this.close = function() {
            console.log("Closing Audio");
            try {
                if (this.mediasource) {
                    this.mediasource.removeSourceBuffer(this.buffer);
                    if (this.mediasource.readyState == "open") {
                        this.mediasource.endOfStream();
                    }
                }
                this.buffer = null;

            } catch(e) {
                console.log("Error Closing: " + e);
            }
            this.mediasource = null;

            try {
                if (this.audio) {
                    this.audio.pause();
                }
                this.audio = null;
            } catch (e) {
                console.log("Error Closing: " + e);
            }

            if (this.ws) {
                try {
                    this.ws.close();
                } catch(e) {}

                this.ws = null;
            }
        }

        this.valid = function(lastTs) {
            if (this.errCount > 0) {
                return false;
            }

            if (!this.buffer) {
                return false;
            }

            // if ws update hasn't changed
            if (lastTs && this.lastTs && (this.lastTs <= lastTs)) {
                return false;
            }

            return true;
        }

        this.mergeBuffers = function() {
            var merged;

            if (this.buffQ.length == 1) {
                merged = this.buffQ[0];
            } else {
                merged = new Uint8Array(this.buffSize);

                var length = this.buffQ.length;
                var offset = 0;

                for (var i = 0; i < length; i++) {
                    var curr = this.buffQ[i];
                    if (curr.length <= 0) {
                        continue;
                    }
                    merged.set(curr, offset);
                    offset += curr.length;
                }
            }

            this.buffQ = [];
            this.buffCount++;
            return merged;
        }

        this.updateNext = function() {
            if (this.initing || this.updating || (this.errCount >= MAX_ERRORS) || !this.buffQ.length || !this.buffer || this.buffer.updating) {
                return;
            }

            if (this.buffCount == 0 && this.buffQ.length < MIN_START_BUFFERS) {
                return;
            }

            this.updating = true;

            try {
                var merged = this.mergeBuffers();
                this.buffer.appendBuffer(merged);
                this.buffSize -= merged.length;
                this.buffSize = 0;
                this.errCount = 0;
            } catch (e) {
                this.audioError("Error Adding Buffer: " + e);
            }

            this.updating = false;
        }

        this.audioError = function(msg, event) {
            if (this.audio.error) {
                console.log(msg);
                console.log(this.audio.error);
                //console.log("num processed: " + this.buffCount);
                this.errCount += 1;
                if (this.errCount == 1) {
                    setTimeout(window.restartAudio, 3000);
                }
            }
        }

        this.queue = function(buffer) {
            if (this.buffSize > 20000) {
                if (this.buffCount > 0) {
                    var res = this.buffQ.shift();
                    this.buffSize -= res.length;
                    console.log("dropping old buffers");
                } else {
                    // don't drop the starting buffers
                    console.log("dropping new buffers");
                    this.updateNext();
                    return;
                }
            }

            buffer = new Uint8Array(buffer);
            this.buffQ.push(buffer);
            this.buffSize += buffer.length;

            this.updateNext();
        }

        this.initWs = function() {
            try {
                this.ws = new WebSocket(this.ws_url, "binary");
            } catch (e) {
                this.audioError("WS Open Failed");
            }

            this.ws.binaryType = 'arraybuffer';
            this.ws.addEventListener("open", ws_open);
            this.ws.addEventListener("close", ws_close);
            this.ws.addEventListener("message", ws_message);
            this.ws.addEventListener('error', ws_error);
        }

        var ws_open = function(event) {
            if (!audioWS || this != audioWS.ws) {
                return;
            }

            this.send("ready");
        }

        var ws_message = function(event) {
            if (!audioWS || this != audioWS.ws) {
                return;
            }

            if (audioWS.errCount < MAX_ERRORS) {
                audioWS.queue(event.data);
            }
        }

        var ws_error = function() {
            if (!audioWS || this != audioWS.ws) {
                return;
            }

            audioWS.audioError("WS Error");
        }

        var ws_close = function() {
            if (!audioWS || this != audioWS.ws) {
                return;
            }

            audioWS.audioError("WS Close");
        }

        this.initAudio();
    }

    var audioInit = false;
    var browser_info;

    function doAudio(info) {
        if (audioInit) {
            return;
        }

        browser_info = info;

        audioInit = true;

        console.log("Initing Audio...");

        window.restartAudio();
    }

    window.restartAudio = function() {
        if (audioWS && audioWS.initing) {
            return;
        }

        if (audioWS) {
            console.log("Reiniting Audio");
            audioWS.close();
        }

        audioWS = new WSAudio(get_ws_url(browser_info));
    }

    start();

    return {
        "grab_focus": grab_focus,
        "lose_focus": lose_focus,
        "close": close,
        "init_clipboard": init_clipboard,
        "destroy_clipboard": destroy_clipboard
    };
};
