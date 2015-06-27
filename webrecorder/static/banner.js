var __wfa_banner_init = function(banner_id)
{
    if (window != window.top) {
        return;
    }
    
    var style = "\
.__wb_banner_expanded {\
    height: 100% !important;\
}\
\
.__wb_banner {\
    position: fixed !important;\
    margin: 0px !important;\
    padding: 0px !important;\
    border: 0px !important;\
    width: 100% !important;\
    height: 84px;\
    top: 0px !important;\
    left: 0px !important;\
    z-index: 2147483643 !important;\
}\
\
html {\
    margin-top: 80px !important;\
}";
    
    
    var banner = document.createElement("iframe", true);
    banner.setAttribute("id", banner_id);
    banner.setAttribute("seamless", "seamless");
    banner.setAttribute("frameborder", "0");
    banner.setAttribute("scrolling", "no");
    banner.setAttribute("class", "__wb_banner");
    
    
    var banner_url = "/banner?coll=" + wbinfo.coll;
    banner_url += "&state=" + wbinfo.state;
    banner._no_rewrite = true;    
    banner.setAttribute("src", banner_url);

    // style
    var style_elem = document.createElement("style", true);
    style_elem._no_rewrite = true;
    style_elem.innerHTML = style;
    
    // insert
    document.head.appendChild(style_elem);
    document.body.insertBefore(banner, document.body.firstChild);
    
    if (wbinfo.state == "rec") {
        //add_page();

        wbinfo.replay_url = window.location.protocol + "//" + window.location.host + "/" + wbinfo.coll + "/";
        if (wbinfo.timestamp) {
            wbinfo.replay_url += wbinfo.timestamp + "/";
        }
        wbinfo.replay_url += wbinfo.url;
    }
}
