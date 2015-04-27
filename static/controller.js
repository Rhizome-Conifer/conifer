var _orig_set_state = window.set_state;

set_state = function(state) {
    _orig_set_state(state);
    
    if (!doc_window || !doc_window.wbinfo) {
        return;
    }

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


// Links

var dupeHash = {};


$(function() {
    
    $("#links-search").click(function() {
        var query_parts = $("#links-query").val().split("..", 1);
        var query = query_parts[0];
        
        var attr = "href";
        if (query_parts.length == 2) {
            attr = query_parts[1];
        }
        
        $("#links-selected-list").empty();
        
        var doc = $("#replay_iframe").contents()[0];
        
        var extract_orig = $("#replay_iframe")[0].contentWindow._wb_wombat.extract_orig;
        
        var results = $(query, doc);
        
        $("#links-count").text(results.length + " Link(s)");
        
        results.each(function(i, elem) {
            var url = $(elem).attr(attr);
            
            if (!url || url == "" || url.indexOf("#") == 0) {
                return;
            }
            
            if (url.indexOf("mailto:") == 0 || url.indexOf("javascript:") == 0) {
                return;
            }
            
            url = extract_orig(url);
            
            if (dupeHash[url]) {
                return;
            }
            
            dupeHash[url] = true;
            
            $("#links-selected-list").
                append($("<li>").addClass("list-group-item").
                  append($("<input>").attr("type", "checkbox")).
                    append($("<span>").append(url)));
        });
        
        $("#links-selected-list input[type=checkbox]").prop("checked", true);
    });
    
    $("#links-query-opts a").click(function(event) {
        event.preventDefault();
        $("#links-query").val($(this).attr("data-query"));
        //return false;
    });
    
    
    $("#links-toggle-all").click(function() {
        var checked = $("#links-toggle-all").prop("checked");
        $("#links-selected-list input[type=checkbox]").prop("checked", checked);
    });
    
    
    $("#links-add-q").click(function() {
        var urls = $("#links-selected-list input:checked + span").map(function(i, elem) { return $(elem).text() });
        var data = {"urls": urls.toArray()};
        
        $.ajax({
            type: 'POST',
            url: '/_queue/' + doc_window.wbinfo.coll,
            data: JSON.stringify(data),
            success: function(data) { 
                $("#links-status").text(data.num_added + " Queued for Recording!");
            },
            contentType: "application/json",
            dataType: 'json'
        });
        
        window.open("/" + doc_window.wbinfo.coll + "/record/", "_blank");
    });
    
    // The queue automation
    
    $("#automate").change(function() {
        if ($("#automate").prop("checked")) {
            if (!start_umbra()) {
                start_loop_q();
            }
            $("#automate-l").text("Automated Recording. Click to stop.");
        } else {
            stop_loop_q();
            stop_umbra();
            $("#automate-l").text("Start Automated Recording");
        }
    });
    
    if (wbinfo.state == "rec" && !wbinfo.url) {
        console.log("automate");
        $("#automate").click();
    }
});


var is_loading = false;
var auto_loop_id = undefined;

function auto_on_load()
{
    is_loading = false;

    start_umbra();
    //auto_loop_id = setTimeout(auto_load_next_url, 10); 
}

function start_loop_q()
{
    $("#replay_iframe")[0].addEventListener("load", auto_on_load);
    auto_load_next_url();
}

function stop_loop_q()
{
    clearTimeout(auto_loop_id);
    $("#auto-info").text("");
}

function auto_load_next_url()
{
    var wbinfo = doc_window.wbinfo || window.wbinfo;
    
    if (!wbinfo) {
        console.warn("No Collection!");
    }
    
    $.getJSON("/_queue/" + wbinfo.coll, function(data) {
        if (!data) {
            return;
        }
        
        if (data.q_len != undefined) {
            $("#auto-info").text(data.q_len + " urls left!");
        }
        
        if (!data.url) {
            return;
        }
        
        is_loading = true;
        console.log("Loading: " + data.url);
        doc_window.location.href = "/" + wbinfo.coll + "/record/mp_/" + data.url;
    });
}

function get_behavior(host)
{
    //    var behavior_mapping = [
    //        [/(?:.*\.)?facebook.com$/, "facebook.js"],
    //        [/(?:.*\.)?flickr.com$/, "flickr.js"],
    //        [/(?:.*\.)?instagram.com$/, "instagram.js"],
    //        [/(?:.*\.)?vimeo.com$/, "vimeo.js"],
    //        [/.*/, "default.js"],
    //    ];
    //    
    //    for (var i = 0; i < behavior_mapping.length; i++) {
    //        var rule = behavior_mapping[i];
    //        if (host.match(rule[0])) {
    //            return rule[1];
    //        }
    //    }
    //    
    //    return undefined;

    return "default.js";
}

var umbra_count;

function start_umbra()
{
    if (!doc_window || !doc_window.WB_wombat_location || !doc_window.WB_wombat_location.host) {
        return false;
    }
    
    var file = get_behavior(doc_window.WB_wombat_location.host);

    if (!file) {
        return false;
    }

    var script_name = "/static/__shared/behaviors/" + file;

    var doc = doc_window.document;
    
    var elem = doc.createElement("script");
    elem.src = script_name;
    elem._no_rewrite = true;
    doc.body.appendChild(elem);
    
    umbra_count = 0;
    
    auto_loop_id = setTimeout(check_umbra, 2000);
    return true;
}

function check_umbra()
{
    function wait_for_umbra() {
        if (!doc_window.umbraBehaviorFinished) {
            return false;
        }
        
        if (doc_window.umbraBehaviorFinished()) {
            return false;
        }
        
        if (umbra_count >= 5) {
            return false;
        }
        
        umbra_count++;
        return true;
    }
    
    if (wait_for_umbra()) {
        auto_loop_id = setTimeout(check_umbra, 2000);
    } else {
        auto_load_next_url();
    }
}

function stop_umbra()
{
    if (doc_window.umbraIntervalId) {
        doc_window.clearInterval(doc_window.umbraIntervalId);
    } else if (doc_window.umbraInstagramBehavior && doc_window.umbraInstagramBehavior.intervalId) {
        doc_window.clearInterval(doc_window.umbraInstagramBehavior.intervalId);
    } else {
        console.log("no umbra to stop");
    }
}



