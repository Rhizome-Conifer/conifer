(function() {
    var ws;
    var useWS = false;
    var errCount = 0;

    var user;
    var coll;
    var rec;
    var host;

    var on_openned;

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
            ws.addEventListener("error", ws_closed);
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

    function ws_closed() {
        useWS = false;
        if (errCount < 5) {
            errCount += 1;
            setTimeout(initWS, 2000);
        }
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
 
    function addPage(page) {
        var msg = {"ws_type": "page",
                   "page": page}

        return sendMsg(msg);
    }

    function sendMsg(msg) {
        if (!hasWS()) {
            return false;
        }

        ws.send(JSON.stringify(msg));
        return true;
    }
 
    function ws_received(event)
    {
        var msg = JSON.parse(event.data);
        
        switch (msg.ws_type) {
            case "status":
                break;

            default:
                console.log(msg);
        }
    }

    function hasWS() {
        return useWS;
    }

    // INIT
    window.addEventListener("DOMContentLoaded", function() {
        var on_init = undefined;

        if (window != window.top) {
            return;
        }

        if (wbinfo.proxy_mode == "record" || wbinfo.proxy_mode == "patch") {
            on_init = function() {
                var page = {"url": wbinfo.url,
                            "timestamp": wbinfo.timestamp,
                            "title": document.title,
                            "visible": !document.hidden,
                           };

                addPage(page);
            }
        }

        start(wbinfo.proxy_user, wbinfo.proxy_coll, wbinfo.proxy_rec, wbinfo.proxy_magic, on_init);
    });

    // VIZ CHANGE
    document.addEventListener("visibilitychange", function() {
        if (!document.hidden) {
            sendMsg({"ws_type": "remote_url",
                     "url": window.location.href,
                     "timestamp": wbinfo.timestamp,
                     "title": document.title
                    });
        }
    });

})();
