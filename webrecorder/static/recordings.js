if (!user) {
    user = curr_user;
}

$(function() {
    EventHandlers.bindAll();
    RecordingSizeWidget.start();
    BookmarkCounter.start();
    CountdownTimer.start();
    SizeProgressBar.start();
    Snapshot.start();
});

function setUrl(url) {
    $("input[name='url']").val(decodeURI(url));
}

function getUrl() {
    return $("input[name='url']").val();
}

var EventHandlers = (function() {
    var bindAll = function() {

        // Prevent the use of any disabled elements
        $('body').on('click', '.disabled', function(event){
            event.preventDefault();
            return false;
        });

        // Enable autofocus on modals
        $('body').on('shown.bs.modal', '.modal', function() {
            $(this).find('[autofocus]').focus();
        });

        // Switch urls -- Url bar submit / enter key
        $('header').on('submit', '.content-form', function(event) {
            event.preventDefault();

            var url = getUrl();

            if (window.curr_mode == "record") {
                //if (ContentMessages.messageIfDuplicateVisit(url)) { return; }

                RouteTo.recordingInProgress(user, coll, rec, url);

            } else if (window.curr_mode == "replay") {
                RouteTo.replayRecording(user, coll, rec, url);

            } else if (window.curr_mode == "replay-coll") {
                RouteTo.replayRecording(user, coll, undefined, url);

            } else if (window.curr_mode == "patch") {
                RouteTo.patchPage(user, coll, rec, url);

            } else if (window.curr_mode == "new") {
                // New handled in newrecordings.js
            }
        });

        // - Return to collection if recording or replay
        // - Return to replay if patching
        // - Start recording if on new recording page
        $('header').on('submit', '.content-action', function(event) {
            event.preventDefault();

            if (window.curr_mode == "record" || window.curr_mode == "replay") {
                RouteTo.recordingInfo(user, coll, rec);
            } else if (window.curr_mode == "replay-coll") {
                RouteTo.collectionInfo(user, coll);
            } else if (window.curr_mode == "patch") {
                var url = getUrl();

                RouteTo.replayRecording(user, coll, undefined, url);
            } else if (window.curr_mode == "new") {
                // New handled in newrecordings.js
            }
        });

        // Start patching
        $('.patch-page').on('click', function(event){
            event.preventDefault();

            var url = getUrl();
            var target;

            if ($(this).attr("target") == "_parent") {
                target = window.parent;
            } else {
                target = window;
            }

            var createPatch = function(data) {
                RouteTo.patchPage(user, coll, data.recording.id, url, target);
            };

            var fail = function() {}

            var attributes = {"title": "Patch"};

            Recordings.create(user, coll, attributes, createPatch, fail);
        });
 
         
        // 'Header': 'Login' link to display modal
        $('.login-link').on('click', function(event) {
            event.preventDefault();

            var link = $(this).attr("href");

            $.ajax({
                url: link,
                success: function (data) { 
                    $('#login-modal-cont').html(data);
                    TimesAndSizesFormatter.format();

                    $("#login-modal").modal('show');
                },
                dataType: 'html'
            });
        });

        // 'Recorder': 'Doesn't look right' link to display modal
        $("#report-modal").on('show.bs.modal', function() {
            $("#report-form-submit").text("Send Report");
            $("#report-thanks").text("");
            $('#report-form-submit').prop('disabled', false);
        });

        // 'Recorder': 'Doesn't look right form submission
        $("#report-form").submit(function(e) {
            e.preventDefault();

            var params = $("#report-form").serialize();

            params += "&" + $.param({state: window.curr_mode,
                                     url: window.location.href});

            params += "&user=" + user + "&coll=" + coll + "&rec=" + rec;

            $.post("/_reportissues", params, function() {
                $("#report-form-submit").text("Report Sent!");
                $("#report-thanks").text("Thank you for testing Webrecorder!");
                $('#report-form-submit').prop('disabled', true);

                setTimeout(function() {
                    $("#report-modal").modal('hide');
                }, 1000);
            });
        });

        // Move temp form: disable or enable migration collection
        $("body").append("<div id='login-modal-cont' class='move-temp-cont'>");

        $(".move-temp-cont").on("change", "input[name='move-temp']", function(event) {
            event.preventDefault();

            if ($(this).prop("checked")) {
                $(".to-coll").parent().show();
                $(".to-coll").attr("required", "true");
                $(".to-coll").click()
            } else {
                $(".to-coll").parent().hide();
                $(".to-coll").removeAttr("required");
            }
        });

        // Auto select text-boxes on click
        $(document).on('click', 'input[type="text"]', function() {
            $(this).select();
        } );


        // Adjust iframe
        if (curr_mode) {
            var height;

            if (height = $("header").height()) {
                height += 1;
                $("#replay_iframe").css("top", height + "px");
                //$("#replay_iframe").css("padding-bottom", height + "px");
                //$("#replay_iframe").css("margin-top", "-9px");
            } else if (height = $(".embed-footer").height()) {
                $("#replay_iframe").css("padding-bottom", height + "px");
            }
        }
    }

    return {
        bindAll: bindAll
    }
})();


