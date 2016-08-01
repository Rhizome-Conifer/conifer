$(function() {
    $("#choose-upload").click(function() {
        $("#choose-upload-file").click();
    });

    $("#choose-upload-file").on('change', function() {
        var filename = $(this).val().replace(/^C:\\fakepath\\/i, "");

        if (!filename.match(/\.w?arc(\.gz)?$/)) {
            status.text("Sorry, only WARC or ARC files (.warc, .warc.gz, .arc, .arc.gz) can be uploaded");
            status.addClass("upload-error");
            status.show();
            $("#upload-modal button[type='submit']").prop("disabled", true);
        } else {
            status.text();
            status.hide();
            $("#upload-modal button[type='submit']").prop("disabled", false);
        }

        $("#upload-file").val(filename);
    });

    var bar = $('.upload-bar');
    var percent = $('.upload-percent');
    var status = $('#upload-status');
    var uploader = $(".upload-progress");
      
    $('#upload-form').ajaxForm({
        beforeSerialize: function() {
            $("#force-coll").val($("#upload-coll").data("collection-id"));
        },

        beforeSend: function(xhr, settings) {
            status.text("Uploading...");

            var percentVal = '0%';
            bar.width(percentVal)
            percent.html(percentVal);

            $("body").css("cursor", "wait");

            $("#upload-modal button").prop("disabled", true);
            uploader.show();
            status.show();
            status.removeClass("upload-error");

        },
        uploadProgress: function(event, position, total, percentComplete) {
            var percentVal = percentComplete + '%';
            bar.width(percentVal)
            percent.html(percentVal);
            if (percentVal == "100%") {
                status.text("Processing...");
            }
        },

        success: function() {
            var percentVal = '100%';
            bar.width(percentVal)
            percent.html(percentVal);
        },

        complete: function(xhr) {
            $("#upload-modal button").prop("disabled", false);
            $("body").css("cursor", "inherit");

            data = xhr.responseJSON;

            if (data && data.uploaded && data.user && data.coll) {
                RouteTo.collectionInfo(data.user, data.coll);
                return;
            }

            var message = "Upload Status Missing";

            if (data.error_message) {
                message = data.error_message;
            }

            status.text(message);
            status.addClass("upload-error");
        }
    });

    $("#upload-modal").on('show.bs.modal', function() {
        $("#upload-modal button[type='button']").prop("disabled", false);
        //$("#upload-modal button[type='submit']").prop("disabled", true);
        uploader.hide();
        status.hide();
    });

    $('.upload-collection-select').on('click', function(event) {
        event.preventDefault();

        var currColl = $(this).data('collection-id');

        $('#upload-coll').text($(this).text());
        $('#upload-coll').data('collection-id', currColl);
    });


    var initialColl = $("#force-coll").val();
    if (initialColl) {
        $("a.upload-collection-select[data-collection-id='" + initialColl + "']").click();
    }


});


