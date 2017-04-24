if (!user) {
    user = curr_user;
}

$(function() {
    EventHandlers.bindAll();
    RecordingSizeWidget.start();

    if(window.curr_mode === 'replay' || window.curr_mode === 'replay-coll')
        BookmarkCounter.start();

    CountdownTimer.start();
    SizeProgressBar.start();
    Snapshot.start();
    ShareWidget.start();
    ModeSelector.start();
    PagingInterface.start();
});

function setUrl(url) {
    $("input[name='url']").val(decodeURI(url));
    wbinfo.url = decodeURI(url);

    if(window.curr_mode === 'replay' || window.curr_mode === 'replay-coll') {
        PagingInterface.navigationUpdate();
    } else if(window.curr_mode === 'record' || window.curr_mode === 'patch') {
        ShareWidget.updateUrl({'url': wbinfo.url, 'ts': wbinfo.timestamp});
    }
}

function getUrl() {
    return $("input[name='url']").val();
}

function setTitle(status_msg, url, title) {
    //var title = $('iframe').contents().find('title').text();
    if (!title) {
        title = url;
    }
    document.title = title + " (" + status_msg + ")";
}

function setTimestamp(ts) {
    wbinfo.timestamp = ts;
}

function cbrowserMod(sep, ts) {
    var base = ts || "";
    if (window.cnt_browser) {
        base += "$br:" + window.cnt_browser;
    }
    if (base && sep) {
        base += sep;
    }
    return base;
};

var EventHandlers = (function() {
    var bindAll = function() {

        // Prevent the use of any disabled elements
        $('body').on('click', '.disabled', function(event){
            event.preventDefault();
            return false;
        });

        // Enable autofocus on modals
        $('body').on('shown.bs.modal', '.modal', function() {
            $(this).find('[autofocus]').focus();
        });

        var bin = getStorage('__wr_toolBin');
        if(bin)
            $('.wr-tools').toggleClass('open', JSON.parse(bin));

        $("#tool-bin").on('click', function () {
            $('.wr-tools').toggleClass('open');
            setStorage('__wr_toolBin', $('.wr-tools').hasClass('open'));
        });

        // Switch urls -- Url bar submit / enter key
        $('header').on('submit', '.content-form', function(event) {
            event.preventDefault();

            var url = getUrl().trim();

            if (url.indexOf('http') !== 0) {
                url = 'http://' + url;
            }

            // check for trailing slash
            if(url.match(/^https?\:\/\/[\w-.]+$/))
                url += '/';


            if (window.cnt_browser && window.curr_mode != "new" && !window.containerExpired) {
                RecordingSizeWidget.setRemoteUrl(url);
                return false;
            }

            if (window.curr_mode == "record") {
                //if (ContentMessages.messageIfDuplicateVisit(url)) { return; }

                RouteTo.recordingInProgress(user, coll, rec, url);

            } else if (window.curr_mode == "replay") {
                RouteTo.replayRecording(user, coll, rec, url);

            } else if (window.curr_mode == "replay-coll") {
                RouteTo.replayRecording(user, coll, undefined, url);

            } else if (window.curr_mode == "patch") {
                RouteTo.patchPage(user, coll, rec, url);

            } else if (window.curr_mode == "new") {
                // New handled in newrecordings.js
            }
        });

        // - Return to collection if recording or replay
        // - Return to replay if patching
        // - Start recording if on new recording page
        $('header').on('submit', '.content-action', function(event) {
            event.preventDefault();

            if (window.curr_mode == "record" || window.curr_mode == "replay") {
                RouteTo.recordingInfo(user, coll, rec);
            } else if (window.curr_mode == "replay-coll") {
                RouteTo.collectionInfo(user, coll);
            } else if (window.curr_mode == "patch") {
                var url = getUrl();

                if (window.cnt_browser) {
                    switchCBReplay(url);
                    return;
                }

                RouteTo.replayRecording(user, coll, cbrowserMod(), url);
            } else if (window.curr_mode == "new") {
                // New handled in newrecordings.js
            }
        });

        // Start patching
        $('.patch-page').on('click', function(event){
            event.preventDefault();

            var url = getUrl();
            var target;

            if (window.cnt_browser) {
                switchCBPatch(url);
                return;
            }

            if ($(this).attr("target") == "_parent") {
                target = window.parent;
            } else {
                target = window;
            }

            RouteTo.newPatch(coll, url, target, wbinfo.timestamp);
        });


        // 'Header': 'Login' link to display modal
        $('.login-link').on('click', function(event) {
            event.preventDefault();

            var link = $(this).attr("href");

            $.ajax({
                url: link,
                success: function (data) {
                    $('#login-modal-cont').html(data);
                    TimesAndSizesFormatter.format();

                    $("#login-modal").modal('show');
                },
                dataType: 'html'
            });
        });

        // 'Recorder': 'Doesn't look right' link to display modal
        $("#report-modal").on('show.bs.modal', function() {
            $("#report-form-submit").text("Send Report");
            $("#report-thanks").text("");
            $('#report-form-submit').prop('disabled', false);
        });

        // 'Recorder': 'Doesn't look right form submission
        $("#report-form").submit(function(e) {
            e.preventDefault();

            var params = $("#report-form").serialize();

            params += "&" + $.param({state: window.curr_mode,
                                     url: window.location.href});

            params += "&user=" + user + "&coll=" + coll + "&rec=" + rec;

            $.post("/_reportissues", params, function() {
                $("#report-form-submit").text("Report Sent!");
                $("#report-thanks").text("Thank you for testing Webrecorder!");
                $('#report-form-submit').prop('disabled', true);

                setTimeout(function() {
                    $("#report-modal").modal('hide');
                }, 1000);
            });
        });

        // Move temp form: disable or enable migration collection
        $("body").append("<div id='login-modal-cont' class='move-temp-cont'>");

        $(".move-temp-cont").on("change", "input[name='move-temp']", function(event) {
            event.preventDefault();

            if ($(this).prop("checked")) {
                $(".to-coll").parent().show();
                $(".to-coll").attr("required", "true");
                $(".to-coll").click()
            } else {
                $(".to-coll").parent().hide();
                $(".to-coll").removeAttr("required");
            }
        });

        // Auto select text-boxes on click
        $(document).on('click', 'input[type="text"]', function() {
            $(this).select();
        } );

        // Adjust iframe
        if (curr_mode) {
            var height;

            if (height = $("header").height()) {
                height += 1;
                $("#replay_iframe").css("top", height + "px");
                $("#replay_iframe").css("padding-bottom", height + "px");
                //$("#replay_iframe").css("margin-top", "-9px");
            } else if (height = $(".embed-footer").height()) {
                $("#replay_iframe").css("padding-bottom", height + "px");
            }
        }
    }

    function switchCBPatch(url) {
        Recordings.create(user, coll, {"title": "Patch"}, createPatch, fail);

        function createPatch(data) {
            $(".glyphicon-recording-status").removeClass("glyphicon-play-circle").addClass("glyphicon-import Blink");
            $(".recorder-status").addClass("patching").text("Patching");

            wbinfo.outer_prefix += data.recording.id + "/patch/";

            RecordingSizeWidget.switchMode(data.recording.id, "patch", {"url": url, "title": document.title});

            $(".current-size").text("0 bytes");

            var bc = $("<a>" +  data.recording.title + "</a>");
            bc.attr("href","/" + user + "/" + coll + "/" + rec);
            bc.attr("target", "_parent");
            bc.attr("class", "recording-breadcrumb");

            $("<li>").append(bc).appendTo("ol.breadcrumb");

            $(".patch-page").hide();
        }

        function fail() {
            console.log("failed creating patch rec");
        }
    }

    function switchCBReplay(url) {
        $(".glyphicon-recording-status").addClass("glyphicon-play-circle").removeClass("glyphicon-import Blink");
        $(".recorder-status").removeClass("Blink").text("Replaying");

        var suffix = wbinfo.outer_prefix.lastIndexOf("/" + rec + "/patch/")
        if (suffix >= 0) {
            wbinfo.outer_prefix = wbinfo.outer_prefix.substring(0, suffix + 1);
        }

        RecordingSizeWidget.switchMode("*", "replay-coll", {"url": url, "title": document.title});

        $(".patch-page").show();

        $("ol.breadcrumb li").last().remove();
    }

    return {
        bindAll: bindAll,
        switchCBPatch: switchCBPatch,
        switchCBReplay: switchCBReplay,
    }
})();

