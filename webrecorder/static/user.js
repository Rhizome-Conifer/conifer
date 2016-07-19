$(function(){

    $(".ispublic").bootstrapSwitch();

    $('#create-modal').on('shown.bs.modal', function () {
        $('#title').select();
    });

});