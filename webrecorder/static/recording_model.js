var Recordings = (function() {
    var API_ENDPOINT = "/api/v1/recordings";
    var query_string = "?user=" + user + "&coll=" + coll;

    var get = function(recordingId, doneCallback, failCallback) {
        $.ajax({
            url: API_ENDPOINT + "/" + recordingId + query_string,
            method: "GET",
        })
        .done(function(data, textStatus, xhr) {
            doneCallback(data);
        })
        .fail(function(xhr, textStatus, errorThrown) {
            failCallback(xhr);
        });

    }

    var addPage = function(recordingId, attributes) {
        var attributes = attributes;
        $.ajax({
            url: API_ENDPOINT + "/" + recordingId + "/pages" + query_string,
            method: "POST",
            data: attributes
        })
        .done(function(data, textStatus, xhr){
            BookmarkCounter.update(attributes);
        })
        .fail(function(xhr, textStatus, errorThrown) {
            // Fail gracefully when the page can't be updated
        });
    }

    var modifyPage = function(recordingId, attributes, doneCallback, failCallback) {
        var attributes = attributes;
        var recordingId = recordingId;
        $.ajax({
            url: API_ENDPOINT + "/" + recordingId + "/page/" + attributes.url + query_string,
            method: "POST",
            data: attributes
        })
        .done(function(data, textStatus, xhr) {
            doneCallback(data);
        })
        .fail(function(xhr, textStatus, errorThrown) {
            failCallback(xhr, textStatus, errorThrown, recordingId);
        });
    }

    var removePage = function(recordingId, attributes, doneCallback) {
        $.ajax({
            url: API_ENDPOINT + "/" + recordingId + "/pages" + query_string,
            method: "DELETE",
            data: attributes
        })
        .done(function(data, textStatus, xhr){
            doneCallback(data);
        });
    }

    var getPages = function(recordingId, doneCallback, failCallback) {
        // no recordingId if in collection replay mode
        // skipping for now, possible to get pages for all recordings
        if (!recordingId) {
            failCallback();
            return;
        }

        $.ajax({
            url: API_ENDPOINT + "/" + recordingId + "/pages" + query_string,
            method: "GET",
        })
        .done(function(data, textStatus, xhr){
            doneCallback(data);
        })
        .fail(function(xhr, textStatus, errorThrown) {
            failCallback(xhr);
        });
    }

    return {
        get: get,
        addPage: addPage,
        removePage: removePage,
        modifyPage: modifyPage,
        getPages: getPages
    }
}());