var ModeSelector = (function (){

    function start() {
        $('.wr-modes').on('click', '.wr-mode:not(.disabled):not(.active)', function () {
            var obj = $(this);

            switch(obj.data('mode')) {
                case 'new':
                    window.location.href = '/'+user+'/'+coll+'/$new';
                    break;
                case 'record':
                    var url = getUrl();
                    var rec = getStorage("__wr_currRec") || DEFAULT_RECORDING_SESSION_NAME;
                    RouteTo.newRecording(coll, rec, url);
                    break;
                case 'replay':
                    var url = getUrl();
                    RouteTo.replayRecording(user, coll, cbrowserMod('', wbinfo.timestamp), url);
                    break;
                case 'patch':
                    var url = getUrl();
                    RouteTo.newPatch(coll, url, window, wbinfo.timestamp);
                    break;
                case 'snapshot':
                    Snapshot.queueSnapshot();
                    break;
                case 'extract':
                    var url = getUrl();
                    var rec = getStorage("__wr_currRec") || DEFAULT_RECORDING_SESSION_NAME;
                    RouteTo.newExtract(coll, rec, url, wbinfo.timestamp);
                    break;
            }
        });
    }

    return {
        'start': start
    };
})();

var PagingInterface = (function () {
    var dropdown;
    var idx = 0;
    var iframe;
    var li;
    var liHeight;
    var nextBtn; var prevBtn;
    var pgDsp;
    var timestamp;
    var muted = false;

    function updateCounter(cursor) {
        var value = (cursor+1)+' of '+recordings.length;
        pgDsp.attr('size', value.length);
        pgDsp.val(value);
    }

    function updateTimestamp(ts) {
        timestamp.html("<span class='hidden-xs hidden-sm hidden-md'>"+TimesAndSizesFormatter.ts_to_date(ts)+"</span><span class='glyphicon glyphicon-triangle-bottom' />");
    }

    function next() {
        if(idx + 1 < recordings.length)
            update(recordings[++idx], true);
    }

    function previous() {
        if(idx - 1 >= 0)
            update(recordings[--idx], true);
    }

    function findIndex() {
        /**
         * Find the index of current page within the collection
         */

        // if there isn't a timestamp restrict match to url descending
        if (!wbinfo.timestamp) {
            for (var i = recordings.length-1; i >= 0; i--) {
                if (wbinfo.url === recordings[i].url) {
                    return i;
                }
            }
            return 0;
        }

        var item = {url: wbinfo.url, ts: parseInt(wbinfo.timestamp, 10)};
        var minIdx = 0;
        var maxIdx = recordings.length - 1;
        var curIdx;
        var curEle;

        while (minIdx <= maxIdx) {
            curIdx = (minIdx + maxIdx)/2 | 0;
            curEle = parseInt(recordings[curIdx].ts, 10);

            if (curEle < item.ts) {
                minIdx = curIdx + 1;
            } else if (curEle > item.ts) {
                maxIdx = curIdx - 1;
            } else if (curEle === item.ts && item.url !== recordings[curIdx].url) {
                /**
                 * If multiple recordings are within a timestamp, or if the url
                 * for the timestamp doesn't match exactly, iterate over other
                 * options. If no exact match is found, resolve to first ts match.
                 */
                var url;
                var origIdx = curIdx;
                while (curEle === item.ts && curIdx < recordings.length-1) {
                    url = recordings[++curIdx].url;
                    curEle = parseInt(recordings[curIdx].ts, 10);
                    if (url === item.url) {
                        return curIdx;
                    }
                }
                return origIdx;
            } else {
                return curIdx;
            }
        }
    }

    function start() {
        if(!$('.linklist').length)
            return;

        pgDsp = $('#page-display');
        iframe = document.getElementById('replay_iframe');
        nextBtn = $('.btn-next');
        prevBtn = $('.btn-prev');
        timestamp = $('.main-replay-date');
        var linklist = $('.linklist');
        li = linklist.find('li');
        liHeight = li.eq(0).outerHeight();
        dropdown = linklist.find('> .dropdown-menu');
        var inputBar = $('input[name=url]');

        nextBtn.on('click', next);
        prevBtn.on('click', previous);

        idx = findIndex();
        updateTimestamp(wbinfo.timestamp);

        timestamp.on('click', function (evt) {
            evt.stopPropagation();
            linklist.toggleClass('open');
        });

        // set linklist ones TODO: this might be slow and unnecessary
        dropdown.find('.replay-date').each(function () {
            var obj = $(this);
            obj.html(TimesAndSizesFormatter.ts_to_date(String(obj.data('date'))));
        });

        dropdown.on('click', 'li:not(.active)', function () {
            idx = $(this).index();
            update(recordings[idx], true);
            linklist.removeClass('open');
        });

        // offset input bar
        inputBar.css('padding-right', timestamp.width());

        inputBar.on('keyup', function (e){
            if(e.keyCode === 13) {
                linklist.removeClass('open');
                var urlTo = $(this).val().trim();

                if(urlTo.indexOf('http') !== 0)
                    urlTo = 'http://'+urlTo;

                iframe.src = '/'+user+'/'+coll+'/mp_/'+urlTo;
            }
        });

        // set arrow buttons
        update();
    }

    function navigationUpdate() {
        /**
         * ignore a page update if the update was prompted by
         * the pagging ui
         */
        if(muted) {
            muted = false;
            return;
        }

        idx = findIndex();
        var rec = recordings[idx];
        ShareWidget.updateUrl(rec);
        updateTimestamp(rec.ts);
        update();
    }

    function update(rec, mute) {
        /* updates wbinfo, iframe */
        if(typeof mute !== 'undefined' && mute) {
            muted = true;
        }

        updateCounter(idx);
        li.removeClass('active');
        li.eq(idx).addClass('active');

        // update dropdown scroll position
        dropdown.scrollTop((idx>2?idx-2:0) * liHeight);

        // prev, next button presentation
        if(idx===0)
            prevBtn.addClass('disabled');
        else if(idx > 0 && prevBtn.hasClass('disabled'))
            prevBtn.removeClass('disabled');

        if(idx===recordings.length-1)
            nextBtn.addClass('disabled');
        else if(idx < recordings.length - 1 && nextBtn.hasClass('disabled'))
            nextBtn.removeClass('disabled');

        if(typeof rec !== 'undefined') {
            if((typeof window.cnt_browser !== 'undefined' || rec.br) && Object.keys(window.browsers).length > 0) {
                /* if we're currently in a remote browser view, or the next item is, use fresh navigation to it */
                window.location.href = '/'+user+'/'+coll+'/'+rec.ts+(typeof rec.br !== 'undefined' && rec.br !== ''?'$br:'+rec.br:'')+'/'+rec.url;
            } else {
                // update share widget
                ShareWidget.updateUrl(rec);

                updateTimestamp(rec.ts);
                iframe.src = '/'+user+'/'+coll+'/'+rec.ts+'mp_/'+rec.url;
            }
        }
    }

    return {
        start: start,
        navigationUpdate: navigationUpdate
    }
})();

