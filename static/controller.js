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
        
        console.log(query);
        
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
            
            $("#links-selected-list").
                append($("<li>").addClass("list-group-item").
                  append($("<input>").attr("type", "checkbox")).
                    append($("<span>").append(url)));
        });
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
                console.log(data.num_added);
            },
            contentType: "application/json",
            dataType: 'json'
        });
    });
    
    // The queue automation
    
    $("#automate").change(function() {
        if ($("#automate").prop("checked")) {
            start_loop_q();
            $("#automate-l").text("Automated Recording. Click to stop.");
        } else {
            stop_loop_q();
            $("#automate-l").text("Start Automated Recording");
        }
    });
});


var is_loading = false;
var auto_loop_id = undefined;

function auto_on_load()
{
    is_loading = true;

    //start_umbra();
    auto_loop_id = setTimeout(auto_load_next_url, 10); 
}

function start_loop_q()
{
    $("#replay_iframe")[0].addEventListener("load", auto_on_load);
    auto_load_next_url();
}

function stop_loop_q()
{
    clearTimeout(auto_loop_id);
}

function auto_load_next_url()
{
    $.getJSON("/_queue/" + doc_window.wbinfo.coll, function(data) {
        if (!data) {
            return;
        }
        
        if (data.q_len) {
            $("#auto-info").text(data.q_len + " urls left!");
        }
        
        if (!data.url) {
            return;
        }
        
        is_loading = true;
        console.log("Loading: " + data.url);
        doc_window.location.href = "/" + doc_window.wbinfo.coll + "/record/mp_/" + data.url;
    });
}



