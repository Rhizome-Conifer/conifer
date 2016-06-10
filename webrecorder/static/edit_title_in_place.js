$(function() {
	EditTitleInPlace.start();
});

var EditTitleInPlace = (function() {

	var start = function() {
		$('.wr-content').on('click', '.edit-title', showEditForm);
		$('.wr-content').on('click', '.cancel-edit-title', cancelEdit);
		$('.wr-content').on('submit', '.edit-title-form', saveEdit);
	}

	var showEditForm = function() {
		hideTitleAndEditButton();
		showForm();
	}

	var hideTitleAndEditButton = function() {
		$('.editable-title').hide();
		$('.edit-title').hide();		
	}

	var showTitleAndEditButton = function() {
		$('.editable-title').show();
		$('.edit-title').show();				
	}

	var showForm = function() {
		var currentTitle = $('.editable-title').text();

		$("[name='collection-title']").val(currentTitle);
		$("[name='collection-title']").css('width', currentTitle.length + "em");

		showFormButtons();
		$('.editable-title').after($('.edit-title-form'));
		$('.edit-title-form').removeClass('collapse');
		$('.edit-title-form').find('[autofocus]').focus();
		$('.edit-title-form').addClass('edit-title-form-visible');
	}

	var hideForm = function() {
		$('.edit-title-form').removeClass('edit-title-form-visible');
		$('.edit-title-form').addClass('collapse');		
	}

	var saveEdit = function() {
		event.preventDefault();

		hideFormButtons();
		showSpinner();

		var collectionId = $('[data-collection-id]').attr('data-collection-id');
		var newName = $("[name='collection-title']").val();
		Collections.rename(collectionId, newName, updateTitle, showError);
	}

	var updateTitle = function(data) {
		removeSpinner();

		updateHeader(data);
		updateBreadcrumb(data);
		updateUrl(data);

		hideForm();
		showTitleAndEditButton();

		FlashMessage.show("success", "Your collection has been successfully renamed.");
	}

	var updateHeader = function(data) {
		$('.editable-title').text(data.title);
	}

	var updateBreadcrumb = function(data) {
		$('.collection-breadcrumb').attr('data-collection-id', data.id);
		$('.collection-breadcrumb').attr('title', "Return to collection: " + data.name);
		$('.collection-breadcrumb').attr('href', getNewUrl(data.id));
		$('.collection-breadcrumb').text(data.title);
	}

	var updateUrl = function(data) {
		history.pushState({"renamed collection to": data.id }, data.id, getNewUrl(data.id));
	}

	var getNewUrl = function(newId) {
		var lastSlashIndex = window.location.href.lastIndexOf('/');
		var basePath = window.location.href.substring(0, lastSlashIndex + 1);
		return basePath + newId;
	}

	var showError = function(xhr) {
		removeSpinner();
		FlashMessage.show("danger", "Uh oh.  Something went wrong while renaming your collection.  Please try again later or <a href='mailto: support@webrecorder.io'>contact us</a>.");
		hideForm();
		showTitleAndEditButton();
	}

	var cancelEdit = function() {
		hideForm();
		showTitleAndEditButton();
	}

	var hideFormButtons = function() {
		$('.submit-edit-title').hide();
		$('.cancel-edit-title').hide();
	}

	var showFormButtons = function() {
		$('.submit-edit-title').show();
		$('.cancel-edit-title').show();
	}

	var showSpinner = function() {
		var spinnerDOM = "<span class='btn btn-default btn-xs edit-title-loading-spinner' role='alertdialog' aria-busy='true' aria-live='assertive'></span>";
		$('.edit-title-form').append(spinnerDOM);
	}

	var removeSpinner = function() {
		$('.edit-title-loading-spinner').remove();
	}

	return {
		start: start
	}
})();