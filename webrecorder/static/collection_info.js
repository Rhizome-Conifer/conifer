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
        }

        var recordingIds = $('.card-selected').map( function(){ return $(this).attr('data-recording-id') });

        BookmarksTable.filterByRecordings(recordingIds);
        updateRecordingFilterList(recordingIds);
    }

    var updateRecordingFilterList = function(recordingIds) {
        var recordingList = "";

        if (recordingIds[0] === "$all") {
            recordingList = "All recordings";
        } else {
            $.each(recordingIds, function() {
                var title = $('.recording-selector-panel').find('[data-recording-id="' + this + '"]').attr('data-recording-title');
                recordingList += title;
                recordingList += ", ";
            });
            recordingList = recordingList.replace(/(,\s*$)/g, '');
        }

        $('.recording-filter-list').text(recordingList);
    }

    var isAllRecordingsCard = function(element) {
        return $(element).attr('data-recording-id') === "$all";
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
        if ($(".table-recordings").length) {
            theTable = $(".table-recordings").DataTable({
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

    var filterByRecordings = function(recordingIds) {
        console.log("filtering:" + recordingIds);
    }

    return {
        start: start,
        filterByRecordings: filterByRecordings
    }

})();