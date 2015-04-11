$(function() {
    $("#automate").change(function() {
        if ($("#automate").prop("checked")) {
            start_umbra();
            $("#automate-l").text("Automatic Scrolling Mode. Click to stop.");
        } else {
            stop_umbra();
            $("#automate-l").text("Automate!");
        }
    });
});


function get_behavior(host)
{
    //    var behavior_mapping = [
    //        [/(?:.*\.)?facebook.com$/, "facebook.js"],
    //        [/(?:.*\.)?flickr.com$/, "flickr.js"],
    //        [/(?:.*\.)?instagram.com$/, "instagram.js"],
    //        [/(?:.*\.)?vimeo.com$/, "vimeo.js"],
    //        [/.*/, "default.js"],
    //    ];
    //    
    //    for (var i = 0; i < behavior_mapping.length; i++) {
    //        var rule = behavior_mapping[i];
    //        if (host.match(rule[0])) {
    //            return rule[1];
    //        }
    //    }
    //    
    //    return undefined;

    return "default.js";
}

var listener_added = false;
var reload_time = 0;
var auto_is_loading = false;

function start_umbra()
{
    var frame = document.getElementById("iframe");

    if (!listener_added) {
        frame.addEventListener("load", auto_start_umbra);
        listener_added = true;
    }

    auto_start_umbra();
}

function auto_start_umbra()
{
    reload_time = Date.now();

    var frame = document.getElementById("iframe");
    var win = frame.contentWindow;
    var doc = win.document;

    if (!win.umbra_loaded) {
        if (!doc || !win.WB_wombat_location) {
            console.log("no doc or no wombat");
            auto_is_loading = false;
            return;
        }

        var file = get_behavior(win.WB_wombat_location.host);
        console.log("Matched: " + file);

        if (!file) {
            auto_is_loading = false;
            return;
        }

        var script_name = "/static/__shared/behaviors/" + file;

        var elem = doc.createElement("script");
        elem.src = script_name;
        elem._no_rewrite = true;
        doc.body.appendChild(elem);
        win.umbra_loaded = true;
        //console.log("umbra started");
    } else if (!win.umbraIntervalId) {
        //console.log("umbra restarted");
        win.umbraIntervalId = win.setInterval(win.umbraIntervalFunc, 100);
    }
    auto_is_loading = false;

    window.automation_wait = function() {
        if (auto_is_loading) {
            return true;
        }

        if (!win.umbra_loaded || !win.umbraBehaviorFinished) {
            if (((Date.now() - reload_time) / 1000) < 5) {
                return true;
            } else {
                return false;
            }
        }
        return !win.umbraBehaviorFinished();
    }
}

function stop_umbra()
{
    var frame = document.getElementById("iframe");
    var win = frame.contentWindow;

    if (listener_added) {
        frame.removeEventListener("load", auto_start_umbra);
        listener_added = false;
    }

    window.automation_wait = null;

    if (!win) {
        return "no iframe!";
    }

    if (win.umbraIntervalId) {
        win.clearInterval(win.umbraIntervalId);
    } else if (win.umbraInstagramBehavior && win.umbraInstagramBehavior.intervalId) {
        win.clearInterval(win.umbraInstagramBehavior.intervalId);
    } else {
        console.log("no umbra to stop");
    }
}
