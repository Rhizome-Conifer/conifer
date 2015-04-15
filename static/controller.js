var _orig_set_state = window.set_state;

set_state = function(state) {
    _orig_set_state(state);

    if (!wbinfo.is_recording || !curr_state || !curr_state.url) {
        return;
    }

    var data = {};
    data.url = curr_state.url;

    if (window.top.document.title) {
        data.title = window.top.document.title;
    }

    $.post("/_addpage?coll=" + wbinfo.coll, data, function() {
    });
};
