$(function() {
    PublicPrivateSwitch.start();
    BookmarksTable.start();
    RecordingSelector.start();
});

var RecordingSelector = (function() {

    var toggleRecordingSelection = function(event) {
        if (isAllRecordingsCard(this)) {
            $('.card-selected').removeClass('card-selected');
            $(this).addClass('card-selected');
        } else {
            $('.recording-selector').find('[data-recording-id="$all"]').removeClass('card-selected');
            $(this).toggleClass('card-selected');

            if (isNothingSelected()) {
                $('.recording-selector').find('[data-recording-id="$all"]').addClass('card-selected');
            }
        }

        BookmarksTable.filterByRecordings(getSelectedRecordingTitles());

        var recordingIds = getSelectedRecordingIds();

        updateRecordingFilterList(recordingIds);

        // check if user-generated event (not from popState)
        if (event.originalEvent) {
            updateUrl(recordingIds, $(this).attr("data-recording-id"));
        }
    }

    var selectPrevious = function(event) {
        if (!event.originalEvent.state) {
            return;
        }

        var ids = event.originalEvent.state.ids;

        // First, clear selection on all cards
        $('.card').removeClass("card-selected");

        selectRecordings(ids);
    };

    var selectRecordings = function(recordingIds) {
        $.map(recordingIds, function(recordingId) {
            $('.recording-selector').find('[data-recording-id="' + recordingId + '"]').click();
        });
    }

    var updateUrl = function(recordingIds, currId) {
        var host = window.location.protocol + "//" + window.location.host;

        var url = host + "/" + user + "/" + coll;

        if (recordingIds.length > 0 && recordingIds[0] != "$all") {
            url += "/" + recordingIds.join(",");
        }

        window.history.pushState({"ids": recordingIds}, document.title, url);
    }

    var updateRecordingFilterList = function(recordingIds) {
        var recordingList = "";

        if (recordingIds[0] === "$all") {
            recordingList = "All recordings";
        } else {
            var recordingTitles = getSelectedRecordingTitles();
            recordingList = recordingTitles.join(", ");
        }

        $('.recording-filter-list').text(recordingList);
    }

    var getSelectedRecordingTitles = function() {
        var recordingIds = getSelectedRecordingIds();
        return $.map(recordingIds, function(recordingId) {
                return $('.recording-selector').find('[data-recording-id="' + recordingId + '"]')
                        .attr('data-recording-title') });
    }

    var getSelectedRecordingIds = function() {
        return $('.card-selected').map( function(){ return $(this).attr('data-recording-id') }).get();
    }

    var isAllRecordingsCard = function(element) {
        return $(element).attr('data-recording-id') === "$all";
    }

    var isNothingSelected = function() {
        return $('.card-selected').length === 0;
    }

    var start = function() {
        $('.recording-selector').on('click', '.card', toggleRecordingSelection);

        // selectPrevious recordings on popstate
        $(window).on('popstate', selectPrevious);

        // Set current state to provided list of ids
        window.history.replaceState({"ids": init_selected_recs}, document.title, window.location.href);

        // programmatically click initial set of ids
        selectRecordings(init_selected_recs);
    }

    return {
        start: start
    }
})();

var PublicPrivateSwitch = (function() {

    var updatePermission = function(event, state) {
        $.ajax({
            url: "/api/v1/collections/" + coll + "/public?user=" + user,
            method: "POST",
            data: {"public": state},

            success: function() {
                $(".ispublic").bootstrapSwitch("state", state, true);
            },
            error: function() {
                //$("#is_public").prop("checked", !state);
                $(".ispublic").bootstrapSwitch("toggleState", true)
                console.log("err");
            }
        });
    }

    var start = function() {
        if (can_admin) {
            $(".ispublic").bootstrapSwitch();

            $(".ispublic").on('switchChange.bootstrapSwitch', updatePermission);
        }
    }

    return {
        start: start
    }
})();

var BookmarksTable = (function() {

    var theTable;

    var start = function() {
        if ($(".table-bookmarks").length) {
            theTable = $(".table-bookmarks").DataTable({
                paging: true,
                columnDefs: [
                    { targets: [0, 1, 2, 3], orderable: true },
                    { targets: '_all',    orderable: false }
                ],
                order: [[1, 'desc']],
                lengthMenu: [[25, 50, 100, -1], [25, 50, 100, "All"]],
                language: {
                    search: "Filter:",
                    emptyTable: "No bookmarks available in the table",
                    info: "Showing _START_ to _END_ of _TOTAL_ bookmarks",
                    infoEmpty: "Showing 0 to 0 of 0 bookmarks",
                    infoFiltered: "(filtered from _MAX_ total bookmarks)",
                    lengthMenu: "Show _MENU_ bookmarks",
                    zeroRecords: "No matching bookmarks found"

                },
                dom: '<"table-bookmarks-top"f>tr<"table-bookmarks-bottom"ipl><"clear">'
            });
        }
    }

    var filterByRecordings = function(recordingTitles) {
        var regex = recordingTitles.join("|");
        theTable.column([3]).search(regex, true, false).draw();
    }

    return {
        start: start,
        filterByRecordings: filterByRecordings
    }

})();

var Collections = (function() {
    var API_ENDPOINT = "/api/v1/collections";
    var query_string = "?user=" + user

    var get = function(user, doneCallback, failCallback) {
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

    var rename = function(collectionId, newName, doneCallback, failCallback) {
        $.ajax({
            url: API_ENDPOINT + "/" + collectionId + "/rename/" + newName + query_string,
            method: "POST"
        })
        .done(function(data, textStatus, xhr) {
            doneCallback(data);
        })
        .fail(function(xhr, textStatus, errorThrown) {
            failCallback(xhr);
        });
    }

    return {
        get: get,
        rename: rename
    }
})();
