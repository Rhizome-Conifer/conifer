(function() {
    var ws;
    var useWS = false;
    var errCount = 0;
    var reinitWait = null;

    var user;
    var coll;
    var rec;
    var host;

    var on_openned;

    var is_autoscroll = false;

    var json_stringify = JSON.stringify;
    var json_parse = JSON.parse;

    var start = function(_user, _coll, _rec, _host, _on_openned) {
        user = _user;
        coll = _coll;
        rec = _rec;
        host = _host;

        on_openned = _on_openned;

        if (!host) {
            host = window.location.host;
        }

        initWS();
    }

    var initWS = function() {
        reinitWait = null;

        var url = window.location.protocol == "https:" ? "wss://" : "ws://";
        //var url = "ws://";
        url += host + "/_client_ws_cont?";
        url += "user=" + user + "&coll=" + coll;

        if (rec && rec != "*") {
            url += "&rec=" + rec;
        }
        url += "&cont_browser=1";

        try {
            ws = new WebSocket(url);

            ws.addEventListener("open", ws_openned);
            ws.addEventListener("message", ws_received);
            ws.addEventListener("close", ws_closed);
            ws.addEventListener("error", ws_errored);
        } catch (e) {
            useWS = false;
        }
    }

    function ws_openned() {
        useWS = true;
        errCount = 0;

        if (on_openned) {
            on_openned();
        }
    }

    function ws_errored() {
        useWS = false;

        if (reinitWait != null) {
          return;
        }

        if (errCount < 5) {
            errCount += 1;
            reinitWait = setTimeout(initWS, 2000);
        }
    }

    function ws_closed() {
        useWS = false;

        if (reinitWait != null) {
          return;
        }

        reinitWait = setTimeout(initWS, 5000);
    }

    function addCookie(name, value, domain) {
        var msg = {"ws_type": "addcookie",
                   "name": name,
                   "value": value,
                   "domain": domain}

        return sendMsg(msg);
    }

    function addSkipReq(url) {
        var msg = {"ws_type": "skipreq",
                   "url": url
                  }

        return sendMsg(msg);
    }

    function sendReqPatch(url) {
        var msg = {"ws_type": "req_switch",
                   "url": url
                  }

        return sendMsg(msg);
    }

    function sendPageMsg(isAdd) {
        var page = {
                 "url": window.location.href,
                 "timestamp": wbinfo.timestamp,
                 "title": document.title,
                 "browser": wbinfo.curr_browser,
        };

        var msg = {"page": page}

        if (isAdd) {
            msg["ws_type"] = "page";
            msg["visible"] = !document.hidden;
        } else {
            msg["ws_type"] = "remote_url";
        }

        return sendMsg(msg);
    }

    function sendLinks(links) {
        var msg = {"ws_type": "extract-resp"};

        msg.phase = "start";
        sendMsg(msg);

        msg.phase = "url";

        for (var i = 0; i < links.length; i++) {
            msg.url = links[i];
            sendMsg(msg);
        }

        doneLoop();
        setInterval(doneLoop, 10000);
    }

    function doneLoop() {
        var msg = {"ws_type": "extract-resp"};

        msg.phase = "end";

        if (window.wbinfo) {
            msg.url = window.wbinfo.url;
        } else {
            msg.url = document.location.href;
        }

        return sendMsg(msg);
    }

    function sendMsg(msg) {
        if (!hasWS()) {
            return false;
        }

        ws.send(json_stringify(msg));
        return true;
    }
 
    function ws_received(event)
    {
        var msg = json_parse(event.data);
        
        switch (msg.ws_type) {
            case "status":
                break;

            case "set_url":
                if (!document.hidden && msg.url != window.location.href) {
                    if (msg["new"]) {
                        window.open(msg.url);
                    } else {
                        window.location.href = msg.url;
                    }
                }
                break;

            case "autoscroll":
                if (!document.hidden) {
                    sendLocalMsg({"wb_type": "autoscroll",
                                  "start": !is_autoscroll,
                                  "timeout": 25000});

                    is_autoscroll = !is_autoscroll;
                }
                break;

            case "switch":
                window.location.reload();
                break;

            case "snapshot-req":
                if (!document.hidden) {
                    sendLocalMsg({"wb_type": "snapshot-req"});
                }
                break;

            case "extract-req":
                sendLinks(extractLinks());
                break;

            default:
                console.log(msg);
        }
    }

    function hasWS() {
        return useWS;
    }

    function sendLocalMsg(data) {
        window.dispatchEvent(new CustomEvent("__wb_to_event", {"detail": data}));
    }

    // INIT
    window.addEventListener("DOMContentLoaded", function() {
        if (window != window.top) {
            return;
        }

        function on_init() {
            sendPageMsg(wbinfo.is_live || wbinfo.proxy_mode == "extract");
        }

        start(wbinfo.proxy_user, wbinfo.proxy_coll, wbinfo.proxy_rec, wbinfo.proxy_magic, on_init);
    });

    // VIZ CHANGE
    document.addEventListener("visibilitychange", function() {
        if (!document.hidden) {
            sendPageMsg(false);
        }
    });

    function localEvent(event) {
        var message = event.detail;
        if (!message) {
            return;
        }

        if (message.wb_type == "skipreq" ||
            message.wb_type == "patch_req" ||
            message.wb_type == "autoscroll_resp") {

            message.ws_type = message.wb_type;
            delete message.wb_type;

            sendMsg(message);
        } else if (message.wb_type == "snapshot") {
            postSnapshot(message);
        }
    }

    function postSnapshot(message) {
        var url = window.location.protocol + "//" + wbinfo.proxy_magic;
        url += "/_snapshot_cont?";

        for (var k in message.params) {
            var v = message.params[k];
            if (v) {
                url += encodeURIComponent(k) + "=" + encodeURIComponent(v) + "&";
            }
        }

        var xhr = new XMLHttpRequest(url);
        xhr.open("POST", url);
        xhr.setRequestHeader("Content-Type", "text/plain");
        xhr.onreadystatechange = function () {
            if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
                var data = json_parse(xhr.responseText);
                var msg = data.snapshot;
                if (msg) {
                    msg["ws_type"] = "snapshot";
                    sendMsg(msg);
                }
            }
        };

        xhr.send(message.contents);
    }

    window.addEventListener("__wb_from_event", localEvent);

    function extractLinks(query) {
        if (!query) {
            query = "a[href]";
        }

        function getLinks(query, win, store) {
            try {
                var results = win.document.querySelectorAll(query);
            } catch (e) {
                console.log("skipping foreign frame");
                return;
            }

            for (var i = 0; i < results.length; i++) {
                var link = results[i].href;
                if (!link) {
                    continue;
                }

                if (link.indexOf("http:") != 0 && link.indexOf("https:") != 0) {
                    continue;
                }

                store[link] = 1;
            }

            for (var i = 0; i < win.frames.length; i++) {
                getLinks(query, win.frames[i], store);
            }
        }

        var link_map = {};

        getLinks(query, window, link_map);

        return Object.keys(link_map);
    }

    window.extractLinks = extractLinks;

})();
