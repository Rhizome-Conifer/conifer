window.Autoscroll = (function() {
    var sid = undefined;
    var scroll_timeout = 20000;
    var doneCallback = undefined;
    var lastScrolled = Date.now();

    function scroll() {
        if (window.scrollY + window.innerHeight < Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)) {
            window.scrollBy(0, 200);
            lastScrolled = Date.now();
        } else if ((Date.now() - lastScrolled) > scroll_timeout) {
            stop();
        };
    }
    
    function start(done, timeout) {
        doneCallback = done;
        
        if (timeout) {
            this.scroll_timeout = timeout;
        }
        
        sid = setInterval(scroll, 100);
    }
    
    function stop() {
        clearInterval(sid);
        sid = undefined;
    }
    
    function isDone() {
        return sid == undefined;
    }
    
    function setDoneCallback(donecb) {
        doneCallback = donecb;
    }
    
    return {"start": start, "stop": stop, "isDone": isDone, "setDoneCallback": setDoneCallback};
    
})();

window.Autoscroll.start();

