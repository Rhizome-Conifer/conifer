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
			console.log('WE DID IT: ' + data);
		})
		.fail(function(xhr, textStatus, errorThrown){
			console.log('OH NOES ');
		});
	}

    return {
    	create: create
    	// update: update,
    	// get: get
    }
}());

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

		// Redirect to recording URL
	});
});