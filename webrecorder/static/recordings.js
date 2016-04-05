var current_user = "@anon"
var current_collection = "anonymous"

$(function() {
	// Create new recording form
	$('header').on('submit', '.new-recording-form', function(event) {
		event.preventDefault();

		var collection = $("input[name='collection']").val();
		var title = $("input[name='title']").val();
		var url = $("input[name='url']").val();

		Recordings.create(
			{"collection": collection,
			 "title": title,
			 "url": url});
	});

	// Recording in progress form
	$('header').on('submit', '.recording-in-progress', function(event) {
		event.preventDefault();

		var url = $("input[name='url']").val();

		window.location.href = UrlUtilities.recordingInProgressUrl(
			current_user, current_collection, wbinfo.info.rec_id, url);
	});

	// Stop recording form
	$('header').on('submit', '.stop-recording', function(event) {
		event.preventDefault();

		window.location.href = UrlUtilities.collectionInfoUrl(current_user, current_collection);
	});
});

var Recordings = (function() {

	var API_ENDPOINT = "/api/v1/recordings";

	var create = function(attributes) {
		var query_string = "?user=" + current_user + "&coll=" + current_collection;

		$.ajax({
			url: API_ENDPOINT + query_string,
			method: "POST",
			data: { "title": attributes.title },
		})
		.done(function(data, textStatus, xhr) {
			window.location.href = UrlUtilities.recordingInProgressUrl(
				current_user, current_collection, data.recording.id, attributes.url);
		})
		.fail(function(xhr, textStatus, errorThrown) {
			// Some error happened, handle it gracefully
		});
	}

    return {
    	create: create,
		//update: update
    }
}());

var UrlUtilities = (function(){
	var recordingInProgressUrl = function(user, collection, recording, url) {
		var host = window.location.protocol + "//" + window.location.host;

		if (user == "@anon") {
			return host + "/" + collection + "/" + recording + "/record/" + url;
		} else {
			return host + "/" + user + "/" + collection + "/" + recording + "/record/" + url;
		}
	}

	var collectionInfoUrl = function(user, collection) {
		var host = window.location.protocol + "//" + window.location.host;

		if (user == "@anon") {
			return host + "/anonymous"
		} else {
			return host + "/" + user + "/" + collection
		}
	}

	return {
		recordingInProgressUrl: recordingInProgressUrl,
		collectionInfoUrl: collectionInfoUrl
	}
}());

