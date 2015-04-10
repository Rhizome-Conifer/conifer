var _orig_set_state = window.set_state;

set_state = function(state) {
    _orig_set_state(state);

    if (!wbinfo.is_recording || !curr_state || !curr_state.url) {
        return;
    }

    var data = {};
    data.url = curr_state.url;
    data.ts = curr_state.timestamp;

    if (window.frames[0].document.title) {
        data.title = window.frames[0].document.title;
    }

    $.post("/_addpage?coll=" + wbinfo.coll, data, function() {
    });
};
