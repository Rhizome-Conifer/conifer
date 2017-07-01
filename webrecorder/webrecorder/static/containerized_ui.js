
function setActiveBrowser(data) {
    /**
    * Sets the containerized dropdown button to the provided browser for new recordings
    * or when a native recording is active.
    * Otherwise reroute to a new url, loading the selected container.
    */
    var $btn = $('#cnt-button');

    if (!$btn.get(0)) {
        return;
    }

    $btn.find('> .btn-content').html(
        (typeof data.native !== 'undefined' && data.native ? '(native)&nbsp;' : "<img src='/api/browsers/browsers/" + data.id + "/icon'>")+
        data.name+(typeof data.version !== 'undefined' ? " v"+data.version:'')
    );

    window.cnt_browser = data.native ? undefined : data.id;

    switch (window.curr_mode) {
        case "":
        case "new":
            // clear the previous active setting and set the new one
            $('.cnt-browser.active').removeClass('active');

            if(data.native) {
                $('.cnt-browser:last-child').addClass('active');
                delStorage('__wr_cntBrowser');
            } else {
                $('.cnt-browser[data-browser-id="'+data.id+'"]').addClass('active');
                setStorage('__wr_cntBrowser', data.id);
            }
            break;

    case "record":
        // if we're recording and there was a browser change, route to new recording url
        RouteTo.recordingInProgress(
            window.user,
            window.coll,
            window.rec,
            getUrl()
        );
        break;

    case "extract":
        RouteTo.newExtract(
            window.coll,
            window.rec,
            getUrl(),
            wbinfo.timestamp
        );
        break;

    case "patch":
        RouteTo.newPatch(
            window.coll,
            getUrl(),
            wbinfo.timestamp
        );
        break;

    case "replay":
    case "replay-coll":
        RouteTo.replayRecording(
            window.user,
            window.coll,
            null,
            getUrl(),
            wbinfo.timestamp
        );
        break;
    }
}

function getNative() {
    /**
     * Makes a quick attempt to identify the current browser
     */
    var b = window.navigator.userAgent.match(/((chrome|safari|trident|firefox|opera)(?!.+(edge|opr))|(edge|opr))/i);
    var labels = {'trident': 'IE', 'edge': 'IE', 'opr': 'Opera'};
    if(b) {
        var browser = b[0];
        return {native: true, name: (typeof labels[browser.toLowerCase()] !== 'undefined'?labels[browser.toLowerCase()]:browser)};
    }
    return {native: true, name: 'Current'};
}

$(function (){
    // on init check if we have a localStorage setting for a containerized browser
    var cntBrowser = window.cnt_browser || getStorage('__wr_cntBrowser');

    // display default or native browser for new recording uis
    if (window.curr_mode == "" || window.curr_mode == "new"){

        if(!cntBrowser || !(cntBrowser in browsers)) {
            setActiveBrowser(getNative());
        } else {
            setActiveBrowser(browsers[cntBrowser]);
        }
    }

    $('.cnt-browser').on('click', function (evt) {
        var row = evt.target.tagName === 'UL' ? $(evt.target) : $(evt.target).parents('ul.cnt-browser');

        if(row.hasClass('active') || row.hasClass('disabled'))
            return;

        // short-circuit if native browser selected
        if(row.attr('data-native'))
            return setActiveBrowser(getNative());

        var _id = row.attr('data-browser-id');
        var _name = row.attr('data-browser-name');
        var _vrs = row.attr('data-browser-vrs');

        setActiveBrowser({name: _name, version: _vrs, id: _id, native: false});
    });
});
