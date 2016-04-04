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
});

var Recordings = (function() {

	var HOST = "http://192.168.99.100:8080";
	var API_ENDPOINT = HOST + "/api/v1/recordings";
	var current_user = "@anon"
	var current_collection = "anonymous"

	var create = function(attributes) {
		var query_string = "?u=" + current_user + "&c=" + current_collection;

		$.ajax({
			url: API_ENDPOINT + query_string,
			method: "POST",
			data: { "title": attributes.title },
		})
		.done(function(data, textStatus, xhr) {
			var collection = current_collection;
			var recording = data.recording.id;
			var recording_in_progress_url = HOST + "/" + collection + "/" + recording + "/record/" + attributes.url;

			window.location = recording_in_progress_url;
		})
		.fail(function(xhr, textStatus, errorThrown) {
			// Some error happened, handle it gracefully
		});
	}

    return {
    	create: create
    }
}());