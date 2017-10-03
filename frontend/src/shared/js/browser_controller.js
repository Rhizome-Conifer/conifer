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

    var clipEvents = ['change', 'keyup', 'paste'];
    var target_div_obj = document.querySelector(target_div);


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
                WebUtil.load_scripts({
                    'core': ["base64.js", "websock.js", "des.js", "input/keysymdef.js",
                             "input/xtscancodes.js", "input/util.js", "input/devices.js",
                             "display.js", "inflator.js", "rfb.js", "input/keysym.js"]
                });
            }).catch(err => console.log(err));
        }

        // Countdown updater
        if (init_params.on_countdown) {
            setInterval(update_countdown, 1000);
        }

        init_html();

        setup_browser();

        init_clipboard();
    }

    function close() {
        destroy_clipboard();

        var cnvs = canvas();
        var _screen = screen();
        _screen.removeEventListener('blur', lose_focus);
        _screen.removeEventListener('mouseleave', lose_focus);
        _screen.removeEventListener('mouseenter', grab_focus);
        cnvs.removeEventListener('click', grab_focus);

        for (var i = 0; i < controllerScripts.length; i++) {
            document.head.removeChild(controllerScripts[i]);
        }

        document.removeEventListener("visibilitychange", visibilityChangeCB);
    }

    function clipHandler(evt) {
        var text = document.querySelector(init_params.clipboard).value;

        if (connected && rfb && lastText != text) {
            rfb.clipboardPasteFrom(text);
            lastText = text;
        }
    }

    function init_clipboard() {
        if (!init_params.clipboard) {
            return;
        }

        var lastText = undefined;

        for (var i = 0; i < clipEvents.length; i++) {
            document.querySelector(init_params.clipboard).addEventListener(clipEvents[i], clipHandler);
        }
    }

    function destroy_clipboard() {
        for (var i = 0; i < clipEvents.length; i++) {
            document.querySelector(init_params.clipboard).removeEventListener(clipEvents[i], clipHandler);
        }
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

    function getHeaderHeight() {
        var hh = document.querySelector('header').getBoundingClientRect().height;
        hh += document.querySelector('.wr-controls').getBoundingClientRect().height;
        return hh;
    }

    function init_html() {
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

        // calculate dimensions
        var hh = getHeaderHeight();
        var w, h;
        if (!init_params.fill_window) {
            w = window.innerWidth * 0.96;
            h = window.innerHeight - (25 + hh);
        } else {
            w = window.innerWidth;
            h = window.innerHeight;
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

        // expects json response
        fetch(init_url)
            .then(function (res) { return res.json(); })
            .then(function (data) {
                waiting_for_container = false;
                handle_browser_response(data);
            })
            .catch(function (err) {
                console.log('fetch error', err);
                waiting_for_container = false;

                if (!err || err.status !== 404) {
                    getMsgDiv().innerHTML = 'Reconnection to Remote Browser...';

                    if(retryCount++ < maxRetry) {
                        setTimeout(init_browser, 1000);
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
        console.log('handle_browser_response', data);

        if (data.cmd_host && data.vnc_host) {
            cmd_host = data.cmd_host;
            vnc_host = data.vnc_host;

            end_time = parseInt(Date.now() / 1000, 10) + data.ttl;

            vnc_pass = data.vnc_pass;

            if (init_params.audio) {
                if (data.audio == "opus") {
                    doAudio(data);
                } else if (data.audio == "raw") {
                    doAudioRaw(data);
                }
            }

            if (init_params.on_event) {
                init_params.on_event("init", data);
            }

            setTimeout(try_init_vnc, 1000);

        } else if (data.queue != undefined) {
            var msg = "Waiting for empty slot... ";
            if (data.queue == 0) {
                msg += "<b>You are next!</b>";
            } else {
                msg += "At most <b>" + data.queue + " user(s)</b> ahead of you";
            }
            getMsgDiv().innerHTML = msg;

            setTimeout(init_browser, 3000);
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
            setTimeout(init_browser, 500);
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
        var hh = getHeaderHeight();
        var c = canvas();
        var ch = c.getBoundingClientRect().height;
        var cw = c.getBoundingClientRect().width;

        if (!init_params.fill_window) {
            c.style.marginLeft = ((window.innerWidth - cw)/2) + 'px';
            c.style.marginTop = ((window.innerHeight - (hh + ch + 25))/2) + 'px';
        }
    }

    function clientResize() {
        var hh = getHeaderHeight();
        var w, h;

        if (init_params.fill_window) {
            w = window.innerWidth;
            h = window.innerHeight;
        } else {
            w = Math.round(window.innerWidth * 0.96);
            h = Math.round(window.innerHeight - (25 + hh));
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
        if (init_params.clipboard) {
            document.querySelector(init_params.clipboard).value = text;
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


    function get_ws_url(browser_info) {
        var ws_url;

        ws_url = (window.location.protocol == "https:" ? "wss:" : "ws:");

        if (init_params.proxy_ws) {
            var audio_port = browser_info.cmd_host.split(":")[1];
            ws_url += window.location.host + "/" + init_params.proxy_ws + audio_port;
        } else {
            ws_url += browser_info.cmd_host + "/audio_ws";
        }

        return ws_url;
    }

    function doAudio(browser_info) {
        var mime_type = 'audio/webm; codecs="opus"';
        var audio_ws = undefined;

        var buffQ = [];
        var firstBuffer = undefined;
        var source = undefined;
        var err_count = 0;
        var initing = false;

        var ws_url = get_ws_url(browser_info);

        function createSource() {
            if (initing) {
                console.log("already initing");
                return;
            }

            initing = true;

            var ms = new MediaSource();
            ms.addEventListener("sourceopen", openSource);
            ms.addEventListener("error", restart);

            var sound = new Audio();
            sound.src = URL.createObjectURL(ms);
            sound.autoplay = true;
            sound.load();
            sound.play();
        }

        function openSource() {
            var new_source = undefined;

            try {
                new_source = this.addSourceBuffer(mime_type);
            } catch (e) {
                console.log("Audio Error: " + e);
                return;
            }

            new_source.mode = "sequence";
            new_source.timestampOffset = 0;
            new_source.addEventListener("error", restart);
            new_source.addEventListener("updateend", update_next);
            if (firstBuffer) {
                try {
                    new_source.appendBuffer(firstBuffer);
                } catch (e) {
                    console.log("Audio Error: " + e);
                }
            }
            source = new_source;
            initing = false;
        }

        function restart(e) {
            source = undefined;

            if (err_count == 0) {
                setTimeout(createSource, 500);
            }

            err_count++;
        }

        function update_next() {
            if (!buffQ.length || !source) {
                return;
            }

            buffer = buffQ.shift();

            if (!firstBuffer) {
                firstBuffer = buffer;
            }

            try {
                source.appendBuffer(buffer);
                err_count = 0;
            } catch (e) {
                console.log(e);
                restart();
            }
        }

        function close_ws() {
            audio_ws.removeEventListener("open", ws_open);
            audio_ws.removeEventListener("message", ws_message);
            audio_ws.removeEventListener('error', ws_error);
        }

        function init_ws() {
            audio_ws = new WebSocket(ws_url);
            audio_ws.binaryType = 'arraybuffer';
            audio_ws.addEventListener("open", ws_open);
            audio_ws.addEventListener("message", ws_message);
            audio_ws.addEventListener('error', ws_error);
        }

        function ws_open(event) {
            createSource();
        }

        function ws_message(event) {
            //var buffer = new Uint8Array(event.data);
            var buffer = event.data;

            if (!source) {
                console.log("no source, dropping audio");
                if (!initing) {
                    createSource();
                }
                return;
            }

            if (buffQ.length < 5) {
                buffQ.push(buffer);
            } else {
                console.log("dropping audio");
            }

            if (!source.updating) {
                update_next();
            }
        }

        function ws_error(e) {
            //console.log(e);
            setTimeout(init_ws, 500);
        }

        init_ws();
    }

    function doAudioRaw(data) {
        var audio_port = data.cmd_host.split(":")[1];
        var context = undefined;
        var source = undefined;
        var script_proc = undefined;


        var circ_buff = new Float32Array(4096 * 8);
        var circ_buff_write_ptr = 0;
        var circ_buff_read_ptr = 0;

        var ws_url = get_ws_url(browser_info);

        function init_ws() {
            audio_ws = new WebSocket(ws_url);
            audio_ws.binaryType = 'arraybuffer';
            audio_ws.addEventListener("open", ws_open);
            audio_ws.addEventListener("message", ws_message);
            audio_ws.addEventListener('error', ws_error);
        }

        function ws_open(event) {
            var ctx = (window.AudioContext || window.webkitAudioContext);
            context = new ctx();

            script_proc = context.createScriptProcessor(4096, 1, 1);
            script_proc.addEventListener("audioprocess", process_audio);

            source = context.createBufferSource();
            source.connect(script_proc);
            script_proc.connect(context.destination);
            //source.start(0);
        }

        function process_audio(event) {
            var input = event.inputBuffer;
            var output = event.outputBuffer;

            //if (circ_buff_read_ptr >= circ_buff_write_ptr) {
            //}

            var data = output.getChannelData(0);

            if ((output.length + circ_buff_read_ptr) <= circ_buff.length) {
                data.set(circ_buff.slice(circ_buff_read_ptr, circ_buff_read_ptr + output.length));
            } else {
                var rem_len = (circ_buff_read_ptr + output.length) - output.length;
                data.set(circ_buff.slice(circ_buff_read_ptr, circ_buff.length));
                data.set(circ_buff.slice(0, rem_len), circ_buff.length - circ_buff_read_ptr);
            }
            circ_buff_read_ptr = (circ_buff_read_ptr + output.length) % circ_buff.length;
        }

        function ws_message(event) {
            if (!source) {
                return "dropping, no source";
            }

            var float_array = fillFloatArray(event.data);

            if ((float_array.length + circ_buff_write_ptr) <= circ_buff.length) {
                circ_buff.set(float_array, circ_buff_write_ptr);
            } else {
                var split = circ_buff.length - circ_buff_write_ptr;
                circ_buff.set(float_array.slice(0, split), circ_buff_write_ptr);
                circ_buff.set(float_array.slice(split), 0);
            }
            circ_buff_write_ptr = (circ_buff_write_ptr + float_array.length) % circ_buff.length;
        }

        function fillFloatArray(array) {
            array = new Uint8Array(array);
            var float_array = new Float32Array(array.length);

            for (var i = 0; i < float_array.length; i++) {
                float_array[i] = array[i] / 255.0;
            }

            return float_array;

            //var buffer = context.createBuffer(1, float_array.length, 22050);
            //buffer.getChannelData(0).set(float_array);
            //source.buffer = buffer;
        }

        function ws_error(event) {
            setTimeout(init_ws, 500);
        }

        init_ws();
    }

    start();

    return {"grab_focus": grab_focus,
            "lose_focus": lose_focus,
            "close": close};
};
