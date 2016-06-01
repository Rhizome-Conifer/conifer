if (!user) {
    user = curr_user;
}

$(function() {
    EventHandlers.bindAll();
    TimesAndSizesFormatter.format();
    RecordingSizeWidget.start();
    PagesWidgets.start();
    CountdownTimer.start();
    SizeProgressBar.start();
});

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

        // 'Homepage': 'Record' button
        $('.wr-content').on('submit', '.start-recording-homepage', function(event) {
            event.preventDefault();

            if (!user) {
                user = "$temp";
                var collection = "temp";
                var title = "My First Recording";
            } else {
                var collection = $('[data-collection-id]').attr('data-collection-id');
                var title = $("input[name='title']").val();
            }
            var url = $(".start-recording-homepage input[name='url']").val();

            RouteTo.recordingInProgress(user, collection, title, url);
        });

        // 'Homepage': Logged in collection dropdown select
        $('.wr-content').on('click', '.collection-select', function(event){
            event.preventDefault();

            $('.dropdown-toggle-collection').html(
                $('<span class="dropdown-toggle-label" data-collection-id="' +
                    $(this).data('collection-id') + '">' +
                        $(this).text() + " " +
                    '<span class="caret"></span>'));
        });

        // 'New recording': Start button
        $('header').on('submit', '.start-recording', function(event) {
            event.preventDefault();

            var collection = $('[data-collection-id]').attr('data-collection-id');
            var title = $("input[name='title']").val();
            var url = $("input[name='url']").val();

            RouteTo.recordingInProgress(user, collection, title, url);
        });

        // 'Recording in progress': Url bar submit / enter key
        $('header').on('submit', '.recording-in-progress', function(event) {
            event.preventDefault();

            var url = $("input[name='url']").val();
            var recordingId = $('[data-recording-id]').attr('data-recording-id');

            if (ContentMessages.messageIfDuplicatePage(url)) { return; }

            RouteTo.recordingInProgress(user, coll, recordingId, url);
        });

        // 'Recording in progress': Stop recording button
        $('header').on('submit', '.stop-recording', function(event) {
            event.preventDefault();

            var recordingId = $('[data-recording-id]').attr('data-recording-id');
            var collectionId = $('[data-collection-id]').attr('data-collection-id');

            RouteTo.recordingInfo(user, collectionId, recordingId);
        });

        // 'Replay recording': Url bar 'Go' button / enter key
        $('header').on('submit', '.replay-recording', function(event) {
            event.preventDefault();

            var url = $("input[name='url']").val();

            RouteTo.browseRecording(user, coll, wbinfo.info.rec_id, url);
        });

        // 'Replay recording': 'Add pages' button
        $('header').on('submit', '.add-to-recording', function(event){
            event.preventDefault();

            var url = $("input[name='url']").val();

            RouteTo.addToRecording(user, coll, wbinfo.info.rec_id, url);
        });

        // 'Replay recording': 'Patch page' button
        $('header').on('click', '.patch-page', function(event){
            event.preventDefault();

            var url = $("input[name='url']").val();

            RouteTo.patchPage(user, coll, wbinfo.info.rec_id, url);
        });

        // 'Replay'/'Recording in progress': 'List pages' toggle
        $('.header').on('mouseenter', '.list-pages-toggle', function(event) {
            $(this).css('cursor', 'pointer');
        })

        // 'Patch page': 'Stop' button
        $('header').on('submit', '.finish-patching', function(event) {
            event.preventDefault();

            var url = $('.patch-url').text();

            RouteTo.browseRecording(user, coll, wbinfo.info.rec_id, url);
        });

        // Hide Page
        $(".hide-page").on('click', function(event) {
            event.preventDefault();

            var attributes = {}
            attributes.url = $(this).attr("data-page-url");
            attributes.timestamp = $(this).attr("data-page-ts");
            attributes.hidden = $(this).attr("data-page-hidden") == "1" ? "0" : "1";

            var doReload = function() {
                window.location.reload();
            }

            //Recordings.removePage(window.rec, attributes, doReload);
            Recordings.modifyPage(window.rec, attributes, doReload);
        });
            
        // 'Header': 'Login' link to display modal
        $('#login-modal').on('shown.bs.modal', function() {
            $('#username').focus();
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
        });
    }

    return {
        bindAll: bindAll
    }
})();

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
            failCallback(xhr);
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
            failCallback(xhr);
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
            PagesWidgets.update(attributes);
        })
        .fail(function(xhr, textStatus, errorThrown) {
            // Fail gracefully when the page can't be updated
        });
    }

    var modifyPage = function(recordingId, attributes, doneCallback) {
        var attributes = attributes;
        $.ajax({
            url: API_ENDPOINT + "/" + recordingId + "/page/" + attributes.url + query_string,
            method: "POST",
            data: attributes
        })
        .done(function(data, textStatus, xhr){
            doneCallback(data);
            //PagesWidgets.update(attributes);
        })

        .fail(function(xhr, textStatus, errorThrown) {
            // Fail gracefully when the page can't be updated
        });
    }

    var removePage = function(recordingId, attributes, doneCallback) {
        $.ajax({
            url: API_ENDPOINT + "/" + recordingId + "/pages" + query_string,
            method: "DELETE",
            data: attributes
        })
        .done(function(data, textStatus, xhr){
            doneCallback(data);
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
            failCallback(xhr);
        });
    }

    return {
        get: get,
        addPage: addPage,
        removePage: removePage,
        modifyPage: modifyPage,
        getPages: getPages
    }
}());

