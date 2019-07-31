(function() {
    var pageLoaded = false;
    var wr_msg_handler = '___$wr_msg_handler___$$';
    var handler = null;
    var remoteQ = [];

    function WSHandler(_user, _coll, _rec, _host, _on_open, _on_message) {
        this.user = _user;
        this.coll = _coll;
        this.rec = _rec;
        this.host = _host;

        this.ws = null;
        this.reinitWait = null;
        this.useWS = false;

        this.errCount = 0;

        this.on_open = _on_open;
        this.on_message = _on_message;

        if (!_host) {
            this.host = window.location.host;
        }

        this.initWS();
    }

    WSHandler.prototype.initWS = function() {
        this.reinitWait = null;

        var url = window.location.protocol == "https:" ? "wss://" : "ws://";
        //var url = "ws://";
        url += this.host + "/_client_ws_cont?";
        url += "user=" + this.user + "&coll=" + this.coll;

        if (this.rec && this.rec != "*") {
            url += "&rec=" + this.rec;
        }
        url += "&cont_browser=1";

        try {
            this.ws = new WebSocket(url);

            this.ws.addEventListener("open", this.ws_open.bind(this));
            this.ws.addEventListener("message", this.ws_received.bind(this));
            this.ws.addEventListener("close", this.ws_closed.bind(this));
            this.ws.addEventListener("error", this.ws_errored.bind(this));
        } catch (e) {
            this.useWS = false;
        }
    }

    WSHandler.prototype.ws_open = function() {
        this.useWS = true;
        this.errCount = 0;

        if (this.on_open) {
            this.on_open();
        }
    }

    WSHandler.prototype.ws_errored = function() {
        this.useWS = false;

        if (this.reinitWait != null) {
            return;
        }

        if (this.errCount < 5) {
            this.errCount += 1;
            this.reinitWait = setTimeout(this.initWS.bind(this), 2000);
        }
    }

    WSHandler.prototype.ws_closed = function() {
        this.useWS = false;

        if (this.reinitWait != null) {
            return;
        }

        this.reinitWait = setTimeout(this.initWS.bind(this), 5000);
    }

    WSHandler.prototype.send = function(msg) {
        if (!this.useWS) {
            return false;
        }
        msg.ws_type = msg.wb_type;
        delete msg.wb_type;
        this.ws.send(JSON.stringify(msg));
        return true;
    }

    WSHandler.prototype.ws_received = function(event) {
        if (!this.on_message) {
            return;
        }
        var msg = JSON.parse(event.data);
        msg.wb_type = msg.ws_type;
        delete msg.ws_type;
        this.on_message(msg);
    }

    function addCookie(name, value, domain) {
        var msg = {"wb_type": "addcookie",
                   "name": name,
                   "value": value,
                   "domain": domain}

        return sendAppMsg(msg);
    }

    function addSkipReq(url) {
        var msg = {"wb_type": "skipreq",
                   "url": url
                  }

        return sendAppMsg(msg);
    }

    function sendReqPatch(url) {
        var msg = {"wb_type": "req_switch",
                   "url": url
                  }

        return sendAppMsg(msg);
    }

    function sendPageMsg(isAdd) {
        if (window != window.top) {
          return;
        }

        var msg = {
            "url": window.location.href,
            "ts": wbinfo.timestamp,
            "request_ts": wbinfo.request_ts,
            "is_live": wbinfo.is_live,
            "title": document.title,
            "readyState": document.readyState,
            "browser": wbinfo.curr_browser,
        };

        if (!pageLoaded) {
            msg.wb_type = "load";
            msg.newPage = isAdd;
            pageLoaded = true;
        } else {
            msg.wb_type = "replace-url";
        }
        if (document.hidden) {
          return;
        }
        msg.visible = true;

        return sendAppMsg(msg);
    }

    function receiveAppMsg(msg) {
        switch (msg.wb_type) {
            case "status":
                break;

            case "replace-url":
                if (!document.hidden && msg.url != window.location.href) {
                    if (msg["new"]) {
                        window.open(msg.url);
                    } else {
                        window.location.href = msg.url;
                    }
                }
                break;

            case "behavior":
                sendLocalMsg(msg);
                break;

            case "reload":
                window.location.reload();
                break;

            default:
                console.log(msg);
        }
    }

    function sendAppMsg(msg) {
        if (handler) {
            handler.send(msg);
        } else {
            remoteQ.push(msg);
        }
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

            while (remoteQ.length) {
              sendAppMsg(remoteQ.shift());
            }
        }

        if (!window[wr_msg_handler]) {
            window[wr_msg_handler] = new WSHandler(wbinfo.proxy_user, wbinfo.proxy_coll, wbinfo.proxy_rec, wbinfo.proxy_magic,
                                                   on_init, receiveAppMsg);
            handler = window[wr_msg_handler];
        } else {
            handler = window[wr_msg_handler];
            handler.on_message = receiveAppMsg;
            on_init();
        }
    });

    window.addEventListener('hashchange', function(event) {
        var msg = {"wb_type": "hashchange",
                   "hash": window.location.hash
                  }

        sendAppMsg(msg);
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

        switch (message.wb_type) {
            case "skipreq":
            case "patch_req":
            case "behaviorStep":
            case "behaviorDone":
                sendAppMsg(message);
                break;
        }
    }

    window.addEventListener("__wb_from_event", localEvent);

})();