var Snapshot = (function() {
    function queueSnapshot() {
        var main_window = document.getElementById("replay_iframe").contentWindow;
        main_window.postMessage({wb_type: "snapshot-req"}, "*");
    }

    function start() {
        $('#snapshot-modal').appendTo('body'); // sorry for this hack: makes modal appear on top of faded backgr!

        $("#snapshot").on('click', queueSnapshot);
    }

    return {start: start};
})();


function uploadStaticSnapshot(snapdata) {
    var params = $.param(snapdata.params)
    params += "&user=" + user + "&coll=" + coll + "&rec=" + rec;

    var target = window.location.origin + "/_snapshot?" + params;

    $.ajax({
        type: "PUT",
        url: target,
        dataType: "json",
        data: snapdata.contents,
        success: function(data) {
            if (snapdata.top_page) {
                if (typeof(data) == "string") {
                    data = JSON.parse(data);
                }

                $("#snapshot").prop("disabled", false);

                var snapUrl = "/" + user + "/" + coll + "/" + data.snapshot.timestamp + "/" + data.snapshot.url;

                $("#snapshot-modal .snap-link").attr('href', snapUrl);
                $("#snapshot-modal .snap-ts").attr("data-time-ts", data.snapshot.timestamp);
                TimesAndSizesFormatter.format();

                if (!snapdata.params.title) {
                    snapdata.params.title = data.snapshot.url;
                }

                $("#snapshot-modal .snap-title").text(snapdata.params.title);

                $('#snapshot-modal .snap-wait').hide();
                $('#snapshot-modal .snap-created').show();
            }
        },
        error: function() {
            console.log("Snapshot Error");
        },
        dataType: 'html',
    });

    if (snapdata.top_page) {
        $('#snapshot-modal .snap-wait').show();
        $('#snapshot-modal .snap-created').hide();

        $('#snapshot-modal')
            .modal({'keyboard': true})
            .modal('show');
    }
}




var RouteTo = (function(){
    var host = window.location.protocol + "//" + window.location.host;

    var newRecording = function(collection, recording, url, mode, target) {
        routeTo(host + "/$record/" + collection + "/" + recording + "/" + url, target);
    }

    var recordingInProgress = function(user, collection, recording, url, mode, target) {
        if (!mode) {
            mode = "record";
        }

        routeTo(host + "/" + user + "/" + collection + "/" + recording + "/" + mode + "/" + url, target);
    }

    var collectionInfo = function(user, collection) {
        routeTo(host + "/" + user + "/" + collection);
    }

    var recordingInfo = function(user, collection, recording) {
        routeTo(host + "/" + user + "/" + collection + "/" + recording);
    }

    var replayRecording = function(user, collection, recording, url) {
        var path = host + "/" + user + "/" + collection + "/";
        if (recording) {
            path += recording + "/";
        }
        path += url;

        routeTo(path);
    }

    var addToRecording = function(user, collection, recording) {
        routeTo(host + "/" + user + "/" + collection + "/" + recording + "/$add");
    }

    var patchPage = function(user, collection, recording, url, target) {
        recordingInProgress(user, collection, recording, url, "patch", target);
    }

    var routeTo = function(url, target) {
        if (!target) {
            target = window;
        }

        target.location.href = url;
    }

    return {
        newRecording: newRecording,
        recordingInProgress: recordingInProgress,
        collectionInfo: collectionInfo,
        recordingInfo: recordingInfo,
        replayRecording: replayRecording,
        addToRecording: addToRecording,
        patchPage: patchPage,
    }
}());