var RouteTo = (function(){
    var host = window.location.protocol + "//" + window.location.host;

    var recordingInProgress = function(user, collection, recording, url, mode) {
        if (!mode) {
            mode = "record";
        }

        routeTo(host + "/" + user + "/" + collection + "/" + recording + "/" + mode + "/" + url);
    }

    var collectionInfo = function(user, collection) {
        routeTo(host + "/" + user + "/" + collection);
    }

    var recordingInfo = function(user, collection, recording) {
        routeTo(host + "/" + user + "/" + collection + "/" + recording);
    }

    var browseRecording = function(user, collection, recording, url) {
        routeTo(host + "/" + user + "/" + collection + "/" + recording + "/" + url);
    }

    var addToRecording = function(user, collection, recording) {
        routeTo(host + "/" + user + "/" + collection + "/" + recording + "/$add");
    }

    var patchPage = function(user, collection, recording, url) {
        recordingInProgress(user, collection, recording, url, "patch");
    }

    var routeTo = function(url) {
        window.location.href = url;
    }

    return {
        recordingInProgress: recordingInProgress,
        collectionInfo: collectionInfo,
        recordingInfo: recordingInfo,
        browseRecording: browseRecording,
        addToRecording: addToRecording,
        patchPage: patchPage,
    }
}());

