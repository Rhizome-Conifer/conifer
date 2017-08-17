
var archivesToggleContainer;
var recorderUI;
var sourcesDropdown;
var sourceTs;
var sourceTsStr;
var sourceTarget;
var sourceArchive;
var targetCollection = null;
var wrExtractModeAllArchives = (typeof wbinfo !== "undefined" && wbinfo.inv_sources === "*" ? false : true);

function renderExtractWidget(ts, source) {
    recorderUI.querySelector(".sources-widget .ts").innerHTML = ts;

    if (typeof source !== "undefined") {
        recorderUI.querySelector(".sources-widget .mnt-label").innerHTML = (wrExtractModeAllArchives ? source + "<span class='wr-archive-count'></span>&nbsp;<span class='caret'></span>" : source + "&nbsp;<span class='caret'></span>");
    }
}

function renderExtractDropdown() {
    var collId = undefined;
    if (window.wrExtractId.indexOf(":") !== -1) {
        collId = window.wrExtractId.split(":")[1];
    }

    var sourceArchiveDisplay = "<a href='"+(sourceArchive.about + (collId ? collId : ""))+"' target='_blank'>" +
                               "<span>"+sourceArchive.name+(collId ? "&nbsp;"+collId : "")+"</span><span class='glyphicon glyphicon-new-window' /></a>";
    sourcesDropdown.querySelector(".ra-source").innerHTML = sourceTarget || "Empty";
    sourcesDropdown.querySelector(".ra-source-name").innerHTML = sourceArchiveDisplay;
    sourcesDropdown.querySelector(".ra-ts").innerHTML = sourceTsStr;

    var collectionEle = sourcesDropdown.querySelector(".ra-collection");
    if (!collectionEle.hasAttribute("data-value-encoded")) {
        collectionEle.innerHTML = targetCollection || getStorage("__wr_currCollTitle") || DEFAULT_RECORDING_SESSION_NAME;
    }
}

function clearWidget() {
    recorderUI.querySelector(".input-group").classList.remove("remote-archive");
    sourceArchive = null;
    window.wrExtractId = undefined;
    window.wrExtractPrefix = undefined;
}

function urlEntry() {
    var val = recorderUI.querySelector("input[name='url']").value;
    if (!val.length && !sourceArchive ) {
        return;
    } else {
        clearWidget();
    }

    var baseVal = val.replace(/https?:\/\//, "");

    var foundId = undefined;
    var archive = null;

    for (var id in archives) {
        if (archives.hasOwnProperty(id) && baseVal.length >= archives[id].prefix.length && baseVal.startsWith(archives[id].prefix)) {
            foundId = id;
            archive = archives[id];
            break;
        }
    }

    if (foundId) {
        if (!!sourceArchive && sourceArchive.prefix === archive.prefix) {
            return;
        }

        sourceArchive = archive;
        window.wrExtractId = foundId;
        window.wrExtractPrefix = sourceArchive.prefix;

        // remove prefix
        sourceTarget = val.replace(/^https?:\/\//,"").replace(archive.prefix, "");
        var name = archive.name;

        // parse collection
        if (sourceArchive.parse_collection) {
            var sourceColl = sourceTarget.split("/", 1)[0];
            sourceTarget = sourceTarget.substr(sourceColl.length + 1);
            name += " " + sourceColl;
            window.wrExtractId += ":" + sourceColl;
            window.wrExtractPrefix += sourceColl + "/";
        }

        // parse timestamp
        var ts = "Most recent";
        var tsMatch = sourceTarget.match(/^(\d{4,14})(\w{2}_)?\//);
        if (tsMatch) {
            ts = TimesAndSizesFormatter.ts_to_date(tsMatch[1], true);
            window.sourceTs = tsMatch[1];
        } else {
            window.sourceTs = undefined;
        }

        sourceTsStr = ts;
        sourceTarget = sourceTarget.replace(/\d+(\w{2}_)?\//, "");

        renderExtractWidget(ts, name);
        window.wrExtractModeAllArchives = true;

        recorderUI.querySelector(".input-group").classList.add("remote-archive");
    } else if (sourceArchive) {
        clearWidget();
    }
}

function setArchivesPreference(evt) {
    archivesToggleContainer.classList.toggle("on", evt.target.checked);
    window.wrExtractModeAllArchives = evt.target.checked;

    renderExtractWidget(sourceTsStr, sourceArchive.name);
}

$(function () {
    // input management
    recorderUI = document.querySelector(".new-recording-ui");
    sourcesDropdown = document.querySelector(".sources-dropdown");
    if (recorderUI && (window.curr_mode === "new" || window.curr_mode === "")) {

        var input = recorderUI.querySelector("input[name='url']");
        input.addEventListener("input", urlEntry);

        urlEntry();

        recorderUI.querySelector(".sources-widget").addEventListener("click", renderExtractDropdown);
        sourcesDropdown.addEventListener("click", function (evt) { evt.stopPropagation(); });

        // all archives toggle
        archivesToggleContainer = sourcesDropdown.querySelector(".archive-toggle");
        var archivesToggle = archivesToggleContainer.querySelector("#all-archives");
        archivesToggle.addEventListener("change", setArchivesPreference);
    } else if (recorderUI && window.curr_mode === "extract") {

        if (wbinfo.timestamp) {
            sourceTsStr = TimesAndSizesFormatter.ts_to_date(wbinfo.timestamp, true);
        } else {
            sourceTsStr = "Most Recent";
        }

        var source_coll = wbinfo.sources.split(":", 2);
        sourceArchive = archives[source_coll[0]];

        window.wrExtractId = source_coll[0];

        var name = sourceArchive.name;

        if (source_coll.length > 1) {
            name += " " + source_coll[1];
            window.wrExtractId += ":" + source_coll[1];
        }

        renderExtractWidget(sourceTsStr, name);
        sourceTarget = wbinfo.url;
        targetCollection = wbinfo.info ? decodeURIComponent(wbinfo.info.coll_title) : null;

        $(document).on("updateTs", function () {
            sourceTs = wbinfo.timestamp;
            sourceTsStr = TimesAndSizesFormatter.ts_to_date(wbinfo.timestamp, true);
            renderExtractWidget(sourceTsStr);
            renderExtractDropdown();
        });

        recorderUI.querySelector(".sources-widget").addEventListener("click", renderExtractDropdown);
    } else if (recorderUI && window.curr_mode === "patch") {
        var source_coll = wbinfo.sources.split(":", 2);
        sourceArchive = archives[source_coll[0]];

        window.wrExtractId = source_coll[0];

        $(document).on("updateTs", function () {
            sourceTs = wbinfo.timestamp;
            sourceTsStr = TimesAndSizesFormatter.ts_to_date(wbinfo.timestamp, true);
            renderExtractWidget(sourceTsStr);
        });
    }
});
