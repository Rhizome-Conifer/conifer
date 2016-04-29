if (!user) {
    user = curr_user;
}

$(function() {
    // 'Homepage': Record button
    $('.wr-content').on('submit', '.start-recording-homepage', function(event) {
        event.preventDefault();

        var collection = "anonymous";
        var title = "My First Recording";
        var url = $(".wr-content input[name='url']").val();

        RouteTo.recordingInProgress(user, collection, title, url);
    });


    // 'New recording': Record button
    $('header').on('submit', '.start-recording', function(event) {
        event.preventDefault();

        var collection = $("*[name='collection']").val();
        var title = $("input[name='title']").val();
        var url = $("input[name='url']").val();

        RouteTo.recordingInProgress(user, collection, title, url);
    });

    // 'Recording in progress': Url bar 'Go' button / enter key
    $('header').on('submit', '.recording-in-progress', function(event) {
        event.preventDefault();

        var url = $("input[name='url']").val();

        RouteTo.recordingInProgress(user, coll, wbinfo.info.rec_id, url);
    });

    // 'Recording in progress': Stop recording button
    $('header').on('submit', '.stop-recording', function(event) {
        event.preventDefault();

        RouteTo.recordingInfo(user, coll, wbinfo.info.rec_id);
    });

    // 'Browse recording': Url bar 'Go' button / enter key
    $('header').on('submit', '.browse-recording', function(event) {
        event.preventDefault();

        var url = $("input[name='url']").val();

        RouteTo.browseRecording(user, coll, wbinfo.info.rec_id, url);
    });

    // 'Browse recording': 'Add to recording' button
    $('header').on('submit', '.add-to-recording', function(event){
        event.preventDefault();

        var url = $("input[name='url']").val();

        RouteTo.recordingInProgress(user, coll, wbinfo.info.rec_id, url, "patch");
    });

    CollectionsDropdown.start();
    RecordingSizeWidget.start();
    PagesComboxBox.start();
    CountdownTimer.start();
});

var Collections = (function() {
    var API_ENDPOINT = "/api/v1/collections";

    var get = function(user, doneCallback, failCallback) {
        var query_string = "?user=" + user

        $.ajax({
            url: API_ENDPOINT + query_string,
            method: "GET"
        })
        .done(function(data, textStatus, xhr) {
            doneCallback(data);
        })
        .fail(function(xhr, textStatus, errorThrown) {
            failCallback();
        });
    }

    return {
        get: get
    }
})();

var Recordings = (function() {
    var API_ENDPOINT = "/api/v1/recordings";
    var query_string = "?user=" + user + "&coll=" + coll;

    var get = function(recordingId, doneCallback, failCallback) {
        $.ajax({
            url: API_ENDPOINT + "/" + recordingId + query_string,
            method: "GET",
        })
        .done(function(data, textStatus, xhr) {
            doneCallback(data);
        })
        .fail(function(xhr, textStatus, errorThrown) {
            failCallback();
        });

    }

    var addPage = function(recordingId, attributes) {
        var attributes = attributes;
        $.ajax({
            url: API_ENDPOINT + "/" + recordingId + "/pages" + query_string,
            method: "POST",
            data: attributes
        })
        .done(function(data, textStatus, xhr){
            $("input[name='url']").val(attributes.url);
        })
        .fail(function(xhr, textStatus, errorThrown) {
            // Fail gracefully when the page can't be updated
        });
    }

    var getPages = function(recordingId, doneCallback, failCallback) {
        // no recordingId if in collection replay mode
        // skipping for now, possible to get pages for all recordings
        if (!recordingId) {
            failCallback();
            return;
        }

        $.ajax({
            url: API_ENDPOINT + "/" + recordingId + "/pages" + query_string,
            method: "GET",
        })
        .done(function(data, textStatus, xhr){
            doneCallback(data);
        })
        .fail(function(xhr, textStatus, errorThrown) {
            failCallback();
        });
    }

    return {
        get: get,
        addPage: addPage,
        getPages: getPages
    }
}());

var RouteTo = (function(){
    var host = window.location.protocol + "//" + window.location.host;

    var recordingInProgress = function(user, collection, recording, url, mode) {
        if (!mode) {
            mode = "record";
        }

        if (user == "@anon") {
            routeTo(host + "/" + collection + "/" + recording + "/" + mode + "/" + url);
        } else {
            routeTo(host + "/" + user + "/" + collection + "/" + recording + "/" + mode + "/" + url);
        }
    }

    var collectionInfo = function(user, collection) {
        if (user == "@anon") {
            routeTo(host + "/anonymous");
        } else {
            routeTo(host + "/" + user + "/" + collection);
        }
    }

    var recordingInfo = function(user, collection, recording) {
        if (user == "@anon") {
            routeTo(host + "/" + collection + "/" + recording);
        } else {
            routeTo(host + "/" + user + "/" + collection + "/" + recording);
        }
    }

    var browseRecording = function(user, collection, recording, url) {
        if (user == "@anon") {
            routeTo(host + "/" + collection + "/" + recording + "/" + url);
        } else {
            routeTo(host + "/" + user + "/" + collection + "/" + recording + "/" + url);
        }
    }

    var routeTo = function(url) {
        window.location.href = url;
    }

    return {
        recordingInProgress: recordingInProgress,
        collectionInfo: collectionInfo,
        recordingInfo: recordingInfo,
        browseRecording: browseRecording
    }
}());