var RecordingSizeWidget = (function() {
    var sizeUpdateId = undefined;
    var recordingId;
    var collectionId;

    var start = function() {
        if ($('.size-counter-active').length) {
            recordingId = $('[data-recording-id]').attr('data-recording-id');
            collectionId = $('[data-collection-id]').attr('data-collection-id');

            if (isOutOfSpace()) {
                RouteTo.recordingInfo(user, collectionId, recordingId);
            }

            pollForSizeUpdate();
            sizeUpdateId = setInterval(pollForSizeUpdate, 1000);
        }
    }

    var pollForSizeUpdate = function() {
        Recordings.get(recordingId, updateSizeCounter, dontUpdateSizeCounter);
        exclude_password_targets();
        if (isAlmostOutOfSpace() && !warningPresent()) {
            showWarningMessage();
            disableUrlBar();
        }
    }

    var updateSizeCounter = function(data) {
        var spaceUsed = format_bytes(data.recording.size);

        updateDom(spaceUsed);
    }

    var updateDom = function(spaceUsed) {
        $('.size-counter .current-size').text(spaceUsed);
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

var PagesWidgets = (function() {
    var sortedPages;

    var start = function() {
        if ($(".pages-combobox").length) {
            var recordingId = $('[data-recording-id]').attr('data-recording-id');
            Recordings.getPages(recordingId, startPagesWidgets, dontStartPagesWidgets);
        }
    }

    var update = function(attributes) {
        $("input[name='url']").val(attributes.url);
        $('.pages-combobox').typeahead('destroy');
        PagesWidgets.start();
    }

    var startPagesWidgets = function(data) {
        sortedPages = data.pages.sort(function(p1, p2) {
            return p1.timestamp - p2.timestamp;
        });

        setPageIndex();
        setPageCount();
        initializeTypeahead();
    }

    var dontStartPagesWidgets = function() {
        // If we can't load this recording's pages,
        // do nothing to leave url as a regular
        // input field
    }

    var setPageCount = function() {
        $('.page-count').html(formatPageCount(sortedPages));
    }

    var setPageIndex = function() {
        var currentUrl = $("input[name='url']").val();
        var currentPageIndex = getPageIndexByUrl(currentUrl, sortedPages);
        $('.page-index').text(currentPageIndex);
    }

    var getPageIndexByUrl = function(url, pages) {
        var currentPageIndex = "-";

        $.each(sortedPages, function(index) {
            if (url === this.url) {
                currentPageIndex = index + 1;
            }
        });
        return currentPageIndex;
    }

    var initializeTypeahead = function() {
        var source = substringMatcher(sortedPages);

        $(".pages-combobox").typeahead(
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
                    header: '<h5 class="left-buffer-sm">Recorded Pages</h5>',
                    suggestion: function(data) {
                        return "<div>" +
                            "<span class='suggestion-index text-right'>" +
                                getPageIndexByUrl(data.url, sortedPages) +
                            ".</span>" +
                            formatSuggestionUrl(data.url) +
                            "<span class='suggestion-timestamp pull-right'>" +
                                ts_to_date(data.timestamp) +
                            "</span>" +
                        "</div>";
                    }
                }
            });
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

    var formatPageCount = function(pages) {
        var pageString = "pages";
        if (pages.length === 1) {
            pageString = "page";
        }

        return pages.length + " " + pageString + "<strong> / </strong>"
    }

    var isAlreadyRecorded = function(page) {
        return getPageIndexByUrl(page) !== "-";
    }

    return {
        start: start,
        update: update,
        isAlreadyRecorded: isAlreadyRecorded
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

var DataTables = (function() {

    var theTable;

    var start = function() {
        if ($(".table-recordings").length) {
            theTable = $(".table-recordings").DataTable({
                paging: false,
                columnDefs: [
                    { targets: [1, 2, 3], orderable: true },
                    { targets: '_all',    orderable: false}
                ],
                order: [[2, 'desc']]
            });

            // Add event listener for opening and closing details
            $('.table-recordings tbody').on('click', 'tr', toggleDetails);
        }
    }

    var toggleDetails = function(event) {
        // Don't toggle details for link or button clicks when table row is clicked
        if ($(event.target).is('a') || $(event.target).is('button')) {
            return;
        }

        var tr = $(this);
        var row = theTable.row(this);

        if (row.child.isShown()) {
            row.child.hide();
            tr.removeClass('shown');
            tr.find('.details-control .glyphicon').removeClass('glyphicon-chevron-down');
            tr.find('.details-control .glyphicon').addClass('glyphicon-chevron-right');
        }
        else {
            row.child(formatDetails(row.data())).show();
            tr.addClass('shown');
            tr.find('.details-control .glyphicon').removeClass('glyphicon-chevron-right');
            tr.find('.details-control .glyphicon').addClass('glyphicon-chevron-down');
        }
    }

    var formatDetails = function(data) {
        var detailsTable = $(data[0])[2];
        $(detailsTable).removeClass('hidden');
        return detailsTable;
    }

    return {
        start: start
    }

})();

var TimesAndSizesFormatter = (function() {

    var format_by_attr = function (attr_name, format_func) {
        $("[" + attr_name + "]").each(function(i, elem) {
            $(elem).text(format_func($(elem).attr(attr_name)));
        });
    }

    var format = function() {
        format_by_attr("data-size", format_bytes);
        format_by_attr("data-time-ts", ts_to_date);
        format_by_attr("data-time-sec", function(val) { return new Date(parseInt(val) * 1000).toLocaleString(); });
    }

    return {
        format: format
    }
})();


var ContentMessages = (function() {

    var messageIfDuplicatePage = function(page) {
        if (PagesWidgets.isAlreadyRecorded(page)) {
            showDuplicatePageMessage(page);
            return true;
        }
        return false;
    }

    var showDuplicatePageMessage = function(page) {
        $('body iframe').remove();
        $('body .wr-content').remove();
        $('body').addClass('interstitial-page');
        $('body').append('<div class="container wr-content"></div>');

        $('.wr-content').append(
            getMessageDOM(
                "<em>" + page + "</em> is already in this recording",
                getDuplicatePageMessage(page)));
    }

    var getDuplicatePageMessage = function(page) {
        // TODO: refactor the router to return urls or to do routing
        var recordingId = $('[data-recording-id]').attr('data-recording-id');
        var collectionId = $('[data-collection-id]').attr('data-collection-id');

        var host = window.location.protocol + "//" + window.location.host;
        var newRecordingUrl = host + "/" + user + "/" + collectionId + "/$new";
        var overwriteUrl = host + "/" + user + "/" + collectionId + "/" + recordingId + "/record/" + page;
        var replayUrl = host + "/" + user + "/" + collectionId + "/" + recordingId + "/" + page;

        return  '<div>You can:</div>' +
                '<ul>' +
                    '<li class="top-buffer-md"><a href="' + overwriteUrl + '">Continue and overwrite</a> the existing version of this page</li>' +
                    '<li class="top-buffer-md"><a href="' + replayUrl + '">Replay</a> the version of the page in this recording</li>' +
                    '<li class="top-buffer-md"><a href="' + newRecordingUrl + '">Start a new recording</a> to record another copy of this page</li>' +
                '</ul>';
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

    return {
        messageIfDuplicatePage: messageIfDuplicatePage
    }
})();

// Check as soon as frame is loaded
$("#replay_iframe").load(function() {
    exclude_password_targets();
});

var pass_form_targets = {};

function exclude_password_targets() {
    if (typeof wbinfo === "undefined" || (wbinfo.state != "record" && wbinfo.state != "patch")) {
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




$(function() {
    var lastUrl = undefined;

    function urlChangeMessage(event) {
        var replay_iframe = window.document.getElementById("replay_iframe");

        if (!replay_iframe || event.source != replay_iframe.contentWindow) {
            return;
        }

        if (typeof(event.data) != "object") {
            return;
        }

        var state = event.data;

        if (!state.wb_type || state.wb_type != "load") {
            return;
        }

        addNewPage(state);
    }

    function addNewPage(state) {
        if (state.is_error) {
            $("input[name='url']").val(state.url);
        } else if (wbinfo.state == "record" || wbinfo.state == "patch") {
            if (lastUrl == state.url) {
                return;
            }

            var recordingId = wbinfo.info.rec_id;
            var attributes = {};

            attributes.url = state.url;

            attributes.timestamp = state.ts;
            attributes.title = $('iframe').contents().find('title').text();
            
            Recordings.addPage(recordingId, attributes);
            lastUrl = attributes.url;

        } else if (wbinfo.state == "replay" || wbinfo.state == "replay-coll") {
            $("input[name='url']").val(state.url);
        }
    }

    window.addEventListener("message", urlChangeMessage);

    // Only used for non-html pages
    $("#replay_iframe").load(function(e) {
        var replay_iframe = window.document.getElementById("replay_iframe");

        // if WB_wombat_location present, then likely already received a message
        if (replay_iframe.contentWindow && replay_iframe.contentWindow.wbinfo) {
            return;
        }

        // extract actual url from replay url
        // no access to timestamp, it will be computed from recording
        var url = extract_replay_url(replay_iframe.contentWindow.location.href);
        state = {"url": url }

        addNewPage(state);
    });

});
