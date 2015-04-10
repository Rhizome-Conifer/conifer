
$(function() {
    $("#wb_iframe").load(function(event) {
        if (!curr_state || !curr_state.url) {
            return;
        }
        
        var data = {};
        data.coll = wbinfo.coll;
        data.url = curr_state.url;
        data.title = window.frames[0].document.title;
        
        $.post("/_addpage", data, function() {
            console.log("added page");
        });
    });
});
