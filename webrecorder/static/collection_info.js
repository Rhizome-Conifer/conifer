$(function() {
    if (!can_admin) {
        // Public/Private
        return;
    }

    $(".ispublic").bootstrapSwitch();

    $(".ispublic").on('switchChange.bootstrapSwitch', function(event, state) {
        $.ajax({
            url: "/api/v1/collections/" + coll + "/public?user=" + user,
            method: "POST",
            data: {"public": state},

            success: function() {
                $(".ispublic").bootstrapSwitch("state", state, true);
            },
            error: function() {
                //$("#is_public").prop("checked", !state);
                $(".ispublic").bootstrapSwitch("toggleState", true)
                console.log("err");
            }
        });
    });
    
    $("#update-title-form").submit(function(e) {
        var title = $("#new-title").val();
        var query = $.param({coll: coll, title: title});
        
        if (!title) {
            return;
        }
        
        $.ajax({
            type: "GET",
            url: "/_settitle?" + query,
            success: function() {
                console.log("success");
                $("#coll-title").text(title);
            },
            error: function() {
                console.log("err");
            },
            dataType: 'text',
        });
        e.preventDefault();
    });
});
 
