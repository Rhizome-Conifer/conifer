var Recordings = (function() {
    var API_ENDPOINT = "/api/v1/recordings";
    var query_string = "?user=" + user + "&coll=" + coll;

    var create = function(user, coll, attributes, doneCallback, failCallback) {
        var create_query = "?user=" + user + "&coll=" + coll;

        $.ajax({
            url: API_ENDPOINT + create_query,
            method: "POST",
            data: attributes,
        })
        .done(function(data, textStatus, xhr) {
            doneCallback(data);
        })
        .fail(function(xhr, textStatus, errorThrown) {
            failCallback(xhr);
        });

    }

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
            failCallback(xhr, textStatus, errorThrown, recordingId, attributes);
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

    var rename = function(recordingId, newTitle, doneCallback, failCallback) {
        var recordingId = recordingId;
        $.ajax({
            url: API_ENDPOINT + "/" + recordingId + "/rename/" + newTitle + query_string,
            method: "POST"
        }).done(function(data, textStatus, xhr) {
            doneCallback(data, recordingId);
        }).fail(function(xhr, textStatus, errorThrown) {
            failCallback(xhr, recordingId);
        });
    }

    return {
        get: get,
        create: create,
        addPage: addPage,
        removePage: removePage,
        modifyPage: modifyPage,
        getPages: getPages,
        rename: rename
    }
}());