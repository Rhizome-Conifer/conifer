var Collections = (function() {
    var API_ENDPOINT = "/api/v1/collections";
    var query_string = "?user=" + user

    var get = function(user, doneCallback, failCallback) {
        $.ajax({
            url: API_ENDPOINT + query_string,
            method: "GET"
        })
        .done(function(data, textStatus, xhr) {
            doneCallback(data);
        })
        .fail(function(xhr, textStatus, errorThrown) {
            failCallback(xhr);
        });
    }

    var rename = function(collectionId, newName, doneCallback, failCallback) {
        $.ajax({
            url: API_ENDPOINT + "/" + collectionId + "/rename/" + newName + query_string,
            method: "POST"
        })
        .done(function(data, textStatus, xhr) {
            doneCallback(data);
        })
        .fail(function(xhr, textStatus, errorThrown) {
            failCallback(xhr);
        });
    }

    var getNumPages = function(doneCallback, failCallback) {
        $.ajax({
            url: API_ENDPOINT + "/" + coll + "/num_pages" + query_string,
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
        rename: rename,
        getNumPages: getNumPages
    }
})();