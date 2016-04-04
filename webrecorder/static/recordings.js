var Recordings = (function() {

	var API_ENDPOINT = "http://192.168.99.100:8080/api/v1/recordings";
	var current_user = "@anon"

	var create = function(attributes) {
		var query_string = "?u=" + current_user + "&c=" + attributes.collection;
		var api_endpoint = $(this).attr('action');

		$.ajax({
			url: API_ENDPOINT + query_string,
			method: "POST",
			data: { "title": attributes.title },
		})
		.done(function(data, textStatus, xhr) {
			// Redirect to recording URL
		})
		.fail(function(xhr, textStatus, errorThrown) {
			if (xhr.responseJSON.status == "AlreadyExists") {
				$('.title').addClass('has-error');
				$("input[name='title']").data("aria-invalid", "true");
				$("input[name='title']").parent().append("<span class='help-block'>There's already a recording with that title in this collection.  Please pick a new recording title.</span>");
			} else {
				// Some other error happened, handle it gracefully
			}
		});

	}

    return {
    	create: create
    	// update: update,
    	// get: get
    }
}());

var clearNewRecordingErrors = function() {
	$('.title').removeClass("has-error");
	$('.collection').removeClass("has-error");
	$('.url').removeClass("has-error");
	$('input').removeData('aria-invalid');
	$('span.help-block').remove();
}

$(function() {

	// Create new recording form
	$('header').on('submit', '.new-recording-form', function(event) {
		event.preventDefault();
		clearNewRecordingErrors();

		var collection = $("input[name='collection']").val();
		var title = $("input[name='title']").val();
		var url = $("input[name='url']").val();

		Recordings.create(
			{"collection": collection,
			 "title": title, 
			 "url": url});
	});
});