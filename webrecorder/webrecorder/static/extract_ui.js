
var archivesToggleContainer;
var recorderUI;
var sourcesDropdown;
var sourceTs;
var sourceTarget;
var sourceArchive;
var targetCollection = null;

function renderExtractWidget(ts, source) {
    recorderUI.querySelector(".sources-widget .ts").innerHTML = ts;
    recorderUI.querySelector(".sources-widget .mnt-label").innerHTML = source;
}

function renderExtractDropdown() {
    var sourceArchiveDisplay = "<a href='"+sourceArchive.info+"' target='_blank'><span>"+sourceArchive.name+"</span><span class='glyphicon glyphicon-new-window' /></a>";
    sourcesDropdown.querySelector(".ra-source").innerHTML = sourceTarget || "Empty";
    sourcesDropdown.querySelector(".ra-source-name").innerHTML = sourceArchiveDisplay;
    sourcesDropdown.querySelector(".ra-ts").innerHTML = sourceTs;
    sourcesDropdown.querySelector(".ra-collection").innerHTML = targetCollection || getStorage("__wr_currCollTitle") || DEFAULT_RECORDING_SESSION_NAME;
}

function clearWidget() {
    recorderUI.querySelector(".input-group").classList.remove("remote-archive");
    sourceArchive = null;
    window.wrExtractMode = false;
}

function urlEntry() {
    var val = recorderUI.querySelector("input[name='url']").value;
    if (!val.length && !sourceArchive ) {
        return;
    } else {
        clearWidget();
    }

    var baseVal = val.replace(/https?:\/\//, "");

    var found = false;
    var archive = null;

    for(var i=0; i < WAM.length && !found; i++) {
        if (baseVal.length >= WAM[i].prefix.length && baseVal.startsWith(WAM[i].prefix)) {
            found = true;
            archive = WAM[i];
        }
    }

    if (found) {
        if (!!sourceArchive && sourceArchive.prefix === archive.prefix) {
            return;
        }

        var ts = "Most recent";
        var tsMatch = val.match(/\/(\d{8,14})\//);
        if (tsMatch) {
            ts = TimesAndSizesFormatter.ts_to_date(tsMatch[1]);
        }

        sourceTs = ts;
        sourceArchive = archive;
        sourceTarget = val.replace(/^https?:\/\//,"").replace(archive.prefix, "").replace(/\d+\//, "");
        renderExtractWidget(ts, archive.name);
        window.wrExtractMode = true;
        window.wrExtractModeAllArchives = true;

        recorderUI.querySelector(".input-group").classList.add("remote-archive");
    } else if (sourceArchive) {
        clearWidget();
    }
}

function setArchivesPreference(evt) {
    archivesToggleContainer.classList.toggle("on", evt.target.checked);
    window.wrExtractModeAllArchives = evt.target.checked;
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
            sourceTs = TimesAndSizesFormatter.ts_to_date(wbinfo.timestamp);
        } else {
            sourceTs = "Most Recent";
        }

        sourceArchive = wamKeys[wbinfo.sources];
        renderExtractWidget(sourceTs, sourceArchive.name);
        sourceTarget = wbinfo.url;
        targetCollection = wbinfo.coll;

        recorderUI.querySelector(".sources-widget").addEventListener("click", renderExtractDropdown);
    }
});
