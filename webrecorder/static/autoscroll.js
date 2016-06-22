window.Autoscroll = (function() {
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
    
    return {"start": start, "stop": stop, "isDone": isDone, "setDoneCallback": setDoneCallback};
    
})();

