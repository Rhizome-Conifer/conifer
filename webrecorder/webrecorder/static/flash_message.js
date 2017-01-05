var FlashMessage = (function() {
	var ALERT_TYPES = ["success", "info", "warning", "danger"];

	var show = function(type, text) {
		$('.wr-content').prepend(getMessageDOM(type, text));
		$('html, body').animate({ scrollTop: 0 }, 'fast');
	}

	var getMessageDOM = function(type, text) {
		if (ALERT_TYPES.indexOf(type) === -1) {
			type = "info";
		}

		return $("<div class='alert alert-" + type + " alert-dismissable' role='alert'>" +
		    "<button type='button' class='close' data-dismiss='alert' aria-label='Close'>" +
		        "<span aria-hidden='true'>&times;</span>" +
		    "</button>" + 
		    text +
		"</div>");
	}

	return {
		show: show
	}
})();