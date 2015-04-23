var _orig_set_state = window.set_state;

set_state = function(state) {
    _orig_set_state(state);

    if (doc_window.wbinfo.state == "rec") {
        add_page(state.url);
    } else if (doc_window.wbinfo.state == "play") {
        update_page(state.timestamp);
    }
    
    if (curr_state.url) {
        $("#theurl").attr("value", curr_state.url);
        $("#theurl").attr("title", curr_state.url);
    }
};
