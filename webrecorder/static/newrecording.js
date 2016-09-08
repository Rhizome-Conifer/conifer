$(function() {
    var DEFAULT_RECORDING_SESSION_NAME = "Recording Session";

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

        var title = $("input[name='rec-title']").val();
        var url = $("input[name='url']").val();

        if (isSafari()) {
            url = "mp_/" + url;
        }

        RouteTo.newRecording(collection, title, url);

        setStorage("__wr_currRec", title);
    };

    function isSafari() {
        return navigator.userAgent.indexOf('Safari') > -1 && navigator.userAgent.indexOf('Chrome') == -1;
    }

    function setStorage(name, value) {
        try {
            if (window.sessionStorage) {
                window.sessionStorage.setItem(name, value);
            }

            if (window.localStorage) {
                window.localStorage.setItem(name, value);
            }
        } catch(e) {
            console.log("localStorage not avail");
        }
    }

    function getStorage(name) {
        var value = undefined;

        try {

            // First try session, then local
            if (window.sessionStorage) {
                value = window.sessionStorage.getItem(name);
            }

            if (!value && window.localStorage) {
                value = window.localStorage.getItem(name);
            }

        } catch(e) {
            console.log("localStorage not avail");
        }

        return value;
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
                window.location.reload();
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

