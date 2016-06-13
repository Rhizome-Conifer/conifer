$(function() {
    // 'Homepage': 'Record' button
    $('.wr-content').on('submit', '.start-recording-homepage', function(event) {
        event.preventDefault();

        if (!user) {
            user = "$temp";
            var collection = "temp";
        } else {
            var collection = $('[data-collection-id]').attr('data-collection-id');
        }

        var title = $("input[name='rec-title']").val();
        var url = $(".start-recording-homepage input[name='url']").val();

        RouteTo.recordingInProgress(user, collection, title, url);
    });

    // 'Homepage': Logged in collection dropdown select
    $('.wr-content').on('click', '.collection-select', function(event) {
        event.preventDefault();

        var currColl = $(this).data('collection-id');

        $('.dropdown-toggle-collection').html(
            $('<span class="dropdown-toggle-label" data-collection-id="' +
                currColl + '">' +
                    $(this).text() + " " +
                '<span class="caret"></span>'));

        window.sessionStorage.setItem("__wr_currColl", currColl);
    });

    if (!user) {
        return;
    }

    // If logged-in user and has collection selector (homepage)
    // select first collection
    var currColl = undefined;

    if (window.sessionStorage) {
        currColl = window.sessionStorage.getItem("__wr_currColl");
    }

    if (currColl) {
        $("a[data-collection-id='" + currColl + "']").click();
    } else {
        var collSelect = $(".collection-select");

        if (collSelect.length > 0) {
            collSelect[0].click();
        }
    }

    $("#create-coll").on('submit', function(event) {
        var collection = $(this).find("#collection-id").val();
        window.sessionStorage.setItem("__wr_currColl", currColl);
    });
});



