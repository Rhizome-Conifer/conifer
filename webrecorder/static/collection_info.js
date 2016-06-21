$(function() {
    PublicPrivateSwitch.start();
    BookmarksTable.start();
    RecordingSelector.start();
    BookmarkHiddenSwitch.start();
    UrlManager.start();
});

var UrlManager = (function() {

    var update = function(event, recordingIds) {
        if (event.originalEvent || event.type === "RenameRecording") {
            updateUrl(recordingIds);
        }
    }

    var updateUrl = function(recordingIds) {
        var host = window.location.protocol + "//" + window.location.host;
        var url = host + "/" + user + "/" + coll;

        if (recordingIds.length > 0 && recordingIds[0] != "$all") {
            url += "/" + recordingIds.join(",");
        }

        window.history.pushState({"ids": recordingIds}, document.title, url);
    }

    var start = function() {
        $(window).on('popstate', selectPrevious);

        var selectedIds = getRecordingIdsFromUrl();

        window.history.replaceState({"ids": selectedIds}, document.title, window.location.href);
        RecordingSelector.select(selectedIds);
    }

    var selectPrevious = function(event) {
        if (!event.originalEvent.state) {
            return;
        }

        var ids = event.originalEvent.state.ids;
        $('.card').removeClass("card-selected");
        RecordingSelector.select(ids);
    };

    var getRecordingIdsFromUrl = function() {
        var url = document.location.href;
        return url.substring(url.lastIndexOf('/') + 1).split(',');
    }

    return {
        start: start,
        update: update
    }
})();