var ShareWidget = (function () {
    var hasWidget = false;
    var fbInitialized = false;

    function checkPublicStatus(user, coll) {
        $.ajax({
            url:'/api/v1/collections/'+coll+'/is_public?user='+user,
            method: 'GET',
            success: function (data){
                if(data.is_public) {
                    $('.public-switch').toggleClass('hidden', true);
                }
                render(data.is_public);
            },
            error: function (xhr, ajaxOptions, thrownError) {
                if( xhr.status === 404) {
                    // permission denied
                }

                console.log('err');
            }
        });
    }

    function renderSocialWidgets(url) {
        // new url or initial
        if(typeof url === 'undefined') {
            url = $('#share-widget').data('url');
        }

        // clear previous widget
        $('#wr-tw').empty();
        if(typeof twttr !== 'undefined') {
            twttr.ready(function (){
                twttr.widgets.createShareButton(
                    url,
                    document.getElementById('wr-tw'),
                    {
                        text: '',
                        size: 'large',
                        via: 'webrecorder_io'
                    }
                );
            });
        }

        $('#wr-fb').html('<div class="fb-share-button" data-href="'+url+'" data-layout="button" data-size="large" data-mobile-iframe="true"></div>')

        // fb sdk loaded?
        if(typeof window.FB === 'undefined') {
            window.fbAsyncInit = function () {
                FB.init({xfbml: true, version: 'v2.8'});
                fbInitialized = true;
            };
        } else {
            if(!fbInitialized) {
                FB.init({xfbml: true, version: 'v2.8'});
                fbInitialized = true;
            } else {
                FB.XFBML.parse(document.getElementById('wr-fb'));
            }
        }
    }

    function thirdPartyJS() {
        window.twttr = (function(d, s, id) {
            var js, fjs = d.getElementsByTagName(s)[0],
              t = window.twttr || {};
            if (d.getElementById(id)) return t;
            js = d.createElement(s);
            js.id = id;
            js.src = "https://platform.twitter.com/widgets.js";
            fjs.parentNode.insertBefore(js, fjs);

            t._e = [];
            t.ready = function(f) {
              t._e.push(f);
            };

            return t;
        }(document, "script", "twitter-wjs"));

      // load fb
      (function(d, s, id) {
            var js, fjs = d.getElementsByTagName(s)[0];
            if (d.getElementById(id)) return;
            js = d.createElement(s); js.id = id;
            js.src = "//connect.facebook.net/en_US/sdk.js";
            fjs.parentNode.insertBefore(js, fjs);
          }(document, 'script', 'facebook-jssdk'));
    }

    function start() {
        var shareWidget = $("#share-widget");
        if(shareWidget.length) {
            hasWidget = true;
            $(".ispublic").bootstrapSwitch().on('switchChange.bootstrapSwitch', updateVisibility);

            $('.dropdown-menu').on('click', function (evt) {evt.stopPropagation(); });
            $('.share-container .glyphicon-remove-circle').on('click', function (evt) { $(this).parents('.share-container').toggleClass('open'); });

            var obj = $('.shareables');
            obj.css('height', obj.height());

            // manage share option visiblity
            var status = $('.share-container').data('public');
            if(typeof status !== 'undefined' && !status) {
                obj.addClass('disabled');
            } else if(typeof status === 'undefined') {
                checkPublicStatus(user, coll);
            }

            $('.shareables input, .shareables textarea').on('focus', function (){
                this.setSelectionRange(0, this.value.length);
            });

            $('#share-widget').one('show.bs.dropdown', function (){
                thirdPartyJS();
                renderSocialWidgets();
            });
        }
    }

    function updateVisibility(evt, state) {
        $.ajax({
            url: '/api/v1/collections/' + coll + '/public?user=' + user,
            method: 'POST',
            data: {'public': state},
            success: function() {
                render(state);
            },
            error: function() {
                $('.ispublic').bootstrapSwitch('toggleState', true);
                console.log('err');
            }
        });
    }

    function updateUrl(rec) {
        if(!hasWidget) return;

        var shareUrl = $('#shareable-url');
        var shareEmbed = $('#shareable-embed-code');

        var shareVal = shareUrl.val();
        // replace timestamp if present
        shareVal = shareVal.replace(/\/\d+\//, '/'+rec.ts+'/');
        shareVal = shareVal.replace(/\/http.+/, '/' + rec.url)
        shareUrl.val(shareVal);

        var embedVal = shareEmbed.val();
        embedVal = embedVal.replace(/\/\d+\//, '/'+rec.ts+'/');
        embedVal = embedVal.replace(/\/http[^"]*/, '/' + rec.url);
        shareEmbed.val(embedVal);

        renderSocialWidgets(shareVal);
    }

    function render(state) {
        $('.ispublic').bootstrapSwitch('state', state, true);
        $('.shareables').toggleClass('disabled', !state);
    }

    return {
        'start': start,
        'updateUrl': updateUrl
    };
})();


var Snapshot = (function() {
    function queueSnapshot() {
        if (window.cnt_browser) {
            showModal();
            RecordingSizeWidget.snapshotReq();
        } else {
            var main_window = document.getElementById("replay_iframe");
            if (main_window && main_window.contentWindow) {
                main_window.contentWindow.postMessage({wb_type: "snapshot-req"}, "*", undefined, true);
            }
        }
    }

    function start() {
        $('#snapshot-modal').appendTo('body'); // sorry for this hack: makes modal appear on top of faded backgr!

        $("#snapshot").on('click', queueSnapshot);
    }

    function showModal() {
        $('#snapshot-modal .snap-wait').show();
        $('#snapshot-modal .snap-created').hide();

        $('#snapshot-modal')
            .modal({'keyboard': true})
            .modal('show');
    }

    function updateModal(snapshot) {
        $("#snapshot").prop("disabled", false);

        var snapUrl = "/" + user + "/" + coll + "/" + snapshot.timestamp + "/" + snapshot.url;

        $("#snapshot-modal .snap-link").attr('href', snapUrl);
        $("#snapshot-modal .snap-ts").attr("data-time-ts", snapshot.timestamp);
        TimesAndSizesFormatter.format();

        if (!snapshot.title) {
            snapshot.title = snapshot.url;
        }

        $("#snapshot-modal .snap-title").text(snapshot.title);

        $('#snapshot-modal .snap-wait').hide();
        $('#snapshot-modal .snap-created').show();
    }

    function uploadStaticSnapshot(snapdata) {
        var params = $.param(snapdata.params)
        params += "&user=" + user + "&coll=" + coll + "&rec=" + rec;

        var target = window.location.origin + "/_snapshot?" + params;

        $.ajax({
            type: "PUT",
            url: target,
            dataType: "json",
            data: snapdata.contents,
            success: function(data) {
                if (snapdata.top_page) {
                    if (typeof(data) == "string") {
                        data = JSON.parse(data);
                    }

                    data.snapshot.title = snapdata.params.title;

                    updateModal(data.snapshot);
                }
            },
            error: function() {
                console.log("Snapshot Error");
            },
            dataType: 'html',
        });

        if (snapdata.top_page) {
            showModal();
        }
    }

    return {start: start,
            uploadStaticSnapshot: uploadStaticSnapshot,
            updateModal: updateModal,
            queueSnapshot: queueSnapshot
           }
})();


var RouteTo = (function(){
    var host = window.location.protocol + "//" + window.location.host;

    var newRecording = function(collection, recording, url, mode, target) {
        // if a containerized browser is set, assign it to the new recording
        routeTo(host + "/$record/" + collection + "/" + recording + "/" + cbrowserMod("/") + url, target);
    }

    var newExtract = function(collection, recording, url, ts) {
        routeTo(host + "/$record/" + collection + "/" + recording + "/" + cbrowserMod("/", ts) + url);
    }

    var newPatch = function(collection, url, target, ts) {
        routeTo(host + "/$patch/" + collection + "/" + cbrowserMod("/", ts) + url, target);
    }

    var recordingInProgress = function(user, collection, recording, url, mode, target) {
        if (!mode) {
            mode = "record";
        }

        routeTo(host + "/" + user + "/" + collection + "/" + recording + "/" + mode + "/" + cbrowserMod("/") + url, target);
    }

    var collectionInfo = function(user, collection) {
        routeTo(host + "/" + user + "/" + collection);
    }

    var recordingInfo = function(user, collection, recording) {
        routeTo(host + "/" + user + "/" + collection + "/" + recording);
    }

    var replayRecording = function(user, collection, recording, url) {
        var path = host + "/" + user + "/" + collection + "/";
        if (recording) {
            path += recording + "/";
        }
        path += url;

        routeTo(path);
    }

    var addToRecording = function(user, collection, recording) {
        routeTo(host + "/" + user + "/" + collection + "/" + recording + "/$add");
    }

    var patchPage = function(user, collection, recording, url, target) {
        recordingInProgress(user, collection, recording, url, "patch", target);
    }

    var routeTo = function(url, target) {
        if (!target) {
            target = window;
        }

        target.location.href = url;
    }

    return {
        newRecording: newRecording,
        newExtract: newExtract,
        newPatch: newPatch,
        recordingInProgress: recordingInProgress,
        collectionInfo: collectionInfo,
        recordingInfo: recordingInfo,
        replayRecording: replayRecording,
        addToRecording: addToRecording,
        patchPage: patchPage,
    }
}());

var RecordingSizeWidget = (function() {
    var sizeUpdateId = undefined;
    var recordingId;
    var collectionId;

    var ws;
    var useWS = false;
    var errCount = 0;

    var startmsg = undefined;

    // track window.onpopstate url
    var lastPopUrl = undefined;

    var start = function() {
        if (window.curr_mode && window.curr_mode != "new") {
            //(window.curr_mode == "record" || window.curr_mode == "patch")) {
            //recordingId = $('[data-recording-id]').attr('data-recording-id');
            //collectionId = $('[data-collection-id]').attr('data-collection-id');

            initWS();

            if (window.curr_mode == "record" || window.curr_mode == "patch") {
                if (isOutOfSpace()) {
                    RouteTo.recordingInfo(user, coll, rec);
                }

                if (isAlmostOutOfSpace() && !warningPresent()) {
                    showWarningMessage();
                    disableUrlBar();
                }

                setTimeout(function() {
                    if (!hasWS()) {
                        sizeUpdateId = setInterval(pollForSizeUpdate, 5000);
                    }
                }, 1000);
            }

            // For containerized browsers, respond to history changes to reflect in the cbrowser
            if (window.cnt_browser) {
                $(window).on('popstate', function(event) {
                    if (event.originalEvent && event.originalEvent.state) {
                        var state = event.originalEvent.state;
                        lastPopUrl = state.url;

                        if (state.change == "load") {
                            setRemoteUrl(state.url);
                        } else if (state.change == "patch") {
                            EventHandlers.switchCBReplay(getUrl());
                        } else if (state.change == "replay-coll") {
                            EventHandlers.switchCBPatch(getUrl());
                        }
                    }
                });
            }
        }
    }

    function ws_openned() {
        useWS = true;
        errCount = 0;
        if (startmsg) {
            console.log("sent on start");
            sendMsg(startmsg);
        }
    }

    function ws_closed() {
        useWS = false;
        if (errCount < 5) {
            errCount += 1;
            setTimeout(initWS, 2000);
        }
    }

    var initWS = function() {
        var url = window.location.protocol == "https:" ? "wss://" : "ws://";
        url += window.location.host + "/_client_ws?";
        if (window.curr_mode != "live") {
            url += "user=" + user + "&coll=" + coll;
        } else {
            url += "user=$temp&coll=temp";
        }

        if (rec && rec != "*") {
            url += "&rec=" + rec;
        }
        if (window.reqid) {
            url += "&reqid=" + reqid;
        }

        try {
            ws = new WebSocket(url);

            ws.addEventListener("open", ws_openned);
            ws.addEventListener("message", ws_received);
            ws.addEventListener("close", ws_closed);
            ws.addEventListener("error", ws_closed);
        } catch (e) {
            useWS = false;
        }
    }

    function switchMode(rec, type, msg) {
        window.rec = rec;
        window.curr_mode = type;

        replaceOuterUrl(msg, type);

        var msg = {"ws_type": "switch",
                   "type": type,
                   "rec": rec
                  }

        return sendMsg(msg);
    }

    function addCookie(name, value, domain) {
        var msg = {"ws_type": "addcookie",
                   "name": name,
                   "value": value,
                   "domain": domain}

        return sendMsg(msg);
    }

    function addSkipReq(url) {
        var msg = {"ws_type": "skipreq",
                   "url": url
                  }

        return sendMsg(msg);
    }

    function snapshotReq() {
        var msg = {"ws_type": "snapshot-req",
                  }

        return sendMsg(msg);
    }

    function addPage(page) {
        var msg = {"ws_type": "page",
                   "page": page}

        return sendMsg(msg);
    }

    function doAutoscroll() {
        var msg = {"ws_type": "autoscroll"}

        return sendMsg(msg);
    }

    function doLoadAll() {
        var msg = {"ws_type": "load_all"}

        return sendMsg(msg);
    }

    function setRemoteUrl(url) {
        var msg = {"ws_type": "set_url",
                   "url": url}

        return sendMsg(msg);
    }

    function sendMsg(msg) {
        if (!hasWS()) {
            return false;
        }

        ws.send(JSON.stringify(msg));
        return true;
    }

    // TODO: reuse make_url, postMessage from wb_frame.js
    function replaceOuterUrl(msg, change)
    {
        var ts = msg.timestamp;
        var mod = cbrowserMod();
        var prefix = wbinfo.outer_prefix;
        var url = msg.url;

        if (ts || mod) {
            mod += "/";
        }

        prefix = prefix || wbinfo.prefix;

        if (ts && (window.curr_mode == "replay" || window.curr_mode == "replay-coll")) {
            prefix += ts;
        }

        msg.change = change;

        if (url != lastPopUrl) {
            window.history.pushState(msg, msg.title, prefix + mod + url);
            lastPopUrl = undefined;
        } else if (change == "load") {
            lastPopUrl = undefined;
        }

        if (ts) {
            $("#replay-date").text("from " + TimesAndSizesFormatter.ts_to_date(ts));
            $(".replay-wrap").show();
        }
    }

    function ws_received(event)
    {
        var msg = JSON.parse(event.data);

        switch (msg.ws_type) {
            case "status":
                updateDom(msg.size);
                if (window.curr_mode === 'replay-coll' || window.curr_mode === 'replay')
                    BookmarkCounter.setBookmarkCount(msg.numPages);
                break;

            case "remote_url":
                if (window.cnt_browser) {
                    var page = msg.page;
                    setTimestamp(page.timestamp);
                    setUrl(page.url);
                    setTitle("Remote", page.url, page.title);
                    replaceOuterUrl(page, "load");
                }
                break;

            case "patch_req":
                if (window.cnt_browser) {
                    if (window.curr_mode == "replay-coll" || window.curr_mode == "replay") {
                        EventHandlers.switchCBPatch(getUrl());
                    }
                }

            case "snapshot":
                Snapshot.updateModal(msg);
                break;

            default:
                console.log(msg);
        }
    }

    var pollForSizeUpdate = function() {
        if (!hasWS()) {
            Recordings.get(rec, updateSizeCounter, dontUpdateSizeCounter);
        }
    }

    var updateSizeCounter = function(data) {
        var spaceUsed = data.recording.size;
        updateDom(spaceUsed);
    }

    var updateDom = function(spaceUsed) {
        $('.size-counter .current-size').attr('data-size-display', spaceUsed);
        TimesAndSizesFormatter.format();
        $('.size-counter').removeClass('hidden');
    }

    var dontUpdateSizeCounter = function(xhr) {
        var data = undefined;

        if (xhr) {
            data = xhr.responseJSON;
        }

        // Stop pinging if user invalid (eg. expired)
        if (data && data.error_message == "No such user") {
            clearInterval(sizeUpdateId);
        }
    }

    var isOutOfSpace = function() {
        if (typeof wbinfo === "undefined") { return false; }
        return wbinfo.info.size_remaining <= 0;
    }

    var isAlmostOutOfSpace = function() {
        if (typeof wbinfo === "undefined") { return false; }
        return wbinfo.info.size_remaining <= 500000;  // 500KB
    }

    var showWarningMessage = function() {
        var outOfSpaceWarningDOM = "<div class='alert alert-warning alert-during-recording alert-out-of-space col-md-10' role='alert'><span class='glyphicon glyphicon-exclamation-sign' aria-hidden='true'></span><span class='sr-only'>Alert:</span><span class='left-buffer'></span>Your account is about to run out of space.  Please wrap up your work and stop your current recording.</div>"
        $('.header-webrecorder').after(outOfSpaceWarningDOM);
        $('.alert-during-recording').slideDown();
    }

    var warningPresent = function() {
        return $('.alert-out-of-space').length;
    }

    var disableUrlBar = function() {
        $('.recording-in-progress').find("input[name='url']").prop('disabled', true);
        $('.recording-in-progress').find('button').prop('disabled', true);
    }

    function hasWS() {
        return useWS;
    }

    return {
        start: start,
        switchMode: switchMode,

        addCookie: addCookie,
        addSkipReq: addSkipReq,
        addPage: addPage,
        doAutoscroll: doAutoscroll,
        doLoadAll: doLoadAll,
        setRemoteUrl: setRemoteUrl,
        hasWS: hasWS,
        replaceOuterUrl: replaceOuterUrl,
        snapshotReq: snapshotReq,
    }

})();

var BookmarkCounter = (function() {
    var sortedBookmarks = [];

    var start = function() {
        if (RecordingSizeWidget.hasWS()) {
            return;
        }

        if ($(".url-input-recorder").length) {
            var recordingId = $('[data-recording-id]').attr('data-recording-id');

            if (recordingId) {
                Recordings.getNumPages(startBookmarkCounter, dontStartBookmarkCounter);
            } else {
                Collections.getNumPages(startBookmarkCounter, dontStartBookmarkCounter);
            }
        }
    }

    var update = function(attributes) {
        setUrl(attributes.url);
        BookmarkCounter.start();
    }

    var startBookmarkCounter = function(data) {
        //sortedBookmarks = data.pages.sort(function(p1, p2) {
        //    return p1.timestamp - p2.timestamp;
        //});
        var count = data.count;

        if (!count) {
            count = 0;
        }

        setBookmarkCount(count);
    }

    var setBookmarkCount = function(numBookmarks) {
        $('.bookmark-count').html(formatBookmarkCount(numBookmarks));
    }

    var formatBookmarkCount = function(numBookmarks) {
        var bookmarkString = "bookmarks";
        if (numBookmarks === 1) {
            bookmarkString = "bookmark";
        }

        return numBookmarks + "&nbsp;" + bookmarkString;// "<strong> / </strong>"
    }

    var dontStartBookmarkCounter = function() {
        // If we can't load this recording's pages,
        // do nothing
    }

    var hasBeenVisited = function(url) {
        var visited = false;

        $.each(sortedBookmarks, function(index) {
            if (url === this.url) {
                visited = true;
            }
        });

        return visited;
    }

    return {
        start: start,
        update: update,
        setBookmarkCount: setBookmarkCount,
        hasBeenVisited: hasBeenVisited
    }
})();

var CountdownTimer = (function() {
    // Session Expire
    var end_time = undefined;

    function update_countdown() {
        if (!end_time) {
            return;
        }
        var curr = Math.floor(new Date().getTime() / 1000);
        var secdiff = end_time - curr;

        if (secdiff == 0) {
            //window.location.href = "/_expire";
            return;
        }

        if (secdiff < 0) {
            secdiff = 0;
        }

        if (secdiff < 300) {
            $("*[data-anon-timer]").parent().show();
        }

        var min = Math.floor(secdiff / 60);
        var sec = secdiff % 60;
        if (sec <= 9) {
            sec = "0" + sec;
        }
        if (min <= 9) {
            min = "0" + min;
        }

        $("*[data-anon-timer]").text(min + " min, " + sec + " sec");
    }

    var start = function() {
        // enable timer only if anon
        //if (curr_mode == "anon") {
        //    return;
        //}

        var expire = $("*[data-anon-timer]").attr("data-anon-timer");

        if (expire && expire.length) {
            var time_left = parseInt(expire);

            if (!time_left) {
                return;
            }

            if (end_time == undefined) {
                setInterval(update_countdown, 1000);
            }

            end_time = Math.floor(new Date().getTime() / 1000 + time_left);

            update_countdown();
        }
    }

    return {
        start: start
    }
})();


var SizeProgressBar = (function() {

    var start = function() {
        var curr_size = $('.space-usage .progress-bar').attr('data-current-size');
        var max_size = $('.space-usage .progress-bar').attr('data-max-size');
        var percentage = Math.round($('.space-usage .progress-bar').attr('data-current-size') / $('.space-usage .progress-bar').attr('data-max-size') * 100);

        $('.space-usage .progress-bar').attr('aria-valuenow', percentage);
        $('.space-usage .progress-bar').attr('style', "width: " + percentage + "%");

        if (percentage < 70) {
            $('.space-usage .progress-bar').addClass('progress-bar-success');
        } else if (percentage >= 70 && percentage < 90) {
            $('.space-usage .progress-bar').addClass('progress-bar-warning');
        } else {
            $('.space-usage .progress-bar').addClass('progress-bar-danger');
        }
    }

    return {
        start: start
    }
})();

var ContentMessages = (function() {

    var messageIfDuplicateVisit = function(url) {
        // TODO: reconsider this
        // To check dupe, should check against all urls in collection, not just bookmarks
        /*if (BookmarkCounter.hasBeenVisited(url)) {
            showDuplicateVisitMessage(url);
            return true;
        }*/
        return false;
    }

    var showContentMessage = function(title, message) {
        $('body iframe').remove();
        $('body .wr-content').remove();
        $('body').addClass('interstitial-page');
        $('body').append('<div class="container wr-content"></div>');

        $('.wr-content').append(getMessageDOM(title, message));
    }

    var getMessageDOM = function(title, message) {
        // TODO: Put this in a reusable, server-side template
        return $('<div class="container col-md-6 col-md-offset-3 top-buffer-lg">' +
                    '<div class="panel panel-default">' +
                      '<div class="panel-heading">' +
                        '<span class="glyphicon glyphicon-info-sign" aria-hidden="true"></span>' +
                        '<strong class="left-buffer">' + title + '</strong>' +
                      '</div>' +

                      '<div class="panel-body">' +
                        message +
                      '</div>' +
                    '</div>' +
                  '</div>'
        );
    }

    var showDuplicateVisitMessage = function(bookmark) {
        // TODO: refactor the router to return urls or to do routing
        var recordingId = $('[data-recording-id]').attr('data-recording-id');
        var collectionId = $('[data-collection-id]').attr('data-collection-id');

        var host = window.location.protocol + "//" + window.location.host;
        var newRecordingUrl = host + "/" + user + "/" + collectionId + "/$new";
        var recordAnotherVersionOfUrl = host + "/" + user + "/" + collectionId + "/" + recordingId + "/record/" + bookmark;
        var replayCollectionUrl = host + "/" + user + "/" + collectionId + "/" + bookmark;

        var title = "<em>" + bookmark + "</em> is already in this recording"
        var message = '<div>You can:</div>' +
                '<ul>' +
                    '<li class="top-buffer-md"><a href="' + recordAnotherVersionOfUrl + '">Continue and record an additional copy</a> of this resource in this recording session</li>' +
                   '<li class="top-buffer-md"><a href="' + replayCollectionUrl + '">Replay</a> the most recent version of the resource in this recording session</li>' +
                    '<li class="top-buffer-md"><a href="' + newRecordingUrl + '">Start a new recording session</a> to record for this resource</li>' +
                '</ul>';

        showContentMessage(title, message)
    }

    return {
        showContentMessage: showContentMessage,
        messageIfDuplicateVisit: messageIfDuplicateVisit
    }
})();

$(function() {
    var lastUrl = undefined;
    var lastTs = undefined;
    var lastTitle = undefined;
    var initialReq = true;

    function handleReplayEvent(event) {
        // ignore postMessages from other sources
        if(event.origin.indexOf(window.contentHost) === -1)
            return;

        var replay_iframe = window.document.getElementById("replay_iframe");

        if (!replay_iframe || event.source != replay_iframe.contentWindow) {
            return;
        }

        if (typeof(event.data) != "object") {
            return;
        }

        var state = event.data;

        if (state.wb_type == "load") {
            addNewPage(state);
        } else if (state.wb_type == "cookie") {
            setDomainCookie(state);
        } else if (state.wb_type == "snapshot") {
            Snapshot.uploadStaticSnapshot(state);
        } else if (state.wb_type == "skipreq") {
            addSkipReq(state);
        } else if (state.wb_type == "hashchange") {
            var url = getUrl();
            url = url.split("#", 1)[0];
            if (state.hash) {
                url += state.hash;
            }
            setUrl(url);
        }
    }

    function setDomainCookie(state) {
        var url = window.location.origin;

        var cookie = state.cookie.split(";", 1)[0];
        if (!cookie) {
            return;
        }
        cookie = cookie.split("=", 2);

        if (RecordingSizeWidget.addCookie(cookie[0], cookie[1], state.domain)) {
            return;
        }

        var cookie_data =
                    {
                     "name": cookie[0],
                     "value": cookie[1],
                     "domain": state.domain
                    }

        url += "/" + user + "/" + coll + "/$add_cookie";
        if (rec && rec != "*") {
            url += "?rec=" + rec;
        }

        $.ajax({
            url: url,
            method: "POST",
            data: cookie_data,
        })
        .fail(function(xhr, textStatus, errorThrown) {
            console.log("Cookie Domain Update Failed");
        });
    }

    function addSkipReq(state) {
        if (RecordingSizeWidget.addSkipReq(state.url)) {
            return;
        }

        $.ajax({
            url: "/_skipreq?url=" + encodeURIComponent(state.url),
        });
    }

    function addNewPage(state) {
        if (state && state.ts) {
            $("#replay-date").text("from " + TimesAndSizesFormatter.ts_to_date(state.ts));
            $(".replay-wrap").show();
        }

        if (state.is_error) {
            setUrl(state.url);
        } else if (window.curr_mode == "record" || window.curr_mode == "patch") {
            if (lastUrl == state.url) {
                if (!state.ts && lastTs) {
                    return;
                }

                if (!state.title && lastTitle) {
                    return;
                }

                if (state.title == lastTitle && state.ts == lastTs) {
                    return;
                }
            }

            // if not is_live, then this page/bookmark is not a new recording
            // but is an existing replay
            if (window.curr_mode == "patch" && !state.is_live) {
                return;
            }

            var recordingId = wbinfo.info.rec_id;
            var attributes = {};

            attributes.timestamp = state.ts;
            setTimestamp(state.ts);
            attributes.title = state.title;

            attributes.url = state.url;
            setUrl(state.url);

            var msg = (window.curr_mode == "record") ? "Recording" : "Patching";
            setTitle(msg, state.url, state.title);

            if (!RecordingSizeWidget.addPage(attributes)) {
                Recordings.addPage(recordingId, attributes);
            }

            lastUrl = attributes.url;
            lastTs = attributes.timestamp;
            lastTitle = attributes.title;

        } else if (window.curr_mode == "replay" || window.curr_mode == "replay-coll") {
            if (lastUrl == state.url) {
                if (!state.ts && lastTs) {
                    return;
                }

                if (!state.title && lastTitle) {
                    return;
                }

                if (state.title == lastTitle && state.ts == lastTs) {
                    return;
                }
            }

            if(!initialReq) {
                setTimestamp(state.ts);
                setUrl(state.url);
                setTitle("Archived", state.url, state.title);
            }
            initialReq = false;
            lastUrl = state.url;
            lastTs = state.ts;
            lastTitle = state.title;
        }
    }

    window.addEventListener("message", handleReplayEvent);

    // Only used for non-html pages
    $("#replay_iframe").load(function(e) {
        var replay_iframe = window.document.getElementById("replay_iframe");

        if (!replay_iframe) {
            return;
        }

        // Only update if haven't set from postMessage, eg. lastUrl is empty
        if (lastUrl) {
            return;
        }

        // extract actual url from replay url
        // no access to timestamp, it will be computed from recording
        var url = extract_replay_url(replay_iframe.getAttribute("src"));
        state = {"url": url }

        addNewPage(state);
    });


    $("#load-all").on('click', function() {
        RecordingSizeWidget.doLoadAll();
    });
});
