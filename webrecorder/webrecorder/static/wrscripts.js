(function() {

    function addListener(callback) {
        if (wbinfo.proxy_magic) {
            window.addEventListener("__wb_to_event", callback);
        } else {
            window.addEventListener("message", callback);
        }
    }

    function getMessage(event) {
        if (wbinfo.proxy_magic) {
            return event.detail;
        } else {
            if (event.source != window.__WB_top_frame) {
                return;
            }
            return event.data;
        }
    }

    function sendMessage(data) {
        if (wbinfo.proxy_magic) {
            window.dispatchEvent(new CustomEvent("__wb_from_event", {"detail": data}));
        } else {
            window.__WB_top_frame.postMessage(data, "*", undefined);
        }
    }



    // Password Check

    (function() {
        var pass_form_targets = {};

        function exclude_password_targets() {
            var passFields = document.querySelectorAll("input[type=password]");

            for (var i = 0; i < passFields.length; i++) {
                var input = passFields[i];

                if (input && input.form && input.form.action) {
                    var form_action = input.form.action;

                    if (window._wb_wombat && window._wb_wombat.extract_orig) {
                        form_action = window._wb_wombat.extract_orig(form_action);
                    }

                    if (!form_action) {
                        return;
                    }

                    // Skip password check if checked within last 5 mins
                    if (pass_form_targets[form_action] && ((Date.now() / 1000) - pass_form_targets[form_action]) < 300) {
                        return;
                    }

                    sendMessage({wb_type: "skipreq", url: form_action});
                    pass_form_targets[form_action] = Date.now() / 1000;
                }
            }
        }

        function ready() {
            if (!window.wbinfo.is_live) {
                return;
            }

            exclude_password_targets();
            setInterval(exclude_password_targets, 4900);
        }

        window.addEventListener("DOMContentLoaded", ready);
    })();


    // Custom Behavior

    (function() {

        function doRun() {
            window.$WBBehaviorRunner$.autoRunWithDelay().then(function() {
                sendMessage({wb_type: "behaviorDone"});
            });
        }

        function receiveEvent(event) {
            var BEHAVIOR_API = "/api/v1/behavior/behavior?";

            var message = getMessage(event);
            if (!message) {
                return;
            }

            if (message.wb_type === "behavior") {
                // pause behavior if true
                var pause = !message.start;

                if (!pause && !window.$WBBehaviorRunner$) {
                    var url = BEHAVIOR_API;

                    // use name if specified, otherwise url if specified or just page url
                    if (message.name) {
                        url += "name=" + message.name;
                    } else {
                        url += "url=" + (message.url || wbinfo.url);
                    }

                    // full path for proxy
                    if (wbinfo.proxy_magic) {
                        url = window.location.protocol + "//" + wbinfo.proxy_magic + url;
                    }
                    var script = document.createElement("script");
                    script.onload = function() {

                        let resp = "behavior_failed";

                        if (window.$WBBehaviorRunner$) {
                          resp = "behavior_loaded";
                          setTimeout(doRun, 100);
                        }

                        sendMessage({"wb_type": resp,
                                     "url": window.location.href,
                                     "name": name});
                    }

                    script._no_rewrite = true;
                    script.setAttribute("src", url);
                    document.head.appendChild(script);
                } else if (!pause && window.$WBBehaviorRunner$) {
                    window.$WBBehaviorRunner$.unpause();
                } else if (pause && window.$WBBehaviorRunner$) {
                    window.$WBBehaviorRunner$.pause();
                }
            }
        }

        function ready() {
            addListener(receiveEvent);
        }

        window.addEventListener("DOMContentLoaded", ready);
    })();

})();

