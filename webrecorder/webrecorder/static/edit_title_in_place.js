$(function() {
    EditTitleInPlace.start();
});

var EditTitleInPlace = (function() {

    var start = function() {
        $('.wr-content').on('click', '.edit-title', showEditForm);
        $('.wr-content').on('click', '.cancel-edit-title', cancelEdit);
        $('.wr-content').on('keyup', '.edit-title-form input', cancelEditOnEscapeButton);
        $('.wr-content').on('submit', '.edit-title-form', saveEdit);
        $('.edit-title-form input').on('click', 'a', function() { event.preventDefault() });
    }

    var showEditForm = function(event) {
        var editingId = $(this).attr('data-editing-id');
        hideTitleAndEditButton(editingId);
        showForm(editingId);
    }

    var hideTitleAndEditButton = function(editingId) {
        $(".edit-title[data-editing-id='" + editingId + "']").addClass("active");
        $(".editable-title[data-editing-id='" + editingId + "']").hide();
    }

    var showTitleAndEditButton = function(editingId) {
        $(".editable-title[data-editing-id='" + editingId + "']").show();
        $(".edit-title[data-editing-id='" + editingId + "']").removeClass("active");
    }

    var showForm = function(editingId) {
        var currentTitle = $(".editable-title[data-editing-id='" + editingId + "']").text();
        var form = $("form[data-editing-id='" + editingId + "']");
        var textInput = $(form).find('input');

        $(textInput).val(currentTitle);
        $(textInput).css('width', "66%");

        showFormButtons(editingId);

        $(".editable-title[data-editing-id='" + editingId + "']").after($(form));
        $(form).removeClass('collapse');
        $(form).find('[autofocus]').focus();
        $(form).addClass('edit-title-form-visible');
    }

    var hideForm = function(editingId) {
        $(".edit-title-form[data-editing-id='" + editingId + "']").removeClass('edit-title-form-visible');
        $(".edit-title-form[data-editing-id='" + editingId + "']").addClass('collapse');
    }

    var saveEdit = function(event) {
        event.preventDefault();

        var editingId = $(this).attr('data-editing-id');
        hideFormButtons(editingId);
        showSpinner(editingId);

        var functionName = $(this).attr('data-save-function');
        RenameTitle[functionName](editingId);
    }

    var showError = function(editingId, message) {
        removeSpinner(editingId);
        FlashMessage.show("danger", message);
        hideForm(editingId);
        showTitleAndEditButton(editingId);
    }

    var cancelEditOnEscapeButton = function(event) {
        if (event.keyCode === 27) {
            cancelEdit.apply(this);
        }
    }

    var cancelEdit = function() {
        var editingId = $(this).closest('form').attr('data-editing-id');
        hideForm(editingId);
        showTitleAndEditButton(editingId);
    }

    var hideFormButtons = function(editingId) {
        $("form[data-editing-id='" + editingId + "']").find('.submit-edit-title').hide();
        $("form[data-editing-id='" + editingId + "']").find('.cancel-edit-title').hide();
    }

    var showFormButtons = function(editingId) {
        $("form[data-editing-id='" + editingId + "']").find('.submit-edit-title').show();
        $("form[data-editing-id='" + editingId + "']").find('.cancel-edit-title').show();
    }

    var showSpinner = function(editingId) {
        var spinnerDOM = "<span class='btn btn-default btn-xs edit-title-loading-spinner' data-editing-id='" + editingId + "' role='alertdialog' aria-busy='true' aria-live='assertive'></span>";
        $(".edit-title-form[data-editing-id='" + editingId + "']").append(spinnerDOM);
    }

    var removeSpinner = function(editingId) {
        $(".edit-title-loading-spinner[data-editing-id='" + editingId + "']").remove();
    }

    var RenameTitle = {
        collection : function(editingId) {
            var collectionId = $('[data-collection-id]').attr('data-collection-id');
            var newName = $("[name='" + editingId + "']").val();
            Collections.rename(collectionId, newName, CollectionRename.done, CollectionRename.fail);
        },
        recording: function(editingId) {
            var recordingId = $(".editable-title[data-editing-id='" + editingId + "']").closest('.card').attr('data-recording-id');
            var newName = $("[name='" + editingId + "']").val();
            Recordings.rename(recordingId, newName, RecordingRename.done, RecordingRename.fail);
        },
        bookmark: function(editingId) {
            var bookmarkRow = $(".editable-title[data-editing-id='" + editingId + "']").closest('tr');

            var recordingId = $(bookmarkRow).attr('data-recording-id');
            var attributes = {}
            attributes.title = $("[name='" + editingId + "']").val();
            attributes.url = $(bookmarkRow).attr("data-bookmark-url");
            attributes.timestamp = $(bookmarkRow).attr('data-bookmark-timestamp');

            Recordings.modifyPage(recordingId, attributes, BookmarkRename.done, BookmarkRename.fail);
        }
    }

    var CollectionRename = {
        done: function(data, collectionId) {
            if (data.coll_id) {
                RouteTo.collectionInfo(user, data.coll_id);
            } else {
                var editingId = $(".editable-title[data-collection-id='" + collectionId + "']").attr('data-editing-id');
                showError(editingId, data.error_message);
            }
        },
        fail: function(xhr, collectionId) {
            var editingId = $(".editable-title[data-collection-id='" + collectionId + "']").attr('data-editing-id');
            var message = "Uh oh.  Something went wrong with renaming this collection.  Please try again later or <a href='mailto: support@webrecorder.io'>contact us</a>."
            showError(editingId, message);
        }
    }

    var BookmarkRename = {
        done: function(data) {
            var editingId = "bookmark-" + data['recording-id'] + "-" + data['page-data'].timestamp + "-" + data['page-data'].url;

            $(".editable-title[data-editing-id='" + editingId +"']").find('a').text(data['page-data'].title);

            hideForm(editingId);
            removeSpinner(editingId);
            showTitleAndEditButton(editingId);
        },
        fail: function(xhr, textData, errorThrown, recordingId, attributes) {
            var editingId = "bookmark-" + recordingId + "-" + attributes.timestamp + "-" + attributes.url;
            var message = "Uh oh.  Something went wrong with renaming this bookmark.  Please try again later or <a href='mailto: support@webrecorder.io'>contact us</a>."
            showError(editingId, message);
        }
    }

    var RecordingRename = {
        done: function(data, oldRecordingId) {
            var oldEditingId = "recording-title-" + oldRecordingId;
            var newEditingId = "recording-title-" + data.rec_id;

            if (!data.rec_id) {
                var editingId = $(".card[data-recording-id='" + oldRecordingId + "']").find('.editable-title').attr('data-editing-id');
                showError(editingId, data.error_message);
                return;
            }

            // Update data attributes
            $("[data-recording-id='" + oldRecordingId + "']").attr('data-recording-id', data.rec_id);
            $("[data-editing-id='" + oldEditingId + "']").attr('data-editing-id', newEditingId);
            $("input[name='" + oldEditingId + "']" ).attr('name', newEditingId);

            // Update card title
            $(".card[data-recording-id='" + data.rec_id + "']").attr('data-recording-title', encodeURI(data.title));
            $(".editable-title[data-editing-id='" + newEditingId + "']").text(data.title);

            // Update recording column in bookmarks table if it's visible (using data method to update internal search cache)
            var tr = $("tr[data-recording-id='" + data.rec_id + "']");
            if(tr.length) {
                theTable.cell(tr.find(".bookmark-recording-title")).data(data.title).draw();
            }

            // Update checkbox aria label
            $(".card[data-recording-id='" + data.rec_id + "']").find("input[type='checkbox']").attr('aria-label', "Filter bookmarks table by recording: " + encodeURI(data.title));

            // Update move rec
            //$("#move-rec-title[data-move-rec-id='" + oldRecordingId + "']").text(data.title);
            $("[data-move-rec-id='" + oldRecordingId + "']").attr("data-recording-title", encodeURI(data.title));
            $("[data-move-rec-id='" + oldRecordingId + "']").attr("data-move-rec-id", data.rec_id);

            //UrlManager.update(new Event("RenameRecording"), RecordingSelector.getSelectedIds());
            RecordingSelector.updateRecordingFilterList(new Event("RenameRecording"), true);

            hideForm(newEditingId);
            removeSpinner(newEditingId);
            showTitleAndEditButton(newEditingId);
        },
        fail: function(xhr, recordingId) {
            var editingId = $(".card[data-recording-id='" + recordingId + "']").find('.editable-title').attr('data-editing-id');
            var message = "Uh oh.  Something went wrong with renaming this recording.  Please try again later or <a href='mailto: support@webrecorder.io'>contact us</a>."
            showError(editingId, message);
        }
    }

    return {
        start: start
    }
})();
