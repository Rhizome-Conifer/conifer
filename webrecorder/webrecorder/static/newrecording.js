$(function() {
    // 'New recording': Start button
    $('header').on('submit', '.start-recording', startNewRecording);

    // 'Homepage': 'Record' button
    $('.wr-content').on('submit', '.start-recording-homepage', startNewRecording);


    function startNewRecording(event) {
        event.preventDefault();

        var collection;

        if (!user) {
            user = "$temp";
            collection = "temp";
        } else {
            collection = $('[data-collection-id]').attr('data-collection-id');
        }

        var titleInput = $("input[name='rec-title']");
        var title = titleInput.val();
        var urlInput = $("input[name='url']");
        var url = urlInput.val().trim();

        // alert if title is blank
        if (title.replace(/\s+$/g, '').length === 0) {
            titleInput.parent().addClass('has-error');
            return false;
        } else if (titleInput.parent().hasClass('has-error')) {
            titleInput.parent().removeClass('has-error');
        }

        // alert if url is blank
        if (url.length === 0) {
            urlInput.parent().addClass('has-error');
            return false;
        }

        if (url.indexOf('http') !== 0) {
            url = 'http://' + url;
        }

        // check for trailing slash
        if (url.match(/^https?\:\/\/[\w-.]+$/)) {
            url += '/';
        }

        if (!window.cnt_browser && (isSafari() || isMS())) {
            url = "mp_/" + url;
        }

        // urlencode title
        title = encodeURIComponent(title);

        RouteTo.newRecording(collection, title, url);

        setStorage("__wr_currRec", title);
    };

    function isSafari() {
        return navigator.userAgent.indexOf('Safari') > -1 && navigator.userAgent.indexOf('Chrome') == -1;
    }

    function isMS() {
        if (/(MSIE|Edge|rv:11)/i.test(navigator.userAgent)) {
            return true;
        }

        return false;
    }

    // 'Homepage': Logged in collection dropdown select
    $('.wr-content').on('click', '.collection-select', function(event) {
        event.preventDefault();

        var currColl = $(this).data('collection-id');

        $('.dropdown-toggle-collection').html(
            $('<span class="dropdown-toggle-label" data-collection-id="' +
                currColl + '">' +
                    $(this).text() + " " +
                '<span class="caret"></span>'));

        setStorage("__wr_currColl", currColl);
    });

    $('#create-coll').on('submit', function(event) {
        event.preventDefault();

        $("#create-coll-error").text("");

        var title = $("#create-coll #title").val();
        var is_public = $("#create-coll #is_public").prop("checked");

        var success = function(data) {
            if (data.error_message) {
                $("#create-coll-error").text(data.error_message);
                return;
            }

            if (!data.collection || !data.collection.id) {
                return;
            }

            setStorage("__wr_currColl", data.collection.id);

            if (window.location.pathname == "/") {
                // hide modal
                $("#create-modal").modal("hide");
                $(".modal-backdrop").hide();

                // update dropdown
                var $btn = $("button[name=collection]");
                var $dropdown = $btn.siblings(".dropdown-menu");
                $btn.find("span").html(data.collection.title+" <span class='caret'></span>")
                                 .attr("data-collection-id", data.collection.id);

                $dropdown.find("li.divider").after(
                    "<li><a href='#' class='collection-select' data-collection-id='"+data.collection.id+"'>"+data.collection.title+"</a></li>"
                );
                FlashMessage.show("success", "Created collection <b>"+data.collection.title+"</b>!");
            } else if (curr_user == user) {
                RouteTo.collectionInfo(user, data.collection.id);
            }
        }

        var fail = function(data) {
            window.location.reload();
        }

        Collections.create(title, is_public, success, fail);
    });

    // Set default recording title
    var currRec = getStorage("__wr_currRec");

    if (!currRec) {
        currRec = DEFAULT_RECORDING_SESSION_NAME;
    } else {
        currRec = decodeURIComponent(currRec);
    }

    $("input[name='rec-title']").val(currRec);

    // Only for logged in users below
    if (!user) {
        return;
    }

    // If logged-in user and has collection selector (homepage)
    // select first collection
    var currColl = getStorage("__wr_currColl");

    var collSelect = undefined;

    if (currColl) {
        collSelect = $(".dropdown a.collection-select[data-collection-id='" + currColl + "']");
    }

    if (!collSelect || !collSelect.length) {
        collSelect = $(".collection-select");
    }

    if (collSelect && collSelect.length > 0) {
        collSelect[0].click();
    }
});

