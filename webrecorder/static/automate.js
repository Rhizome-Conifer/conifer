$(function() {
    $("#autoscroll").click(function(event) {
        event.preventDefault();

        if ($(this).attr("aria-pressed") == "true") {
            scrollStop();
        } else {
            scrollStart();
        }

        $(this).blur();
    });

    function onDone() {
        $("#autoscroll").removeClass("active");
        $("#autoscroll").attr("aria-pressed", "false");
    }

    function loadScript(win, filename, onload)
    {
        if (win.__auto_loaded && win.__auto_loaded[filename]) {
            onload();
            return false;
        }

        var script_name = window.location.protocol + '//' + window.location.host + "/static/__shared/" + filename;

        if (!win.document || !win.document.body) {
            console.log("not ready yet");
        }

        var elem = win.document.createElement("script");
        elem._no_rewrite = true;
        elem.onload = onload;
        elem.src = script_name;

        win.document.body.appendChild(elem);

        if (!win.__auto_loaded) {
            win.__auto_loaded = {}
        }
        win.__auto_loaded[filename] = true;

        return true;
    }


    function scrollStart()
    {
        var replay_iframe = window.document.getElementById("replay_iframe");

        if (!replay_iframe) {
            return;
        }

        var win = replay_iframe.contentWindow;

        loadScript(win, "autoscroll.js", function() {
            win.Autoscroll.start(onDone, 5000);
        });
    }

    function scrollStop()
    {
        var replay_iframe = window.document.getElementById("replay_iframe");

        if (!replay_iframe) {
            return;
        }

        var win = replay_iframe.contentWindow;

        if (win.Autoscroll) {
            win.Autoscroll.stop(true);
        }
    }
});

