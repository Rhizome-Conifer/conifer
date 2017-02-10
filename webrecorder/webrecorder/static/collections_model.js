var Collections = (function() {
    var API_ENDPOINT = "/api/v1/collections";
    var query_string = "?user=";
    query_string += (user ? user : curr_user);

    var create = function(title, is_public, doneCallback, failCallback) {
        var data = {"title": title,
                    "public": is_public ? "on" : "off"}

        $.ajax({
            url: API_ENDPOINT + query_string,
            method: "POST",
            data: data
        })
        .done(function(data, textStatus, xhr) {
            doneCallback(data);
        })
        .fail(function(xhr, textStatus, errorThrown) {
            failCallback(xhr, data);
        });
    }

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
        var collectionId = collectionId;
        $.ajax({
            url: API_ENDPOINT + "/" + collectionId + "/rename/" + encodeURIComponent(newName) + query_string,
            method: "POST"
        })
        .done(function(data, textStatus, xhr) {
            doneCallback(data);
        })
        .fail(function(xhr, textStatus, errorThrown) {
            failCallback(xhr, collectionId);
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
        create: create,
        get: get,
        rename: rename,
        getNumPages: getNumPages
    }
})();
