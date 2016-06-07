$(function() {
    PublicPrivateSwitch.start();
    BookmarksTable.start();
    RecordingSelector.start();
})

var RecordingSelector = (function() {

    var toggleRecordingSelection = function(event) {
        if (isAllRecordingsCard(this)) {
            $('.card-selected').removeClass('card-selected');
            $(this).addClass('card-selected');
        } else {
            $('.recording-selector-panel').find('[data-recording-id="$all"]').removeClass('card-selected');
            $(this).toggleClass('card-selected');

            if (isNothingSelected()) {
                $('.recording-selector-panel').find('[data-recording-id="$all"]').addClass('card-selected');
            }
        }

        BookmarksTable.filterByRecordings(getSelectedRecordingTitles());
        updateRecordingFilterList(getSelectedRecordingIds());
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
                return $('.recording-selector-panel').find('[data-recording-id="' + recordingId + '"]')
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
        $('.recording-selector-panel').on('click', '.card', toggleRecordingSelection);
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
                lengthMenu: [[25, 50, 100, -1], [25, 50, 100, "All"]]
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