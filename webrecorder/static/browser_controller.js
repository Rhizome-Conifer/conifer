if (window.STATIC_PREFIX) {
    window.INCLUDE_URI = window.STATIC_PREFIX + "novnc/";
} else{
    window.INCLUDE_URI = "/static/novnc/";
}

var cmd_host = undefined;
var vnc_host = undefined;

var connected = false;
var ping_id = undefined;
var ping_interval = undefined;

var page_change = false;

var pingsock = undefined;
var fail_count = 0;
var curr_hosts = undefined;

var end_time = undefined;
var cid = undefined;
var waiting_for_container = false;

// Load supporting scripts
Util.load_scripts(["webutil.js", "base64.js", "websock.js", "des.js",
                   "keysymdef.js", "keyboard.js", "input.js", "display.js",
                   "inflator.js", "rfb.js", "keysym.js"]);

$(function() {
    function init_container() {
        var params = {"url": url, "ts": curr_ts, "browser": browser, "state": "ping"};

        params['width'] = Math.max($(window).width() - 40, 800);
        params['height'] = Math.max($(window).height() - 120, 600);
        params['width'] = parseInt(params['width'] / 16) * 16;
        params['height'] = parseInt(params['height'] / 16) * 16;
        params['upsid'] = upsid;

        function send_request() {
            if (waiting_for_container) {
                return;
            }

            waiting_for_container = true;

            //var init_url = "/api/v1/browsers/init_browser?" + $.param(params);
            var init_url = "/_init_browser?" + $.param(params);

            $.getJSON(init_url, handle_browser_response)
            .fail(function() {
                fail_count++;

                if (fail_count <= 3) {
                    $("#browserMsg").text("Retrying browser init...");
                    setTimeout(send_request, 5000);
                } else {
                    $("#browserMsg").text("Failed to init browser... Please try again later");
                }
                $("#browserMsg").show();
            }).complete(function() {
                waiting_for_container = false;
            });
        }

        function handle_browser_response(data) {
            params.id = data.id;

            if (data.cmd_host && data.vnc_host) {
                cmd_host = data.cmd_host;
                vnc_host = data.vnc_host;

                RecordingSizeWidget.setBrowserIP(data.ip);

                $("#currLabel").html("Loading <b>" + url + "</b>");
                window.setTimeout(do_init, 1000);

            } else if (data.queue != undefined) {
                var msg = "Waiting for empty slot... ";
                if (data.queue == 0) {
                    msg += "<b>You are next!</b>";
                } else {
                    msg += "At most <b>" + data.queue + " user(s)</b> ahead of you";
                }
                $("#browserMsg").html(msg);

                window.setTimeout(send_request, 3000);
            }
        }

        send_request();
    }

    function do_init() {
        var res = do_vnc();
        if (!res) {
            window.setTimeout(do_init, 1000);
        }
    }

    function lose_focus() {
        if (!rfb) return;
        rfb.get_keyboard().set_focused(false);
        rfb.get_mouse().set_focused(false);
    }

    function grab_focus() {
        if (!rfb) return;
        rfb.get_keyboard().set_focused(true);
        rfb.get_mouse().set_focused(true);
    }

    $("#noVNC_screen").blur(lose_focus);
    $("#noVNC_screen").mouseleave(lose_focus);

    $("#noVNC_screen").mouseenter(grab_focus);

    $("#datetime").click(lose_focus);

    function update_replay_state() {
        var full_url = "/" + browser + "/" + curr_ts + "/" + url;

        window.history.replaceState({}, "", full_url);
    }

    function establish_ping_sock()
    {
        try {
            pingsock = new WebSocket("wss://" + cmd_host + "/pingsock");
        } catch (e) {
            console.log(e);
        }

        pingsock.onerror = function(e) {
            //console.log("Sock Error");
            pingsock = undefined;
            window.setTimeout(establish_ping_sock, 1000);
        }
        pingsock.onclose = function(e) {
            //console.log("Sock Close");
            pingsock = undefined;
        }
        pingsock.onmessage = function(e) {
            handle_data_update(JSON.parse(e.data));

            // hide cursor for nextstep for now due to mouse issues
            if (browser == "WWW") {
                $("#noVNC_canvas").css("cursor", "none");
            }
        }
    }

    function format_date(date) {
        return date.toISOString().slice(0, -5).replace("T", " ");
    }

    function handle_data_update(data) {
        if (data.page_url && data.page_url_secs) {
            var date = new Date(data.page_url_secs * 1000);
            var date_time = format_date(date).split(" ");
            //$("#currLabel").html("Loaded <b>" + data.page_url + "</b> from <b>" + url_date + "</b>");
            $(".rel_message").hide();
            $("#curr-date").html(date_time[0]);
            $("#curr-time").html(date_time[1]);
            $("#curr-date-info").removeClass("loading");
            //url = data.page_url;
            if (page_change) {
                ping_interval = 10000;
                page_change = false;
            }
            if (sparkline) {
                sparkline.move_current(date);
            }
        }

        var any_data = false;

        if (data.hosts && data.hosts.length > 0) {
            if (data.hosts != curr_hosts) {
                //$("#statsHosts").empty();
                $("#statsHosts li").hide();
                $.each(data.hosts, function(i, host) {
                    //var elem = document.createElement("li");
                    //$(elem).text(host);
                    //$("#statsHosts").append(elem);
                    $("#statsHosts li[data-id='" + host + "']").show();
                });

                data.hosts = curr_hosts;
                $("#statsHostsWrap").show();
            }
            any_data = true;
        }

        if (data.urls) {
            $("#statsCount").text(data.urls);
            $("#statsCountWrap").show();
            any_data = true;
        }

        if (data.min_sec && data.max_sec) {
            var min_date = new Date(data.min_sec * 1000);
            var max_date = new Date(data.max_sec * 1000);
            $(".rel_message").hide();
            $("#statsFrom").html(format_date(min_date).replace(" ", "<br>"));
            $("#statsTo").html(format_date(max_date).replace(" ", "<br>"));
            $("#statsSpanWrap").show();
            any_data = true;
        }

        if (any_data) {
            $(".session-info").show();
            $("#session-loading").hide();
        }

        if (data.ttl != undefined) {
            set_time_left(data.ttl);
        }

        //update_replay_state();
    }

    function set_time_left(time_left) {
        end_time = Math.floor(new Date().getTime() / 1000 + time_left);
    }


//    function ping() {
//        $.getJSON("http://" + cmd_host + "/ping?ts=" + curr_ts, handle_data_update)
//        .complete(function() {
//            ping_id = window.setTimeout(ping, ping_interval);
//        });
//    }

    var rfb;
    var resizeTimeout;


    function UIresize() {
        if (WebUtil.getQueryVar('resize', false)) {
            var innerW = window.innerWidth;
            var innerH = window.innerHeight;
            var controlbarH = $D('noVNC_status_bar').offsetHeight;
            var padding = 5;
            if (innerW !== undefined && innerH !== undefined)
                rfb.setDesktopSize(innerW, innerH - controlbarH - padding);
        }

        // client-side resize
        var hh = $('header').height();
        var c = $('#noVNC_canvas');
        var w = window.innerWidth * 0.96;
        var h = window.innerHeight - (25 + hh);

        var s = rfb._display.autoscale(w, h);
        var ch = c.height();
        var cw = c.width();
        c.css({
            marginLeft: (window.innerWidth - cw)/2,
            marginTop: (window.innerHeight - (hh + ch + 25))/2
        });
        rfb.get_mouse().set_scale(s);
    }

    function FBUComplete(rfb, fbu) {
        UIresize();
        rfb.set_onFBUComplete(function() { });
    }

    function onVNCCopyCut(rfb, text)
    {
        //$("#clipcontent").text(text);
    }

    function do_vnc() {
        try {
            rfb = new RFB({'target':       $D('noVNC_canvas'),
                           'encrypt':      WebUtil.getQueryVar('encrypt',
                                                               (window.location.protocol === "https:")),
                           'repeaterID':   WebUtil.getQueryVar('repeaterID', ''),
                           'true_color':   WebUtil.getQueryVar('true_color', true),
                           'local_cursor': WebUtil.getQueryVar('cursor', true),
                           'shared':       WebUtil.getQueryVar('shared', true),
                           'view_only':    WebUtil.getQueryVar('view_only', false),
                           'onUpdateState':  updateState,
                           'onClipboard': onVNCCopyCut,
                           'onFBUComplete': FBUComplete});
        } catch (exc) {
            //updateState(null, 'fatal', null, 'Unable to create RFB client -- ' + exc);
            console.warn(exc);
            return false; // don't continue trying to connect
        }

        var hostport = vnc_host.split(":");
        var host = hostport[0];
        var port = hostport[1];
        var password = "secret";
        var path = "websockify";

        try {
            rfb.connect(host, port, password, path);
        } catch (exc) {
            console.warn(exc);
            return false;
        }

        return true;
    }

    function updateState(rfb, state, oldstate, msg) {
        if (state == "failed" || state == "fatal") {
            // if not connected yet, attempt to connect until succeed
            if (!connected) {
                window.setTimeout(do_vnc, 1000);
            }
        } else if (state == "disconnected") {
            if (connected) {
                connected = false;
                $("#noVNC_canvas").hide();
                $("#browserMsg").show();

                if (ping_id) {
                    window.clearInterval(ping_id);
                }

                init_container();
            }
        } else if (state == "normal") {
            $("#noVNC_canvas").show();
            $("#browserMsg").hide();

            connected = true;
            ping_interval = 1000;
            page_change = true;
            fail_count = 0;

            // start ping at regular intervals
            //ping_id = window.setTimeout(ping, ping_interval);
            //establish_ping_sock();
        }

        //        var s, sb, cad, level;
        //        s = $D('noVNC_status');
        //        sb = $D('noVNC_status_bar');
        //        cad = $D('sendCtrlAltDelButton');
        //        switch (state) {
        //            case 'failed':       level = "error";  break;
        //            case 'fatal':        level = "error";  break;
        //            case 'normal':       level = "normal"; break;
        //            case 'disconnected': level = "normal"; break;
        //            case 'loaded':       level = "normal"; break;
        //            default:             level = "warn";   break;
        //        }
        //
        //        if (state === "normal") {
        //            cad.disabled = false;
        //        } else {
        //            cad.disabled = true;
        //            xvpInit(0);
        //        }
        //
        //        if (typeof(msg) !== 'undefined') {
        //            sb.setAttribute("class", "noVNC_status_" + level);
        //            s.innerHTML = msg;
        //        }
        console.log(msg);
    }

    window.onresize = function () {
        // When the window has been resized, wait until the size remains
        // the same for 0.5 seconds before sending the request for changing
        // the resolution of the session
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function(){
            UIresize();
        }, 500);
    };

    // Browser navigate
    $("#browser-selector td:not(:empty)").click(function(e) {
        var path = $(this).attr("data-path");
        var full_url = window.location.origin + "/" + path + "/" + curr_ts + "/" + url;
        window.location.href = full_url;
    });


    // Update request dt
    window.on_change_curr_ts = function(ts) {
        if (pingsock) {
            pingsock.send(JSON.stringify({"ts": ts}));
            $(".rel_message").show();
        }
    }

    function update_countdown() {
        if (!end_time) {
            return;
        }
        var curr = Math.floor(new Date().getTime() / 1000);
        var secdiff = end_time - curr;

        if (secdiff < 0) {
            window.location.href = window.location.origin + "/";
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

        $("#expire").text(min + ":" + sec);
    }

    // Countdown updater
    cid = setInterval(update_countdown, 1000);

    // INIT
    init_container();

    if (browser) {
        var browser_info = $("#browser-selector td[data-path='" + browser + "']");
        browser_info.addClass("selected");
        $("#about-link").attr("href", browser_info.attr("data-about-url"));
        $(".about-browser").show();
    }
});