var RecordingSizeWidget = (function() {
    var sizeUpdateId = undefined;
    var recordingId;
    var collectionId;

    var start = function() {
        if ($('.size-counter-active').length &&
            (window.curr_mode == "record" || window.curr_mode == "patch")) {
            recordingId = $('[data-recording-id]').attr('data-recording-id');
            collectionId = $('[data-collection-id]').attr('data-collection-id');

            if (isOutOfSpace()) {
                RouteTo.recordingInfo(user, collectionId, recordingId);
            }

            setTimeout(pollForSizeUpdate, 1000);
            sizeUpdateId = setInterval(pollForSizeUpdate, 5000);
        }
    }

    var pollForSizeUpdate = function() {
        Recordings.get(recordingId, updateSizeCounter, dontUpdateSizeCounter);
        if (isAlmostOutOfSpace() && !warningPresent()) {
            showWarningMessage();
            disableUrlBar();
        }
    }

    var updateSizeCounter = function(data) {
        var spaceUsed = data.recording.size;
        updateDom(spaceUsed);
    }

    var updateDom = function(spaceUsed) {
        $('.size-counter .current-size').attr('data-size', spaceUsed);
        TimesAndSizesFormatter.format();
        $('.size-counter').removeClass('hidden');
    }

    var dontUpdateSizeCounter = function(xhr) {
        var data = undefined;

        if (xhr) {
            data = xhr.responseJSON;
        }

        // Stop pinging if user invalid (eg. expired)
        if (data && data.error_message == "No such user") {
            clearInterval(sizeUpdateId);
        }
    }

    var isOutOfSpace = function() {
        if (typeof wbinfo === "undefined") { return false; }
        return wbinfo.info.size_remaining <= 0;
    }

    var isAlmostOutOfSpace = function() {
        if (typeof wbinfo === "undefined") { return false; }
        return wbinfo.info.size_remaining <= 500000;  // 500KB
    }

    var showWarningMessage = function() {
        var outOfSpaceWarningDOM = "<div class='alert alert-warning alert-during-recording alert-out-of-space col-md-10' role='alert'><span class='glyphicon glyphicon-exclamation-sign' aria-hidden='true'></span><span class='sr-only'>Alert:</span><span class='left-buffer'></span>Your account is about to run out of space.  Please wrap up your work and stop your current recording.</div>"
        $('.header-webrecorder').after(outOfSpaceWarningDOM);
        $('.alert-during-recording').slideDown();
    }

    var warningPresent = function() {
        return $('.alert-out-of-space').length;
    }

    var disableUrlBar = function() {
        $('.recording-in-progress').find("input[name='url']").prop('disabled', true);
        $('.recording-in-progress').find('button').prop('disabled', true);
    }

    return {
        start: start
    }

})();

