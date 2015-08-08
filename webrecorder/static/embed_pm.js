
function init_pm() {
    var content = document.querySelector("#replay_iframe").contentWindow;

    window.addEventListener("message", function(event) {
        // Pass to content
        if (event.source == window.parent) {
            content.postMessage(event.data, "*");
        } else if (event.source == content) {
        // Pass to parent
            window.parent.postMessage(event.data, "*");
        }
    });


    window.__WB_pmw = function(win) {
        this.pm_source = win;
        return this;
    }
}

