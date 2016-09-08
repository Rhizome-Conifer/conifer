// Static Snapshots

(function() {
    var counter = 0;

    function process(win, topinfo, top_page, top_frame) {
        for (var i = 0; i < win.frames.length; i++) {
            var url = process(win.frames[i], topinfo, false, top_frame);

            win.frames[i].frameElement.setAttribute("data-src-target", url);
        }

        return addSnapshot(win, topinfo, top_page, top_frame);
    }

    function addSnapshot(win, topinfo, top_page, top_frame) {
        if (win.WB_wombat_location && win.WB_wombat_location.href) {
            url = win.WB_wombat_location.href;
            //url = url.replace(/^(https?:\/\/)/, '$1snapshot:')

        } else if (win.document.all.length <= 3) {
            url = "about:blank";
            return url;
        } else {
            url = "http://embed.snapshot/" + counter;
            counter++;
        }

        var contents = new XMLSerializer().serializeToString(win.document);

        var params = {prefix: topinfo.prefix,
                      url: url,
                      top_url: topinfo.url,
                      top_ts: topinfo.timestamp,
                      title: win.document.title,
                     }

        var data = {params: params,
                    wb_type: "snapshot",
                    top_page, top_page,
                    contents: contents}
 
        top_frame.postMessage(data, "*");

        return url;
    }

    function doSnapshot(event) {
        if (!event.data || event.source != window.__WB_top_frame) {
            return;
        }

        var message = event.data;

        if (message.wb_type == "snapshot-req") {
            process(window, window.wbinfo, true, window.__WB_top_frame);
        }
    }

    window.addEventListener("message", doSnapshot);

}());


// Password Check


(function() {
    var pass_form_targets = {};

    function exclude_password_targets() {
        var passFields = document.querySelectorAll("input[type=password]");

        for (var i = 0; i < passFields.length; i++) {
            var input = passFields[i];

            if (input && input.form && input.form.action) {
                var form_action = input.form.action;

                if (window._wb_wombat) {
                    form_action = window._wb_wombat.extract_orig(form_action);
                }

                if (!form_action) {
                    return;
                }

                // Skip password check if checked within last 5 mins
                if (pass_form_targets[form_action] && ((Date.now() / 1000) - pass_form_targets[form_action]) < 300) {
                    return;
                }

                var req = new XMLHttpRequest();
                req._no_rewrite = true;

                req.addEventListener("load", function() {
                    pass_form_targets[form_action] = Date.now() / 1000;
                });
         
                var url = "/_skipreq?url=" + encodeURIComponent(form_action);
                req.open("GET", url);
                req.send();
            }
        }
    }

    function startCheck() {
        if (!window.wbinfo.is_live) {
            return;
        }

        exclude_password_targets();
        setInterval(exclude_password_targets, 4900);
    }

    window.addEventListener("DOMContentLoaded", startCheck);
})();


// Autoscroll

(function() {
    var sid = undefined;
    var scroll_timeout = 2000;
    var doneCallback = undefined;
    var lastScrolled = undefined;

    function scroll() {
        if (window.scrollY + window.innerHeight < Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)) {
            window.scrollBy(0, 200);
            lastScrolled = Date.now();
        } else if (!lastScrolled || (Date.now() - lastScrolled) > scroll_timeout) {
            stop();
        };
    }
    
    function start(done, timeout) {
        doneCallback = done;

        lastScrolled = Date.now();
        
        if (timeout) {
            scroll_timeout = timeout;
        }
        
        sid = setInterval(scroll, 100);
    }
    
    function stop(skipCallback) {
        if (sid == undefined) {
            return;
        }
        clearInterval(sid);
        sid = undefined;
        if (doneCallback && !skipCallback) {
            doneCallback();
        }
    }
    
    function isDone() {
        return sid == undefined;
    }
    
    function setDoneCallback(donecb) {
        doneCallback = donecb;
    }

    function receiveEvent() {
        if (!event.data || event.source != window.__WB_top_frame) { 
            return; 
        } 

        var message = event.data; 

        if (!message.wb_type) { 
            return; 
        }

        function sendDone() {
            window.__WB_top_frame.postMessage({wb_type: "autoscroll", on: false}, "*");
        }

        if (message.wb_type == "autoscroll") {
            if (message.start) {
                start(sendDone, message.timeout);
            } else {
                stop(message.skipCallback);
            }
        }
    }

    window.addEventListener("message", receiveEvent);
    
    return {"start": start, "stop": stop, "isDone": isDone, "setDoneCallback": setDoneCallback};
    
})();

