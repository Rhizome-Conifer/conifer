
$(function() {
    if ($("#home-view").length) {
        $("#home-view").html(marked($("#home-markdown").html()));
    }
});

function init_markdown_editor(update_path) {

    $("#home-edit").click(function() {

        if ($(".md-editor").length) {
            console.log("already set");
            return;
        }

        function closeEditor()
        {
            $(".md-editor").remove();

            $("#home-edit").removeClass("active");

            $("#about").append($('<div>').attr("id", "home-view").
                               append(marked($("#home-markdown").html())));

        };

        if (!$("#home-view")) {
            return;
        }

        $("#home-view").html($("#home-markdown").html());

        $("#home-view").markdown({ 
            savable: true,
            height: "300",
            //hideable: true,
            resize: "both",
            onSave: function (e) {                     
                var content = e.getContent();

                $.ajax({
                    type: "POST",
                    url: update_path,
                    data: content,
                    success: function() {
                        $("#home-markdown").html(content);
                        closeEditor();
                    },
                    error: function() {
                        console.log("err");
                    },
                    dataType: 'text',
                });
            },

            footer: function(e) {
                return "<button id='home-edit-cancel' class='btn btn-default'>Cancel</button>";
            }
        });

        $("#home-edit-cancel").click(function() {
            closeEditor();
        });
    });
}
