
function setActiveBrowser(data) {
    /**
     * Sets the containerized dropdown button to the provided browser for new recordings
     * or when a native recording is active.
     * Otherwise reroute to a new url, loading the selected container.
     */

    if(window.curr_mode === 'new' || window.curr_mode === '' || window.curr_mode === 'record') {
        var btn = $('#cnt-button');
        if(!btn) return;

        btn.find('> .btn-content').html(
            (typeof data.native !== 'undefined' && data.native ? '(native)&nbsp;' : "<img src='/api/browsers/browsers/" + data.id + "/icon'>")+
            data.name+(typeof data.version !== 'undefined' ? " v"+data.version:'')
        );

        // recording setup, with dropdown handling
        if(window.curr_mode === 'new' || window.curr_mode === '') {
            // clear the previous active setting and set the new one
            $('.cnt-browser.active').removeClass('active');

            if(data.native) {
                $('.cnt-browser:last-child').addClass('active');
                delStorage('__wr_cntBrowser');
            } else {
                $('.cnt-browser[data-browser-id="'+data.id+'"]').addClass('active');
                setStorage('__wr_cntBrowser', data.id);
            }

            window.cnt_browser = data.native ? undefined : data.id;
        } else if(window.curr_mode === 'record') {
            // if we're recording and there was a browser change, route to new recording url
            window.cnt_browser = data.native ? undefined : data.id;
            RouteTo.recordingInProgress(
                window.user,
                window.coll,
                window.rec,
                getUrl()
            );
        }
    } else if(window.curr_mode === 'replay' || window.curr_mode === 'replay-coll') {

        RouteTo.replayRecording(
            window.user,
            window.coll,
            wbinfo.timestamp+(data.native ?'':'$br:'+data.id),
            getUrl());
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

    // display default or native browser if we're not replaying or recording
    if(['replay-coll', 'replay', 'record'].indexOf(window.curr_mode) === -1){

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