var RecordingSizeWidget = (function() {
    var start = function() {
        if ($('.size-counter').length) {
            var spaceUsed = format_bytes(wbinfo.info.size);
            updateDom(spaceUsed);

            setTimeout(pollForSizeUpdate, 1000);

            if (wbinfo.state == "record" || wbinfo.state == "patch") {
                setInterval(pollForSizeUpdate, 10000);
            }
        }
    }

    var pollForSizeUpdate = function() {
        Recordings.get(wbinfo.info.rec_id, updateSizeCounter, dontUpdateSizeCounter);
        exclude_password_targets();
    }

    var updateSizeCounter = function(data) {
        var spaceUsed = format_bytes(data.recording.size);

        updateDom(spaceUsed);
    }

    var updateDom = function(spaceUsed) {
        $('.size-counter .current-size').text(spaceUsed);
        $('.size-counter').removeClass('hidden');
    }

    var dontUpdateSizeCounter = function() {
	// Do nothing to leave the last counter value on the page.
    }

    return {
        start: start
    }

})();

var PagesComboxBox = (function() {
    var start = function() {
        if ($(".browse-recording .url").length) {
            Recordings.getPages(wbinfo.info.rec_id, initializeCombobox, dontInitializeCombobox);
        }
    }

    // From typeahead examples
    var substringMatcher = function(pages) {
        return function findMatches(q, cb) {
            var matches, substringRegex;

            // an array that will be populated with substring matches
            matches = [];

            // regex used to determine if a string contains the substring `q`
            substrRegex = new RegExp(q, 'i');

            // iterate through the pool of strings and for any string that
            // contains the substring `q`, add it to the `matches` array
            $.each(pages, function(i, page) {
                if (substrRegex.test(page.url)) {
                    matches.push(page);
                }
            });

            cb(matches);
        };
    };

    var initializeCombobox = function(data) {
        var pages = data.pages;
        var source = substringMatcher(pages);

        $("input[name='url']").typeahead(
            {
                highlight: true,
                minLength: 0,
                hint: true,
            },
            {
                name: 'pages',
                source: source,
                limit: 1000000,

                display: "url",
                templates: {
                    suggestion: function(data) {
                        return "<div>" + formatSuggestionUrl(data.url) +
                            "<span class='suggestion-timestamp pull-right'>"
                        + ts_to_date(data.timestamp) + "</span></div>";
                    }
                }
            });
    }

    var dontInitializeCombobox = function() {
        // If we can't load this recording's pages,
        // do nothing to leave this as a regular
        // input field
    }

    var formatSuggestionUrl = function(url) {
        var MAX_LENGTH = 110;
        var CHARS_BEFORE_ELLIPSES = 87
        var CHARS_AFTER_ELLIPSES = 30

        if (url.length > MAX_LENGTH) {
            var last_char = url.length - 1;
            return url.substring(0, CHARS_BEFORE_ELLIPSES)
                    + "..." +
                    url.substring(last_char - CHARS_AFTER_ELLIPSES, last_char);
        } else {
            return url;
        }
    }

    return {
        start: start
    }
})();

var CollectionsDropdown = (function() {

    var start = function() {
        // Only activate when logged in and not in record/browse mode
        if (user == '@anon' || window.wbinfo || window.coll) {
            return;
        }

        Collections.get(user, initializeDropdown, dontInitializeDropdown);
    }

    var initializeDropdown = function(data) {
        if (!data.collections || !data.collections.length) {
            return;
        }
        var collectionInputParentDiv = $("input[name='collection']").parent();
        var collectionOptions = $.map(data.collections, function(collection) {
            return $("<option value='" + collection.id + "'>" + collection.title + "</option>");
        })

        $(collectionInputParentDiv).html($("<select name='collection' required>").append(collectionOptions));

        $("select", collectionInputParentDiv).prepend($("<option selected='' value=''>Pick a Collection</option>"));

        $("select", collectionInputParentDiv).selectBoxIt({native: false});

    }

    var dontInitializeDropdown = function() {
        // If we can't load this user's collections, just
        // leave this as an input field
    }

    return {
        start: start
    }
})();


