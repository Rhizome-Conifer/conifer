Uploader = (function() {
    var bar = undefined;
    var percent = undefined;
    var status = undefined;
    var uploader = undefined;
    var currXhr = undefined;
    var pingTime = 3000;

    function doUpload(event) {
        event.preventDefault();

        var xhr = new XMLHttpRequest();
        var file = $("#choose-upload-file")[0].files[0];

        var force_coll;

        if ($("#upload-add").is(":checked")) {
            force_coll = $("#upload-coll").attr("data-collection-id");
        } else {
            force_coll = "";
        }

        xhr.upload.addEventListener("progress", uploadProgress);
        xhr.addEventListener("load", uploadSuccess);
        xhr.addEventListener("loadend", uploadComplete);

        var url = "/_upload?" + $.param({"force-coll": force_coll,
                                         "filename": file.name});

        xhr.open("PUT", url, true);

        status.text("Uploading...");

        setProgressBar('0');

        currXhr = xhr;

        $("body").css("cursor", "wait");

        $("#upload-modal button").prop("disabled", true);

        $("#upload-modal button.upload-cancel").prop("disabled", false);
        $("#upload-modal button.upload-cancel").text("Cancel Upload");

        uploader.show();
        status.show();
        status.removeClass("upload-error");

        xhr.send(file);

        return false;
    }

    function uploadProgress(event) {
        var percentVal = Math.round(50.0 * event.loaded / event.total);
        setProgressBar(percentVal);
        if (event.loaded >= event.total) {
            $("#upload-modal button.upload-cancel").prop("disabled", true);
        }
    }

    function uploadSuccess() {
        setProgressBar('50');
    }

    function setProgressBar(percentVal)
    {
        percentVal += '%';
        bar.width(percentVal)
        percent.html(percentVal);
    }

    function uploadComplete() {
        var xhr = currXhr;

        if (!xhr) {
            return;
        }

        var data = JSON.parse(xhr.responseText);

        var done = function(user, data) {
            addFlashMessage("Uploaded <i>" + data.filename + "</i> into <b>" + data.coll_title + "</b>", "success");

            RouteTo.collectionInfo(user, data.coll);
        }

        if (data && data.upload_id) {
            startIndexProgress(data.user,
                               data.upload_id,
                               50.0,
                               done);
            return;
        }

        var message = "Upload Status Missing";

        setError(data);

        currXhr = undefined;
    }

    function setError(data) {
        if (data.error_message) {
            message = data.error_message;
        }

        status.text(message);
        status.addClass("upload-error");
    }

    function startIndexProgress(user, upload_id, start, doneFunc, startData) {
        status.text("Indexing...");
        $("#upload-modal button.upload-cancel").prop("disabled", true);

        if (start === undefined) {
            start = 0;
        }

        var offset = (100.0 - start);

        var url = "/_upload/" + upload_id + "?user=" + user;

        function handleResponse(data) {
            if (data.filename) {
                $("#upload-file").val(data.filename);
            }

            if (data.total_files > 1) {
                var num = data.total_files - data.files + 1;
                status.text("Indexing " + num + " of " + data.total_files);
            }

            if (data.size && data.total_size) {
                var percentVal = start + Math.round(offset * data.size / data.total_size);

                setProgressBar(percentVal);

                if (data.size >= data.total_size) {
                    if (doneFunc) {
                        doneFunc(user, data);
                    }
                }
            } else if (data.error_message) {
                setError(data);
            }

            setTimeout(pingFunc, pingTime);
        }

        function pingFunc() {
            $.getJSON(url).done(handleResponse);
        }

        if (startData) {
            handleResponse(startData);
            setTimeout(pingFunc, pingTime);

        } else {
            setProgressBar(start);
            pingFunc();
        }
    }

    // for player initial load progress
    function playerInitProgress(load_data) {
        if (!load_data) {
            return;
        }

        if (load_data.done && load_data.size && load_data.size == load_data.total_size) {
            if (load_data.user && load_data.coll) {
                window.location.href = "/" + load_data.user + "/" + load_data.coll;
            }
            return;
        }

        if (load_data.total_size == 0) {
            var msg;
            if (load_data.filename) {
                msg = "Sorry, <b>" + load_data.filename + "</b> is not a valid web archive file";
            } else {
                msg = "Sorry, No Valid Files Provided, please try again";
            }
            $("#player-msg").html(msg);
            $("#player-msg").css("color", "red");
            $("#upload-label").hide();
            $(".player-load-progress").show();
            return;
        }

        var upload_id = load_data.upload_id;
        var user = load_data.user;

        var url = "/_upload/" + upload_id + "?user=" + user;

        var done = function(user, data) {
            if (data.done) {
                window.location.reload();
            } else {
                status.text("Almost Done!");
            }
        }

        pingTime = 1000;

        $(".player-load-progress").show();
        startIndexProgress(user, upload_id, 0, done, load_data);
        uploader.show();
        status.show();
    }

    function addFlashMessage(msg, msg_type) {
        $.getJSON("/_message?" + $.param({"message": msg,
                                          "msg_type": msg_type}));
    }

    function init() {
        bar = $('.upload-bar');
        percent = $('.upload-percent');
        status = $('#upload-status');
        uploader = $(".upload-progress");

        $("#choose-upload").click(function() {
            $("#choose-upload-file").click();
        });

        $("#choose-upload-file").on('change', function() {
            var filename = $(this).val().replace(/^C:\\fakepath\\/i, "");

            if (!filename.match(/\.w?arc(\.gz)?|\.har$/)) {
                status.text("Sorry, only WARC, ARC, or HAR files (.warc, .warc.gz, .arc, .arc.gz, .har) can be uploaded");
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

        $('#upload-form').submit(doUpload);

        $("#upload-modal").on('show.bs.modal', function() {
            $("#upload-modal button[type='button']").prop("disabled", false);
            $("#upload-modal button.upload-cancel").text("Cancel");
            uploader.hide();
            status.hide();
        });

        $('.upload-collection-select').on('click', function(event) {
            event.preventDefault();

            var currColl = $(this).attr('data-collection-id');

            $('#upload-coll').text($(this).text());
            $('#upload-coll').attr('data-collection-id', currColl);

            if (!$("#upload-add").is(":checked") && event.originalEvent) {
                $("#upload-add").click();
            }

        });

        var initialColl = $("#force-coll").val();
        if (initialColl) {
            $("a.upload-collection-select[data-collection-id='" + initialColl + "']").click();
        } else {
            $("a.upload-collection-select").first().click();
        }

        $(".upload-cancel").on('click', function() {
            if (currXhr) {
                currXhr.abort();
            }
        });
    }

    $(init);

    return {"startIndexProgress": startIndexProgress,
            "playerInitProgress": playerInitProgress
           }

})();


