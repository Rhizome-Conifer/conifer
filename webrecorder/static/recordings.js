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

		window.location.href = Routes.recordingInProgressUrl(
			current_user, current_collection, wbinfo.info.rec_id, url);
	});

	// Stop recording form
	$('header').on('submit', '.stop-recording', function(event) {
		event.preventDefault();

		window.location.href = Routes.collectionInfoUrl(current_user, current_collection);
	});

	// Start size widget
	RecordingSizeWidget.start();
});

var Recordings = (function() {

	var API_ENDPOINT = "/api/v1/recordings";
	var query_string = "?user=" + current_user + "&coll=" + current_collection;

	var create = function(attributes) {

		$.ajax({
			url: API_ENDPOINT + query_string,
			method: "POST",
			data: { "title": attributes.title },
		})
		.done(function(data, textStatus, xhr) {
			window.location.href = Routes.recordingInProgressUrl(
				current_user, current_collection, data.recording.id, attributes.url);
		})
		.fail(function(xhr, textStatus, errorThrown) {
			// Some error happened, handle it gracefully
		});
	}

	var get = function(recordingId, doneCallbackFunction, failCallbackFunction) {
		$.ajax({
			url: API_ENDPOINT + "/" + recordingId + query_string,
			method: "GET",
		})
		.done(function(data, textStatus, xhr) {
			doneCallbackFunction(data);
		})
		.fail(function(xhr, textStatus, errorThrown) {
			failCallbackFunction();
		});

	}

    return {
    	create: create,
		get: get
    }
}());

var Routes = (function(){
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

var RecordingSizeWidget = (function() {
	var start = function() {
		var spaceUsed = format_bytes(wbinfo.info.size);

		updateDom(spaceUsed);
		setInterval(pollForSizeUpdate, 10000);
	}

	var pollForSizeUpdate = function() {
		Recordings.get(wbinfo.info.rec_id, updateDomAfterPoll, hideCounterOnFail)
	}

	var updateDomAfterPoll = function(data) {
		var spaceUsed = format_bytes(data.recording.size);

		updateDom(spaceUsed);
	}

	var updateDom = function(spaceUsed) {
		$('.size-counter .current-size').text(spaceUsed);
		$('.size-counter').removeClass('hidden');
	}

	var hideCounterOnFail = function() {
		$('.size-counter').addClass('hidden');
	}

	return {
		start: start
	}

})();