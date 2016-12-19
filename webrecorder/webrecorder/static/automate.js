$(function() {
    $("#autoscroll").click(function(event) {
        event.preventDefault();

        if (window.cnt_browser) {
            RecordingSizeWidget.doAutoscroll();
            return;
        }

        window.addEventListener("message", onDone);

        if ($(this).attr("aria-pressed") == "true") {
            scrollStop();
        } else {
            scrollStart();
        }

        $(this).blur();
    });

    function onDone(event) {
        var replay_iframe = window.document.getElementById("replay_iframe");

        if (!replay_iframe) {
            return;
        }

        var win = replay_iframe.contentWindow;

        if (!event.data || event.source != win) { 
            return; 
        } 

        var message = event.data; 

        if (message.wb_type == "autoscroll_resp" && message.on == false) { 
            $("#autoscroll").removeClass("active");
            $("#autoscroll").attr("aria-pressed", "false");
        }
    }

    function scrollStart()
    {
        var replay_iframe = window.document.getElementById("replay_iframe");

        if (!replay_iframe) {
            return;
        }

        var win = replay_iframe.contentWindow;

        //loadScript(win, "autoscroll.js", function() {
        //    win.Autoscroll.start(onDone, 5000);
        //});
        win.postMessage({"wb_type": "autoscroll",
                         "start": true,
                         "timeout": 25000}, "*", undefined, true);
    }

    function scrollStop()
    {
        var replay_iframe = window.document.getElementById("replay_iframe");

        if (!replay_iframe) {
            return;
        }

        var win = replay_iframe.contentWindow;

        win.postMessage({"wb_type": "autoscroll",
                         "start": false,
                         "skipCallback": true}, "*", undefined, true);
         //if (win.Autoscroll) {
        //    win.Autoscroll.stop(true);
        //}
    }

    if (window.cnt_browser) {
        // don't keep pressed for cont. browsers
        $("#autoscroll").removeAttr("data-toggle");
    }

});

