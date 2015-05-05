var doc_window = undefined;

$(function() {
    $(".nav-url-form").submit(function() {
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
    
    if (window == window.top && window.frames.length) {
        doc_window = document.getElementById("replay_iframe").contentWindow;
    } else {
        doc_window = window.top;
    }
    
    if (!window.wbinfo) {
        return;
    }
    
    if (window.wbinfo.timestamp) {
        update_page(window.wbinfo.timestamp);
    }
    
    if (window.wbinfo.url) {
        $("#theurl").attr("value", window.wbinfo.url);
        $("#theurl").attr("title", window.wbinfo.url);
    }
    
    if (window.wbinfo.info) {
        set_info(window.wbinfo.info);
    }
    
    if (window.wbinfo.state == "rec") {
        setInterval(update_info, 10000);
    }
});

function update_page(timestamp)
{
    if (wbinfo && wbinfo.state == "play") {
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
//    if (window == window.top && window.frames.length) {
//        doc_window = document.getElementById("replay_iframe").contentWindow;
//    } else {
//        doc_window = window.top;
//    }
    
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
}

function update_info()
{
    if (!doc_window || !doc_window.wbinfo) {
        return;
    }
    
    $.ajax("/_info?coll=" + doc_window.wbinfo.coll, {
        success: function(data) {
            set_info(data);
        }
    });
}

function set_info(data)
{
    if (!data.user_total_size && !data.total_size) {
        return;
    }
    
    var total_size = format_bytes(data.total_size);

    var user_total_size = format_bytes(data.user_total_size);
    
    var info = "Collection: " + total_size + ", All Collections: " + user_total_size;
    
    var total_int = parseInt(data.user_total_size);
    var max_int = parseInt(data.user_max_size);
    
    var msg = "Recording";
    
    if (total_int >= max_int) {
        msg = "Not Recording -- Size Limit Reached";
        $("#status-text").parent().removeClass("label-primary label-warning").addClass("label-danger");
        $(".pulse").hide();
    } else if (total_int >= max_int * 0.95) {
        msg = "Recording -- Close to Size Limit";
        $("#status-text").parent().removeClass("label-primary label-danger").addClass("label-warning");
    } else {
        msg = "Recording";
        $("#status-text").parent().removeClass("label-danger label-warning").addClass("label-primary");
    }

    $("#status-text").html(msg + "&nbsp;(" + total_size + ")");
    $("#status-text").attr("title", info);
    //$("#curr_size_info").text(coll_size);
    //$("#curr_size_info").attr("title", info);
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

$(function() {
    $("#report-modal").on('show.bs.modal', function() {
        $("#report-form-submit").text("Send Report");
        $("#report-thanks").text("");
        $('#report-form-submit').prop('disabled', false);
    });
    
    $("#report-form").submit(function(e) {
        //$("#report-form-submit").text("Sending Report...");
        
        var params = $("#report-form").serialize();
        
        params += "&" + $.param({coll: wbinfo.coll,
                                 state: wbinfo.state,
                                 url: doc_window.location.href});
        
        $.post("/_reportissues", params, function() {
            $("#report-form-submit").text("Report Sent!");
            $("#report-thanks").text("Thank you for testing webrecorder.io beta!");
            $('#report-form-submit').prop('disabled', true);
            
            setTimeout(function() {
                $("#report-modal").modal('hide');
            }, 1000);
        });
        e.preventDefault();
    });
    
    
    $("#snapshot").click(function() {
        var params = $.param({coll: wbinfo.coll,
                              url: curr_state.url});
        
        var content = doc_window.document.documentElement.outerHTML;
        
        $.ajax({
            type: "POST",
            url: "/_snapshot?" + params,
            data: content,
            success: function() {
                console.log("Saved");
            },
            error: function() {
                console.log("err");
            },
            dataType: 'html',
        });
    });
});
