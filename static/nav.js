if (window == window.top && window.frames.length) {
    doc_window = window.frames[0];
} else {
    doc_window = window.top;
}

$(function() {
    $(".nav-search button").click(function() {
        var prefix = $(this).attr("data-path-prefix");
        var url = $("#theurl").val();
        if (url != '') {
            doc_window.location.href = prefix + url;
        }
        return false;
    });
    
    if (!doc_window.wbinfo) {
        return;
    }
    
    if (doc_window.wbinfo.timestamp &&
        doc_window.wbinfo.state == 'play') {
        
        $("#status-text").text("Playback from " + ts_to_date(doc_window.wbinfo.timestamp));
    }
    
    if (doc_window.wbinfo.url) {
        $("#theurl").attr("value", doc_window.wbinfo.url);
        $("#theurl").attr("title", doc_window.wbinfo.url);
    }
});

function ts_to_date(ts)
{
    if (ts.length < 14) {
        return ts;
    }

    var datestr = (ts.substring(0, 4) + "-" + 
                   ts.substring(4, 6) + "-" +
                   ts.substring(6, 8) + "T" +
                   ts.substring(8, 10) + ":" +
                   ts.substring(10, 12) + ":" +
                   ts.substring(12, 14) + "-00:00");

    return new Date(datestr).toLocaleString();
}
