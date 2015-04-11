// {"request_idle_timeout_sec":10}
//
// vim:set sw=8 et:
//
// Scrolls to the bottom of the page. That's it at the moment.
//
var umbraAboveBelowOrOnScreen = function(e) {
    var eTop = e.getBoundingClientRect().top;
    if (eTop < window.scrollY) {
        return -1; // above
    } else if (eTop > window.scrollY + window.innerHeight) {
        return 1;  // below
    } else {
        return 0;  // on screen
    }
}

var UMBRA_IFRAME_SOUNDCLOUD_EMBEDDED_SELECTOR = "iframe";
var UMBRA_THINGS_TO_CLICK_SOUNDCLOUD_EMBEDDED_SELECTOR = "button.sc-button-play, button.playButton";
var MAX_IFRAME_RECURSE_DEPTH = 1; //0-based
var umbraState = {'idleSince':null};
var umbraAlreadyClicked = {};
var umbraFinished = false;
var umbraIntervalFunc = function() {

    //console.log("Umbra Run?");
    var umbraSoundCloudEmbeddedElements = [];

    //getUmbraSoundCloudEmbeddedElements(umbraSoundCloudEmbeddedElements);

    var clickedSomething = false;
    var somethingLeftBelow = false;
    var somethingLeftAbove = false;
    var missedAbove = 0;

//    for (var i = 0; i < umbraSoundCloudEmbeddedElements.length; i++) {
//
//        var targetId = umbraSoundCloudEmbeddedElements[i].id;
//        var target = umbraSoundCloudEmbeddedElements[i].target;
//
//        if (!(targetId in umbraAlreadyClicked)) {
//
//            var where = umbraAboveBelowOrOnScreen(target);
//
//            if (where == 0) { // on screen
//                // var pos = target.getBoundingClientRect().top;
//                // window.scrollTo(0, target.getBoundingClientRect().top - 100);
//                console.log("clicking at " + target.getBoundingClientRect().top + " on " + target.outerHTML);
//                if (target.click != undefined) {
//                    target.click();
//                }
//                umbraAlreadyClicked[targetId] = true;
//                clickedSomething = true;
//                umbraState.idleSince = null;
//                break;
//            } else if (where > 0) { 
//                somethingLeftBelow = true;
//            } else if (where < 0) {
//                somethingLeftAbove = true;
//            }
//        }
//    }

    if (!clickedSomething) {
        if (somethingLeftAbove) {
            console.log("scrolling UP because everything on this screen has been clicked but we missed something above");
            window.scrollBy(0, -500);
            umbraState.idleSince = null;
        } else if (somethingLeftBelow) {
            console.log("scrolling because everything on this screen has been clicked but there's more below document.body.clientHeight=" + document.body.clientHeight);
            window.scrollBy(0, 200);
            umbraState.idleSince = null;
        } else if (window.scrollY + window.innerHeight < Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)) {
            console.log("scrolling because we're not to the bottom yet document.body.clientHeight=" + document.body.clientHeight);
            window.scrollBy(0, 200);
            umbraState.idleSince = null;
        } else if (umbraState.idleSince == null) {
            umbraState.idleSince = Date.now();
        }
    }

    if (umbraState.idleSince == null) {
        umbraState.idleSince = Date.now();
    }
}

//try to detect sound cloud "Play" buttons and return them as targets for clicking
//var getUmbraSoundCloudEmbeddedElements = function(soundCloudEmbeddedElements, currentIframeDepth, currentDocument,
//                                                   iframeElement) {
//
//    //set default values for parameters
//    currentIframeDepth = currentIframeDepth || 0;
//    currentDocument = currentDocument || document;
//
//    if (currentIframeDepth > MAX_IFRAME_RECURSE_DEPTH) {
//        return;
//    }
//
//    //collect all buttons on current document first
//    var button = [];
//
//    button = currentDocument.querySelectorAll(UMBRA_THINGS_TO_CLICK_SOUNDCLOUD_EMBEDDED_SELECTOR);
//
//    var cssPathIframe = iframeElement ? getElementCssPath(iframeElement) : "";
//
//    for (var i = 0; i < button.length; i++) {
//        soundCloudEmbeddedElements.push({"id" : cssPathIframe + getElementCssPath(button.item(i)), "target" : button.item(i)});
//    }
//
//    //now get all buttons in embedded iframes
//    var iframe = [];
//
//    iframe = currentDocument.querySelectorAll(UMBRA_IFRAME_SOUNDCLOUD_EMBEDDED_SELECTOR);
//
//    for (var i = 0; i < iframe.length; i++) {
//        getUmbraSoundCloudEmbeddedElements(soundCloudEmbeddedElements, currentIframeDepth + 1, iframe[i].contentWindow.document.body, iframe[i]);
//    }
//}

// If we haven't had anything to do (scrolled, clicked, etc) in this amount of
// time, then we consider ourselves finished with the page.
var UMBRA_USER_ACTION_IDLE_TIMEOUT_SEC = 3;

// Called from outside of this script.
var umbraBehaviorFinished = function() {
    if (umbraState.idleSince != null) {
        var idleTimeMs = Date.now() - umbraState.idleSince;
        if (idleTimeMs / 1000 > UMBRA_USER_ACTION_IDLE_TIMEOUT_SEC) {
            return true;
        }
    }
    return false;
}

//copied from http://stackoverflow.com/questions/4588119/get-elements-css-selector-without-element-id
var getElementCssPath = function(element) {

    var names = [];

    while (element.parentNode){
        if (element.id){
            names.unshift('#' + element.id);
            break;
        } else {
            if (element == element.ownerDocument.documentElement) {
                names.unshift(element.tagName);
            }
            else {
                for (var c = 1, e = element; e.previousElementSibling; e = e.previousElementSibling, c++);

                names.unshift(element.tagName + ":nth-child(" + c + ")");
            }

            element = element.parentNode;
        }
    }

    return names.join(" > ");
}

var umbraIntervalId = setInterval(umbraIntervalFunc, 100);
