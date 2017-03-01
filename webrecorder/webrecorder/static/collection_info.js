$(function() {
    PublicPrivateSwitch.start();
    BookmarksTable.start();
    RecordingSelector.start();
    BookmarkHiddenSwitch.start();
    UrlManager.start();
    MountInfo.start();
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

        if (recordingIds.length > 0) {
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
        //var url = decodeURI(document.location.href);
        var url = decodeURIComponent(document.location.pathname);
        var parts = url.split("/");

        if (parts.length < 4) {
            return [];
        }

        return parts[3].split(",");
    }

    return {
        start: start,
        update: update
    }
})();

var RecordingSelector = (function() {

    var toggleRecordingSelection = function(event) {
        if(isSelectionEvent(event)) {
            setSomeCardsSelected(event.target);

            BookmarksTable.filterByRecordings(getSelectedRecordingTitles());

            updateRecordingFilterList(event, true);
        }
    }
/*
    var setAllCardsSelected = function() {
        var allCard = $('[data-recording-id="$all"]');

        //$('.card-selected').removeClass('card-selected');
        //$('input:checked').prop('checked', false);

        $(allCard).addClass('card-selected');
        $(allCard).find("input[type='checkbox']").prop('indeterminate', false);
        $(allCard).find("input[type='checkbox']").prop('checked', true);
    }
*/
    var setSomeCardsSelected = function(element) {
        var card = $(element).closest('.card');

        //$('[data-recording-id="$all"]').removeClass('card-selected');
        //$('[data-recording-id="$all"]').find("input[type='checkbox']").prop('indeterminate', true);

        var newVal = !$(card).hasClass("card-selected");
        $(card).toggleClass('card-selected', newVal);

        $(card).find("div.filter-label").toggleClass("active", newVal);

        //if (isNothingSelected() || isEverythingSelected()) {
        //    setAllCardsSelected();
        //}
    }

    var getNewCheckboxValue = function(element) {
        //if ($(element).is('input[type=checkbox]')) {
        //    return $(element).prop('checked');
        //} else {
        //    return !$(element).closest('.card').find("input[type='checkbox']").prop('checked');
        //}
    }

    var selectRecordings = function(recordingIds) {
        $.map(recordingIds, function(recordingId) {
            $('.recording-selector').find('[data-recording-id="' + recordingId + '"]').click();
        });
    }

    var updateSelectedData = function() {
        var size = 0;
        var bookmarks = 0;

        var selected = $(".card-selected");

        if (selected.length == 0) {
            selected = $(".card");
            $("#sel-info").hide();
        } else {
            var msg = "(" + selected.length + " of " + $(".card").length + ")";
            $("#sel-info").text(msg);
            $("#sel-info").show();
        }

        var onlyMountCards = true;
        selected.each(function() {
            if($(this).data('mount') === '') {
                onlyMountCards = false;
                size += parseInt($(this).find("[data-size-display]").attr("data-size-display"));
            }

            bookmarks += parseInt($(this).find("[data-bookmark]").attr("data-bookmark"));
        });

        if(onlyMountCards) {
            $("#all-card").find("[data-size-display]").hide();
        } else {
            $("#all-card").find("[data-size-display]").show().attr("data-size-display", size);
        }
        $("#sel-bookmarks").text(bookmarks);

        TimesAndSizesFormatter.format();
    }

    var updateRecordingFilterList = function(event, urlUpdate) {
        var recordingIds = getSelectedRecordingIds();

        var recordingList = "";

        if (recordingIds.length == 0) {
            //recordingList = "All recordings";
            $('.recording-filter-list').closest("li").hide();
            $("#coll-breadcrumb-link").hide();
            $("#coll-breadcrumb-text").show();
            $('#clear-all').addClass('disabled')

        } else {
            var recordingTitles = getSelectedRecordingTitles();
            recordingList = recordingTitles.join(", ");
            $('.recording-filter-list').text(decodeURIComponent(recordingList));
            $('.recording-filter-list').closest("li").show();

            $("#coll-breadcrumb-link").show();
            $("#coll-breadcrumb-text").hide();

            $('#clear-all').removeClass('disabled')
            BookmarksTable.filterByRecordings(recordingTitles);
        }

        if (urlUpdate) {
            UrlManager.update(event, recordingIds);
        }

        updateSelectedData();
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

/*
    var isAllRecordingsCard = function(element) {
        return $(element).closest('.card').attr('data-recording-id') === "$all";
    }

    var isNothingSelected = function() {
        return $('.card-selected').length === 0;
    }

    var isEverythingSelected = function() {
        return ($('.card').length - 1) === $('.card-selected').length;
    }

    var hasOneRecording = function () {
        return $('.card').length === 2;
    }
*/
    var isSelectionEvent = function(event) {
        if ($(event.target).hasClass("filter-label")) {
            return true;
        }

        return !($(event.target).is('a') ||
            $(event.target).hasClass('btn') ||
            $(event.target).hasClass('glyphicon') ||
            $(event.target).is('input[type=text]'));
    }

    var clearFilters = function(event) {
        event.preventDefault();
        $('.card').removeClass("card-selected");
        $('.filter-label').removeClass("active");
        BookmarksTable.filterByRecordings([]);
        updateRecordingFilterList(event, true);
        return true;
    }

    var showMoveModal = function(event) {
        var recLink = $(event.relatedTarget);

        $("#move-rec-title").attr("data-move-rec-id", recLink.attr("data-move-rec-id"));
        $("#move-rec-title").text(decodeURIComponent(recLink.attr("data-recording-title")));

        var newColl = $(this).attr("data-collection-title");

        if (!newColl) {
            $(".collection-select")[0].click();
        }
    }

    var selectMoveColl = function(event) {
        event.preventDefault();

        var newColl = $(this).attr("data-collection-title");

        $("#move-coll").attr("data-move-to", newColl);
        $("#move-coll").text($(this).text());

        // enable 'Move' if newColl is set and is not current collection
        $("#confirm-move").prop('disabled', !newColl || newColl == coll_title);
    }

    var doMove = function(event) {
        var recordingId = $("#move-rec-title").data("move-rec-id");
        var newColl = $("#move-coll").attr("data-move-to");

        if (!newColl || !recordingId) {
            return;
        }

        Recordings.move(recordingId, newColl, RecordingMove.done, RecordingMove.fail);

        $("#move-modal").modal('hide');
    }

    var start = function() {
        $('div[data-recording-id]').on('click', toggleRecordingSelection);

        $("#clear-all").on('click', clearFilters);

        $('#move-modal').on('show.bs.modal', showMoveModal);

        $(".collection-select").on('click', selectMoveColl);

        $("#confirm-move").on('click', doMove);

        $("#num-recs").text($(".card").length)

        updateRecordingFilterList(undefined, false);
    }

    return {
        start: start,
        select: selectRecordings,
        getSelectedIds: getSelectedRecordingIds,
        updateRecordingFilterList: updateRecordingFilterList,
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

var theTable;
var BookmarksTable = (function() {

    var start = function() {
        if ($(".table-bookmarks").length) {
            var defaultOrder;
            if(getStorage('__wr_defaultOrder') && can_admin) {
                defaultOrder = JSON.parse(getStorage('__wr_defaultOrder'));
            } else if(hasVisibilityColumn()) {
                defaultOrder = [[4, 'asc']];
            } else {
                defaultOrder = [[2, 'asc']];
            }

            theTable = $(".table-bookmarks").DataTable({
                paging: false,
                columnDefs: getColumnDefs(),
                order: defaultOrder,
                language: {
                    search: "Filter:",
                    emptyTable: "No bookmarks available in the table",
                    info: "Showing _START_ to _END_ of _TOTAL_ bookmarks",
                    infoEmpty: "Showing 0 to 0 of 0 bookmarks",
                    infoFiltered: "(filtered from _MAX_ total bookmarks)",
                    lengthMenu: "Show _MENU_ bookmarks",
                    zeroRecords: "No matching bookmarks found"

                },
                dom: '<"table-bookmarks-top">tr<"table-bookmarks-bottom"pl><"clear">'
            });

            // make ordering changes sticky
            theTable.on('order', function (evt) {
                setStorage('__wr_defaultOrder', JSON.stringify(theTable.order()));
            })
        }
    }

    var hasVisibilityColumn = function() {
        return $('.table-bookmarks th').length === 7;
    }

    var getColumnDefs = function() {
        if(hasVisibilityColumn()) {
            return [
                        { targets: [0], width: "32px", orderable: false},
                        { targets: [1], width: "12px", orderable: false},
                        { targets: [3], width: '85px'},
                        { targets: [4], width: "9em" },
                        { targets: [6], width: "5.5em" },
                        { targets: [2, 5], width: "14.5em"}
                    ]
        } else {
            return [
                        { targets: [1], width: "85px"},
                        { targets: [2], width: "9em" },
                        { targets: [4], width: "5em" },
                        { targets: [0, 3], width: "14.5em" }
                    ]
        }
    }

    var filterByRecordings = function(recordingTitles) {
        var recordingColumnIndex = $('[data-recording-column-index]').attr('data-recording-column-index');

        // trim trailing spaces
        recordingTitles = recordingTitles.map(function (t) { return decodeURIComponent(t).replace(/\s+$/g, ''); });

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

        var showHidden = $("#show-hidden").is(':checked');

        if (bookmarkInfo.hidden === "1") {
            $(button).find('.glyphicon').removeClass('glyphicon-eye-open');
            $(button).find('.glyphicon').addClass('glyphicon-eye-close');
            $(button).find('.hidden-label').text('Show');
            $(button).closest('tr').addClass("hidden-bookmark");
            if (!showHidden) {
                $(button).closest('tr').hide();
            }
        } else {
            $(button).find('.glyphicon').removeClass('glyphicon-eye-close');
            $(button).find('.glyphicon').addClass('glyphicon-eye-open');
            $(button).find('.hidden-label').text('Hide');
            $(button).closest('tr').removeClass("hidden-bookmark");
            if (!showHidden) {
                $(button).closest('tr').show();
            }
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

    var toggleShowHidden = function() {
        if (this.checked) {
            $("tr[data-bookmark-hidden='1']").show();
        } else {
            $("tr[data-bookmark-hidden='1']").hide();
        }
    }

    var addTag = function(evt) {
        evt.preventDefault();

        var url = $(this).closest('[data-bookmark-url]').attr('data-bookmark-url');
        var ts = $(this).closest('[data-bookmark-timestamp]').attr('data-bookmark-timestamp');
        var br = $(this).closest('[data-bookmark-browser]').attr('data-bookmark-browser');

        var recordingId = $(this).closest('[data-recording-id]').attr('data-recording-id');
        var bookmarkId = url + ' ' + ts + ' ' + br;
        var tagElement = $(evt.target).parent('li.tag');
        var tag = tagElement.data('tag');
        var successClasss = 'tagged';

        Recordings.tagPage(
            recordingId,
            bookmarkId,
            [tag],
            function (){
                // update ui
                if(tagElement.hasClass(successClasss)){
                    tagElement.removeClass(successClasss);

                    if(tagElement.siblings('.'+successClasss).length === 0)
                        tagElement.parents('div.btn-group').find('button').switchClass('btn-success','btn-default');
                } else {
                    tagElement.addClass(successClasss);
                    tagElement.parents('div.btn-group').find('button').addClass('btn-success');
                }
            },
            function (){ console.log('error tagging bookmark', bookmarkId); }
        );
    }


    var start = function() {
        $("#show-hidden").bootstrapSwitch();

        $('th.bookmark-hidden-switch>div.bootstrap-switch').attr('title', 'Show/Hide hidden bookmarks')

        $('.bookmarks-panel').on('click', '.hidden-bookmark-toggle', toggleHideBookmark);

        $("#show-hidden")
            .on('switchChange.bootstrapSwitch', toggleShowHidden)
            .trigger('switchChange.bootstrapSwitch');

        $("tr[data-bookmark-hidden='1']").addClass("hidden-bookmark");
    }

    return {
        start: start
    }

})();


var RecordingMove = {
        done: function(data, collectionId) {
                window.location.reload();
                if (data.coll_id) {
                    //RouteTo.collectionInfo(user, data.coll_id);
                    //FlashMessage.show("success", "Test");
                } else {
                    //FlashMessage.show("danger", data.error_message);
                }
        },
        fail: function(xhr, collectionId) {
                //var editingId = $(".editable-title[data-collection-id='" + collectionId + "']").attr('data-editing-id');
                var message = "Uh oh.  Something went wrong with renaming this collection.  Please try again later or <a href='mailto: support@webrecorder.io'>contact us</a>."
                FlashMessage.show("danger", message);
        }
}



var MountInfo = (function(){
    function start() {
        $('#mount-form').submit(function() {
            if ($("#mount-type").find(":selected").val() == "ait") {
                $("#mount-title").val("AIT " + $("#ait-data").val());
            }
        });

        function toggle_archive_type() {
            $("#mount-modal .hide-option").hide();
            $("#mount-modal .hide-option input").attr("required", false);
            var value = $("#mount-type").val();
            $("." + value + "-option").show();
            $("." + value + "-option input").attr("required", true);
        }

        $('#mount-modal').on('show.bs.modal', toggle_archive_type);

        $("#mount-type").on('change', toggle_archive_type);
    }
    return {start: start};
})();

