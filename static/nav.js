var doc_window;

if (window == window.top && window.frames.length) {
    doc_window = document.getElementById("replay_iframe").contentWindow;
} else {
    doc_window = window.top;
}

$(function() {
    $(".url-rec-play").click(function() {
        var prefix = $(this).attr("data-path-prefix");
        var url = $("#theurl").val();
        
        if (doc_window != window.top) {
            prefix += "mp_/";
        }
        
        if (url != '') {
            doc_window.location.href = prefix + url;
        }
        return false;
    });
    
    if (!doc_window.wbinfo) {
        return;
    }
    
    if (doc_window.wbinfo.timestamp) {
        update_page(doc_window.wbinfo.timestamp);
    }
    
    if (doc_window.wbinfo.url) {
        $("#theurl").attr("value", doc_window.wbinfo.url);
        $("#theurl").attr("title", doc_window.wbinfo.url);
    }
    
    if (doc_window.wbinfo.info) {
        set_info(doc_window.wbinfo.info);
    }
});

function update_page(timestamp)
{
    if (doc_window.wbinfo.state == "play") {
        $("#status-text").text("Playback from " + ts_to_date(timestamp));
    }
}

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

function add_page(capture_url)
{
    if (window == window.top && window.frames.length) {
        doc_window = document.getElementById("replay_iframe").contentWindow;
    } else {
        doc_window = window.top;
    }
    
    if (!doc_window.wbinfo) {
        return;
    }
    
    var http = new XMLHttpRequest();
    http._no_rewrite = true;
    
    var post_url = "/_addpage?coll=" + doc_window.wbinfo.coll;

    if (!capture_url) {
        capture_url = doc_window.wbinfo.url;
    }
    
    var params = "url=" + capture_url;

    if (doc_window.document.title) {
        params += "&title=" + doc_window.document.title;
    }

    http.open("POST", post_url);

    //Send the proper header information along with the request
    http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    //http.setRequestHeader("Content-length", params.length);
    //http.setRequestHeader("Connection", "close");
    http.send(params);
    
    update_info();
}

function update_info()
{
    $.ajax("/_info?coll=" + doc_window.wbinfo.coll, {
        success: function(data) {
            set_info(data);
        }
    });
}

function set_info(data)
{
    if (!data.curr_size || !data.total_size) {
        return;
    }

    var curr_size = format_bytes(data.curr_size);
    var total_size = format_bytes(data.total_size);
    
    var info = "Total Collection: " + total_size + ", Recently Recorded: " + curr_size;

    $("#curr_size_info").text(total_size);
    $("#curr_size_info").attr("title", info);
}

//From http://stackoverflow.com/questions/4498866/actual-numbers-to-the-human-readable-values
function format_bytes(bytes) {
    if (!isFinite(bytes) || (bytes < 1)) {
        return "0 bytes";
    }
    var s = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    var e = Math.floor(Math.log(bytes) / Math.log(1000));
    return (bytes / Math.pow(1000, e)).toFixed(2) + " " + s[e];
}
