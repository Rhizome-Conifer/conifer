$(function() {
    var cb = undefined;
    var params = {}
    params.static_prefix = "/static/browsers/";
    params.api_prefix = "/api/browsers";

    if (!window.location.port) {
        params.proxy_ws = "_websockify?port=";
    }

    params.on_countdown = function(seconds, countdownText) {
        if (seconds <= 300) {
            $("#browser-countdown-label").show();
            $("#browser-countdown").text(countdownText);
        }

        if (seconds <= 0) {
            reinit_browser();
        }
    }

    params.on_event = function(type, data) {
        if (type == "connect") {
            $("#message").hide();

            if (cb && document.activeElement && document.activeElement.tagName == "INPUT") {
                cb.lose_focus();
            }
        }

        //if (type == "reconnect") {
        //    $("#message").text("Connection closed due to inactivity");
        //    $("#message").show();
        //}

        if (type == "fail" || type == "expire") {
            reinit_browser();
        }
    }

    var msgSet = false;

    function reinit_browser() {
        if (window.curr_mode == "record") {
            if (msgSet) {
                return;
            }

            var collUrl = "/" + user + "/" + coll;
            var msg = "Sorry, the remote browser recording session has expired.<br/>";
            msg += "You can <a href='" + collUrl + "/" + rec + "'>view the recording</a> or <a href='" + collUrl + "/$new'>create a new recording</a>";
            $("#message").html(msg);
            $("#message").show();
            $("#browser").hide();
            msgSet = true;
            window.containerExpired = true;
            return;
        }

        var msg = "The remote browser session has expired, requesting a new browser";

        var url = "/_message?" + $.param({"message": msg,
                                          "msg_type": "warning"});

        // return to replay page, after setting the message
        $.getJSON(url).done(function() {
            if (window.curr_mode == "patch") {
                RouteTo.replayRecording(user, coll, cbrowserMod(), url);
            } else {
                window.location.reload();
            }
        });
    }

    params.inactiveSecs = window.inactiveSecs;
    params.clipboard = "#clipboard";
    params.fill_window = false;

    cb = new CBrowser(reqid, "#browser", params);

    $("#report-modal").on("shown.bs.modal", function () {
        cb.lose_focus();
    });

    $("input").on("click", function() {
        cb.lose_focus();
    });
});

