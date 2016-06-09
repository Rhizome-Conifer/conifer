$(function() {
	EditTitleInPlace.start();
});

var EditTitleInPlace = (function() {

	var start = function() {
		$('.page-header').on('click', '.edit-title', showEditForm);
		$('.page-header').on('click', '.cancel-edit-title', cancelEdit);
		$('.page-header').on('submit', '.edit-title-form', saveEdit);
	}

	var showEditForm = function() {
		hideTitleAndButton();
		showForm();
	}

	var hideTitleAndButton = function() {
		$('.editable-title').hide();
		$('.edit-title').hide();		
	}

	var showTitleAndButton = function() {
		$('.editable-title').show();
		$('.edit-title').show();				
	}

	var showForm = function() {
		var currentTitle = $('.editable-title').text();

		$("[name='collection-title']").val(currentTitle);
		$("[name='collection-title']").css('width', currentTitle.length + "em");

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
		// start spinner
		event.preventDefault();

		var collectionId = $('[data-collection-id]').attr('data-collection-id');
		var newName = $("[name='collection-title']").val();
		Collections.rename(collectionId, newName, updateView, showError);
	}

	var updateView = function(data) {
		// stop spinner
		var newName = data.renamed;

		updateHeader(newName); // change 2nd param to new id
		updateBreadcrumb(newName, newName); // change 2nd param to new id
		updateUrl(newName);  // change param to new id

		hideForm();
		showTitleAndButton();
	}

	var updateHeader = function(newName) {
		$('.editable-title').text(newName);
	}

	var updateBreadcrumb = function(newName, newId) {
		$('.collection-breadcrumb').attr('data-collection-id', newId);
		$('.collection-breadcrumb').attr('title', "Return to collection: " + newName);
		$('.collection-breadcrumb').attr('href', getNewUrl(newId));
		$('.collection-breadcrumb').text(newName);
	}

	var updateUrl = function(newId) {
		history.pushState({"renamed collection": newId }, newId, getNewUrl(newId));
	}

	var getNewUrl = function(newId) {
		var lastSlashIndex = window.location.href.lastIndexOf('/');
		var basePath = window.location.href.substring(0, lastSlashIndex + 1);
		return basePath + newId;
	}

	var showError = function(xhr) {
		// stop spinner
	}

	var cancelEdit = function() {
		event.preventDefault();

		$('.edit-title-form').addClass('collapse');
		$('.edit-title-form').removeClass('edit-title-form-visible');

		$('.editable-title').show();
		$('.edit-title').show();
	}

	return {
		start: start
	}
})();