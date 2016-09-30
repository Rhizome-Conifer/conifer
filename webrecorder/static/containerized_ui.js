
function setActiveBrowser(data) {
    /**
     * Sets the containerized dropdown button to provided browser.
     */
    var btn = $('#cnt-button');
    if(!btn) return;

    btn.find('> .btn-content').html(
        (typeof data.native !== 'undefined' && data.native ? '(native)&nbsp;':"<img src='/static/__shared/browsers/"+data.name.replace(' ', '-')+"_16x16.png'>")+
        data.name+(typeof data.version !== 'undefined' ? " v"+data.version:'')
    );

    window.cnt_browser = data.native ? null : data.id;
}

function getNative() {
    /**
     * Makes a quick attempt to identify the current browser
     */
    var b = window.navigator.userAgent.match(/(chrome|safari|trident|firefox|opera)/i);
    var labels = {'trident': 'IE'};
    if(b) {
        var browser = b[0];
        return {native: true, name: (typeof labels[browser] !== 'undefined'?labels[browser]:browser)};
    }
    return {native: true, name: 'current'};
}

$(function (){

    // display native browser if we're not replaying
    if(window.curr_mode !== 'replay-coll' && window.curr_mode !== 'replay')
        setActiveBrowser(getNative());

    $('.cnt-browser').on('click', function (evt) {
        var row = evt.target.tagName === 'UL' ? $(evt.target) : $(evt.target).parents('ul.cnt-browser');

        // short-circuit if native browser selected
        if(row.attr('data-native'))
            return setActiveBrowser(getNative());

        var _id = row.attr('data-browser-id');
        var _name = row.attr('data-browser-name');
        var _vrs = row.attr('data-browser-vrs');

        setActiveBrowser({name: _name, version: _vrs, id: _id});
    });
});