var CountdownTimer = (function() {
    // Session Expire
    var end_time = undefined;

    function update_countdown() {
        if (!end_time) {
            return;
        }
        var curr = Math.floor(new Date().getTime() / 1000);
        var secdiff = end_time - curr;

        if (secdiff == 0) {
            //window.location.href = "/_expire";
            return;
        }

        if (secdiff < 0) {
            secdiff = 0;
        }

        if (secdiff < 300) {
            $("*[data-anon-timer]").parent().show();
        }
        
        var min = Math.floor(secdiff / 60);
        var sec = secdiff % 60;
        if (sec <= 9) {
            sec = "0" + sec;
        }
        if (min <= 9) {
            min = "0" + min;
        }

        $("*[data-anon-timer]").text(min + ":" + sec);       
    }

    var start = function() {
        // enable timer only if anon
        if (user != "@anon") {
            return;
        }

        var expire = $("*[data-anon-timer]").attr("data-anon-timer");

        if (expire && expire.length) {
            var time_left = parseInt(expire);

            if (!time_left) {
                return;
            }

            if (end_time == undefined) {
                setInterval(update_countdown, 1000);
            }
        
            end_time = Math.floor(new Date().getTime() / 1000 + time_left);
        
            update_countdown();
        }
    }

    return {
        start: start
    }
})();




// Format size
$(function() {
    function format_by_attr(attr_name, format_func) {
        $("[" + attr_name + "]").each(function(i, elem) {
            $(elem).text(format_func($(elem).attr(attr_name)));
        });
    }

    format_by_attr("data-size", format_bytes);

    format_by_attr("data-time-ts", ts_to_date);

    format_by_attr("data-time-sec", function(val) { return new Date(parseInt(val) * 1000).toLocaleString(); });

});

// Check as soon as frame is loaded
$("#replay_iframe").load(function() {
    exclude_password_targets();
});

var pass_form_targets = {};

function exclude_password_targets() {
    if (wbinfo.state != "record" && wbinfo.state != "patch") {
        return;
    }

    $("input[type=password]", $("#replay_iframe").contents()[0]).each(function(i, input) {
        if (input && input.form && input.form.action) {
            var form_action = extract_replay_url(input.form.action);
            if (!form_action) {
                form_action = input.form.action;
            }
            if (pass_form_targets[form_action]) {
                return;
            }

            $.getJSON("/_skipreq?" + $.param({url: form_action}), function(data) {
                pass_form_targets[form_action] = true;
                //console.log("Skipping rec sensitive url: " + form_action);
            });
        }
    });
}





$(function() {
    $(".show-recorder").click(function(e) {
        $("#recorder-bar").show();
    });
});


$(function() {
    $('#login-modal').on('shown.bs.modal', function() {
        $('#username').focus();
    });
    
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
                                 url: window.location.href});
        
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
});

// Utils
//From http://stackoverflow.com/questions/4498866/actual-numbers-to-the-human-readable-values
function format_bytes(bytes) {
    if (!isFinite(bytes) || (bytes < 1)) {
        return "0 bytes";
    }
    var s = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    var e = Math.floor(Math.log(bytes) / Math.log(1000));
    return (bytes / Math.pow(1000, e)).toFixed(2) + " " + s[e];
}


function ts_to_date(ts, is_gmt)
{
    if (!ts) {
        return "";
    }

    if (ts.length < 14) {
        ts += "00000000000000".substr(ts.length);
    }

    var datestr = (ts.substring(0, 4) + "-" +
                  ts.substring(4, 6) + "-" +
                  ts.substring(6, 8) + "T" +
                  ts.substring(8, 10) + ":" +
                  ts.substring(10, 12) + ":" +
                  ts.substring(12, 14) + "-00:00");

    var date = new Date(datestr);
    if (is_gmt) {
        return date.toGMTString();
    } else {
        return date.toLocaleString();
    }
}





var _orig_set_state = window.set_state;

window.set_state = function(state) {
    _orig_set_state(state);

    var replay_iframe = window.document.getElementById("replay_iframe");

    if (!replay_iframe || !replay_iframe.contentWindow) {
        return;
    }

    if (state.is_error) {
        $("input[name='url']").val(state.url);
    } else if (wbinfo.state == "record" || wbinfo.state == "patch") {
        var recordingId = wbinfo.info.rec_id;
        var attributes = {};

        attributes.url = state.url;
        attributes.timestamp = state.timestamp;
        attributes.title = $('iframe').contents().find('title').text();

        Recordings.addPage(recordingId, attributes);
    } else if (wbinfo.state == "replay" || wbinfo.state == "replay-coll") {
        $("input[name='url']").val(state.url);
    }
};