var BookmarkCounter = (function() {
    var sortedBookmarks = [];

    var start = function() {
        if ($(".url-input-recorder").length) {
            var recordingId = $('[data-recording-id]').attr('data-recording-id');

            if (recordingId) {
                Recordings.getNumPages(startBookmarkCounter, dontStartBookmarkCounter);
            } else {
                Collections.getNumPages(startBookmarkCounter, dontStartBookmarkCounter);
            }
        }
    }

    var update = function(attributes) {
        setUrl(attributes.url);
        BookmarkCounter.start();
    }

    var startBookmarkCounter = function(data) {
        //sortedBookmarks = data.pages.sort(function(p1, p2) {
        //    return p1.timestamp - p2.timestamp;
        //});
        var count = data.count;

        if (!count) {
            count = 0;
        }

        setBookmarkCount(count);
    }

    var setBookmarkCount = function(numBookmarks) {
        $('.bookmark-count').html(formatBookmarkCount(numBookmarks));
    }

    var formatBookmarkCount = function(numBookmarks) {
        var bookmarkString = "bookmarks";
        if (numBookmarks === 1) {
            bookmarkString = "bookmark";
        }

        return numBookmarks + "&nbsp;" + bookmarkString;// "<strong> / </strong>"
    }

    var dontStartBookmarkCounter = function() {
        // If we can't load this recording's pages,
        // do nothing
    }

    var hasBeenVisited = function(url) {
        var visited = false;

        $.each(sortedBookmarks, function(index) {
            if (url === this.url) {
                visited = true;
            }
        });

        return visited;
    }

    return {
        start: start,
        update: update,
        hasBeenVisited: hasBeenVisited
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

        $("*[data-anon-timer]").text(min + " min, " + sec + " sec");
    }

    var start = function() {
        // enable timer only if anon
        //if (curr_mode == "anon") {
        //    return;
        //}

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


var SizeProgressBar = (function() {

    var start = function() {
        var curr_size = $('.space-usage .progress-bar').attr('data-current-size');
        var max_size = $('.space-usage .progress-bar').attr('data-max-size');
        var percentage = Math.round($('.space-usage .progress-bar').attr('data-current-size') / $('.space-usage .progress-bar').attr('data-max-size') * 100);

        $('.space-usage .progress-bar').attr('aria-valuenow', percentage);
        $('.space-usage .progress-bar').attr('style', "width: " + percentage + "%");

        if (percentage < 70) {
            $('.space-usage .progress-bar').addClass('progress-bar-success');
        } else if (percentage >= 70 && percentage < 90) {
            $('.space-usage .progress-bar').addClass('progress-bar-warning');
        } else {
            $('.space-usage .progress-bar').addClass('progress-bar-danger');
        }
    }

    return {
        start: start
    }
})();

var ContentMessages = (function() {

    var messageIfDuplicateVisit = function(url) {
        // TODO: reconsider this
        // To check dupe, should check against all urls in collection, not just bookmarks
        /*if (BookmarkCounter.hasBeenVisited(url)) {
            showDuplicateVisitMessage(url);
            return true;
        }*/
        return false;
    }

    var showContentMessage = function(title, message) {
        $('body iframe').remove();
        $('body .wr-content').remove();
        $('body').addClass('interstitial-page');
        $('body').append('<div class="container wr-content"></div>');

        $('.wr-content').append(getMessageDOM(title, message));
    }

    var getMessageDOM = function(title, message) {
        // TODO: Put this in a reusable, server-side template
        return $('<div class="container col-md-6 col-md-offset-3 top-buffer-lg">' +
                    '<div class="panel panel-default">' +
                      '<div class="panel-heading">' +
                        '<span class="glyphicon glyphicon-info-sign" aria-hidden="true"></span>' +
                        '<strong class="left-buffer">' + title + '</strong>' +
                      '</div>' +

                      '<div class="panel-body">' +
                        message +
                      '</div>' +
                    '</div>' +
                  '</div>'
        );
    }

    var showDuplicateVisitMessage = function(bookmark) {
        // TODO: refactor the router to return urls or to do routing
        var recordingId = $('[data-recording-id]').attr('data-recording-id');
        var collectionId = $('[data-collection-id]').attr('data-collection-id');

        var host = window.location.protocol + "//" + window.location.host;
        var newRecordingUrl = host + "/" + user + "/" + collectionId + "/$new";
        var recordAnotherVersionOfUrl = host + "/" + user + "/" + collectionId + "/" + recordingId + "/record/" + bookmark;
        var replayCollectionUrl = host + "/" + user + "/" + collectionId + "/" + bookmark;

        var title = "<em>" + bookmark + "</em> is already in this recording"
        var message = '<div>You can:</div>' +
                '<ul>' +
                    '<li class="top-buffer-md"><a href="' + recordAnotherVersionOfUrl + '">Continue and record an additional copy</a> of this resource in this recording session</li>' +
                   '<li class="top-buffer-md"><a href="' + replayCollectionUrl + '">Replay</a> the most recent version of the resource in this recording session</li>' +
                    '<li class="top-buffer-md"><a href="' + newRecordingUrl + '">Start a new recording session</a> to record for this resource</li>' +
                '</ul>';

        showContentMessage(title, message)
    }

    return {
        showContentMessage: showContentMessage,
        messageIfDuplicateVisit: messageIfDuplicateVisit
    }
})();

$(function() {
    var lastUrl = undefined;
    var lastTs = undefined;
    var lastTitle = undefined;

    function handleReplayEvent(event) {
        var replay_iframe = window.document.getElementById("replay_iframe");

        if (!replay_iframe || event.source != replay_iframe.contentWindow) {
            return;
        }

        if (typeof(event.data) != "object") {
            return;
        }

        var state = event.data;

        if (state.wb_type == "load") {
            addNewPage(state);
        } else if (state.wb_type == "cookie") {
            setDomainCookie(state);
        } else if (state.wb_type == "snapshot") {
            uploadStaticSnapshot(state);
        } else if (state.wb_type == "hashchange") {
            var url = getUrl();
            url = url.split("#", 1)[0];
            if (state.hash) {
                url += state.hash;
            }
            setUrl(url);
        }
    }

    function setDomainCookie(state) {
        var url = window.location.origin;

        var cookie = state.cookie.split(";", 1)[0];
        if (!cookie) {
            return;
        }
        cookie = cookie.split("=", 2);

        var cookie_data = 
                    {
                     "name": cookie[0],
                     "value": cookie[1],
                     "domain": state.domain
                    }

        url += "/" + user + "/" + coll + "/$add_cookie";
        if (rec && rec != "*") {
            url += "?rec=" + rec;
        }

        $.ajax({
            url: url,
            method: "POST",
            data: cookie_data,
        })
        .fail(function(xhr, textStatus, errorThrown) {
            console.log("Cookie Domain Update Failed");
        });
    }

    function addNewPage(state) {
        if (state && state.ts) {
            $("#replay-date").text("from " + TimesAndSizesFormatter.ts_to_date(state.ts));
            $(".replay-wrap").show();
        }

        if (state.is_error) {
            setUrl(state.url);
        } else if (window.curr_mode == "record" || window.curr_mode == "patch") {
            if (lastUrl == state.url) {
                if (!state.ts && lastTs) {
                    return;
                }

                if (!state.title && lastTitle) {
                    return;
                }

                if (state.title == lastTitle && state.ts == lastTs) {
                    return;
                }
            }

            // if not is_live, then this page/bookmark is not a new recording
            // but is an existing replay
            if (window.curr_mode == "patch" && !state.is_live) {
                return;
            }

            var recordingId = wbinfo.info.rec_id;
            var attributes = {};

            attributes.url = state.url;

            attributes.timestamp = state.ts;
            attributes.title = state.title;

            var msg = (window.curr_mode == "record") ? "Recording" : "Patching";
            setTitle(msg, state.url, state.title);
            
            Recordings.addPage(recordingId, attributes);
            lastUrl = attributes.url;
            lastTs = attributes.timestamp;
            lastTitle = attributes.title;

        } else if (window.curr_mode == "replay" || window.curr_mode == "replay-coll") {
            setUrl(state.url);
            setTitle("Archived", state.url, state.title);
        }
    }

    function setTitle(status_msg, url, title) {
        //var title = $('iframe').contents().find('title').text();
        if (!title) {
            title = url;
        }
        document.title = title + " (" + status_msg + ")";
    }

    window.addEventListener("message", handleReplayEvent);

    // Only used for non-html pages
    $("#replay_iframe").load(function(e) {
        var replay_iframe = window.document.getElementById("replay_iframe");

        if (!replay_iframe) {
            return;
        }

        // Only update if haven't set from postMessage, eg. lastUrl is empty
        if (lastUrl) {
            return;
        }

        // extract actual url from replay url
        // no access to timestamp, it will be computed from recording
        var url = extract_replay_url(replay_iframe.getAttribute("src"));
        state = {"url": url }

        addNewPage(state);
    });

});