var RecordingSelector = (function() {

    var toggleRecordingSelection = function(event) {
        if(isNotSelectionEvent(event)) {
            return;
        }

        if (isAllRecordingsCard(this)) {
            $('.card-selected').removeClass('card-selected');
            $(this).addClass('card-selected');

            $('input:checked').prop('checked', false);

            $(this).find("input[type='checkbox']").prop('indeterminate', false);
            $(this).find("input[type='checkbox']").prop('checked', true);
        } else {
            $('[data-recording-id="$all"]').removeClass('card-selected');
            $(this).toggleClass('card-selected');

            var newCheckboxValue = !$(this).find("input[type='checkbox']").prop('checked');
            $(this).find("input[type='checkbox']").prop('checked', newCheckboxValue);

            $('[data-recording-id="$all"]').find("input[type='checkbox']").prop('indeterminate', true);

            if (isNothingSelected()) {
                $('[data-recording-id="$all"]').addClass('card-selected');

                $(this).find("input[type='checkbox']").prop('checked', false);

                $('[data-recording-id="$all"]').find("input[type='checkbox']").prop('indeterminate', false);
            }
        }

        BookmarksTable.filterByRecordings(getSelectedRecordingTitles());

        var recordingIds = getSelectedRecordingIds();

        updateRecordingFilterList(recordingIds);

        UrlManager.update(event, recordingIds);
    }

    var selectRecordings = function(recordingIds) {
        $.map(recordingIds, function(recordingId) {
            $('.recording-selector').find('[data-recording-id="' + recordingId + '"]').click();
        });
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

    var isNotSelectionEvent = function(event) {
        return $(event.target).hasClass('btn') || $(event.target).hasClass('glyphicon') || $(event.target).is('input');
    }

    var start = function() {
        $('.recording-selector').on('click', '.card', toggleRecordingSelection);
    }

    return {
        start: start,
        select: selectRecordings,
        getSelectedIds: getSelectedRecordingIds
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
                columnDefs: getColumnDefs(),
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

    var hasVisibilityColumn = function() {
        return $('.table-bookmarks th').length === 5;
    }

    var getColumnDefs = function() {
        if (hasVisibilityColumn()) {
            return [
                        { targets: [0, 1, 2, 3], orderable: true },
                        { targets: '_all',    orderable: false },
                        { targets: 0, width: "15em" },
                        { targets: [1, 4], width: "8em" },
                        { targets: 3, width: "4em" }
                    ]
        } else {
            return [
                        { targets: [1, 2, 3], orderable: true },
                        { targets: '_all',    orderable: false },
                        { targets: 0, width: "15em" },
                        { targets: [1, 3], width: "8em" }
                    ]
        }
    }

    var filterByRecordings = function(recordingTitles) {
        var recordingColumnIndex = $('[data-recording-column-index]').attr('data-recording-column-index');

        if (recordingTitles.length) {
            var regex = "^(" + recordingTitles.join("|") + ")$";
            theTable.column([recordingColumnIndex]).search(regex, true, false).draw();
        } else {
            theTable.column([recordingColumnIndex]).search("").draw();
        }
    }

    return {
        start: start,
        filterByRecordings: filterByRecordings
    }

})();

var BookmarkHiddenSwitch = (function() {

    var showNewHiddenState = function(response) {
        var bookmarkInfo = getBookmarkInfoFromSuccessResponse(response);
        var button = findButton(bookmarkInfo);

        toggleBookmarkHiddenState(button, bookmarkInfo);
        removeSpinner(button);
    }

    var showErrorMessage = function(xhr, textStatus, errorThrown, recordingId, attributes) {
        var bookmarkInfo = attributes;
        bookmarkInfo.recordingId = recordingId;
        var button = findButton(bookmarkInfo);

        removeSpinner(button);
        FlashMessage.show("danger", "Uh oh.  Something went wrong while updating your bookmark.  Please try again later or <a href='mailto: support@webrecorder.io'>contact us</a>.");
    }

    var getBookmarkInfoFromSuccessResponse = function(response) {
        var info = {};
        info.recordingId = response['recording-id'];
        info.timestamp = response['page-data']['timestamp'];
        info.url = response['page-data']['url'];
        info.hidden = response['page-data']['hidden'];
        return info;
    }

    var toggleBookmarkHiddenState = function(button, bookmarkInfo) {
        $(button).closest('[data-bookmark-hidden]').attr("data-bookmark-hidden", bookmarkInfo.hidden);

        if (bookmarkInfo.hidden === "1") {
            $(button).find('.glyphicon').removeClass('glyphicon-eye-open');
            $(button).find('.glyphicon').addClass('glyphicon-eye-close');
            $(button).find('.hidden-label').text('Show');
        } else {
            $(button).find('.glyphicon').removeClass('glyphicon-eye-close');
            $(button).find('.glyphicon').addClass('glyphicon-eye-open');
            $(button).find('.hidden-label').text('Hide');
        }
    }

    var getNewHiddenValue = function(button) {
        var currentHidden = $(button).closest('[data-bookmark-hidden]').attr("data-bookmark-hidden");
        return currentHidden === "1" ? "0" : "1";
    }

    var getAttributesFromDOM = function(button) {
        var attributes = {}
        attributes.url = $(button).closest('[data-bookmark-url]').attr("data-bookmark-url");
        attributes.timestamp = $(button).closest('[data-bookmark-timestamp]').attr("data-bookmark-timestamp");
        attributes.hidden = getNewHiddenValue(button);
        return attributes;
    }

    var toggleHideBookmark = function() {
        var recordingId = $(this).closest('[data-recording-id]').attr('data-recording-id');
        Recordings.modifyPage(recordingId, getAttributesFromDOM(this), showNewHiddenState, showErrorMessage);

        showSpinner(this);
    }

    var showSpinner = function(button) {
        var spinnerDOM = "<span class='hide-loading-spinner' role='alertdialog' aria-busy='true' aria-live='assertive'></span>";

        $(button).addClass('disabled');
        $(button).find('.glyphicon').hide();
        $(button).prepend(spinnerDOM);
    }

    var removeSpinner = function(button) {
        $(button).removeClass('disabled');
        $(button).find('.hide-loading-spinner').remove();
        $(button).find('.glyphicon').show();
    }

    var findButton = function(info) {
        var row = $("tr[data-recording-id='" + info.recordingId + "']" +
                "[data-bookmark-timestamp='" + info.timestamp + "']" +
                "[data-bookmark-url='" + info.url + "']");
        return $(row).find('.hidden-bookmark-toggle');
    }

    var start = function() {
        $('.bookmarks-panel').on('click', '.hidden-bookmark-toggle', toggleHideBookmark);
    }

    return {
        start: start
    }

})();