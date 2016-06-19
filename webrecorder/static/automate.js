$(function() {
    $("#automate").change(function() {
        if ($("#automate").prop("checked")) {
            scrollStart();
            //$("#automate-l").text("Autoscrolling...");
        } else {
            scrollStop();
            //$("#automate-l").text("Autoscroll");
        }
    });

    function done() {

    }

    function loadScript(win, filename)
    {
        if (win.__auto_loaded && win.__auto_loaded[filename]) {
            return false;
        }

        var script_name = window.location.protocol + '//' + window.location.host + "/static/__shared/" + filename;

        var elem = win.document.createElement("script");
        elem._no_rewrite = true;
        elem.src = script_name;

        if (!win.document || !win.document.body) {
            console.log("not ready yet");
        }

        win.document.body.appendChild(elem);

        if (!win.__auto_loaded) {
            win.__auto_loaded = {}
        }
        win.__auto_loaded[filename] = true;

        //setTimeout(function() {
        //    win.Autoscroll.setDoneCallback(done);
        //}, 400);

        return true;
    }


    function scrollStart()
    {
        var replay_iframe = window.document.getElementById("replay_iframe");

        if (!replay_iframe) {
            return;
        }

        var win = replay_iframe.contentWindow;

        loadScript(win, "autoscroll.js");
    }

    function scrollStop()
    {
        var replay_iframe = window.document.getElementById("replay_iframe");

        if (!replay_iframe) {
            return;
        }

        var win = replay_iframe.contentWindow;

        if (win.Autoscroll) {
            win.Autoscroll.stop();
        }
    }
});

