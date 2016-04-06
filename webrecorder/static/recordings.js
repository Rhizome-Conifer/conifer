var current_user = "@anon"
var current_collection = "anonymous"

$(function() {
	// 'New recording': Record button
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

	// 'Recording in progress': Url bar 'Go' button / enter key
	$('header').on('submit', '.recording-in-progress', function(event) {
		event.preventDefault();

		var url = $("input[name='url']").val();

		RouteTo.recordingInProgress(current_user, current_collection, wbinfo.info.rec_id, url);
	});

	// 'Recording in progress': Stop recording button
	$('header').on('submit', '.stop-recording', function(event) {
		event.preventDefault();

		RouteTo.collectionInfo(current_user, current_collection);
	});

	// 'Browse recording': Url bar 'Go' button / enter key
	$('header').on('submit', '.browse-recording', function(event) {
		event.preventDefault();

		var url = $("input[name='url']").val();

		RouteTo.browseRecording(current_user, current_collection, wbinfo.info.rec_id, url);
	});

	$('header').on('submit', '.add-to-recording', function(event){
		event.preventDefault();

		var url = $("input[name='url']").val();

		RouteTo.recordingInProgress(current_user, current_collection, wbinfo.info.rec_id, url);
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
			RouteTo.recordingInProgress(
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

	var addPage = function(recordingId, attributes) {
		var attributes = attributes;
		$.ajax({
			url: API_ENDPOINT + "/" + recordingId + "/pages" + query_string,
			method: "POST",
			data: attributes
		})
		.done(function(data, textStatus, xhr){
			$("input[name='url']").val(attributes.url);
		})
		.fail(function(xhr, textStatus, errorThrown) {
			// Fail gracefully when the page can't be updated
		});
	}

    return {
    	create: create,
		get: get,
		addPage: addPage
    }
}());

var RouteTo = (function(){
	var host = window.location.protocol + "//" + window.location.host;

	var recordingInProgress = function(user, collection, recording, url) {
		if (user == "@anon") {
			routeTo(host + "/" + collection + "/" + recording + "/record/" + url);
		} else {
			routeTo(host + "/" + user + "/" + collection + "/" + recording + "/record/" + url);
		}
	}

	var collectionInfo = function(user, collection) {
		if (user == "@anon") {
			routeTo(host + "/anonymous");
		} else {
			routeTo(host + "/" + user + "/" + collection);
		}
	}

	var browseRecording = function(user, collection, recording, url) {
		if (user == "@anon") {
			routeTo(host + "/" + collection + "/" + recording + "/" + url);
		} else {
			routeTo(host + "/" + user + "/collection" + "/" + recording + "/" + url);
		}
	}

	var routeTo = function(url) {
		window.location.href = url;
	}

	return {
		recordingInProgress: recordingInProgress,
		collectionInfo: collectionInfo,
		browseRecording: browseRecording
	}
}());

var RecordingSizeWidget = (function() {
	var start = function() {
		if ($('.size-counter').length) {
			var spaceUsed = format_bytes(wbinfo.info.size);
			updateDom(spaceUsed);

			if (wbinfo.state == "record") {
				setInterval(pollForSizeUpdate, 10000);
			}
		}
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

var _orig_set_state = window.set_state;

window.set_state = function(state) {
    _orig_set_state(state);

    if (wbinfo.state == "record") {
		var recordingId = wbinfo.info.rec_id;
		var attributes = {};

		attributes.url = state.url;
		attributes.timestamp = state.timestamp;
		attributes.title = $('iframe').contents().find('title').text();

		Recordings.addPage(recordingId, attributes);
    } else if (wbinfo.state == "replay") {
		$("input[name='url']").val(state.url);
    }
};
