function ts_to_date(ts)
{
    if (ts.length < 14) {
        return ts;
    }

    var datestr = (ts.substring(0, 4) + "-" + 
                   ts.substring(4, 6) + "-" +
                   ts.substring(6, 8) + "T" +
                   ts.substring(8, 10) + ":" +
                   ts.substring(10, 12) + ":" +
                   ts.substring(12, 14) + "-00:00");

    return new Date(datestr).toLocaleString();
}

var pagesTable = undefined;
var warcsTable = undefined;

var DEFAULT_TAB = "#about";

$(function() {
    
    $("#home-view").html(marked($("#home-markdown").html()));
    
    $('a[href="#records"]').on('show.bs.tab', show_pages);
    $('a[href="#files"]').on('show.bs.tab', show_warcs);

    // Tab Nav
    $('#thetab a').click(function (e) {
        e.preventDefault();
        $(this).tab('show');
        if (e.target.hash) {
            window.location.hash = e.target.hash;
        }
    });

    var start_tab = DEFAULT_TAB;

    if (window.location.hash.match('#')) {
        start_tab = window.location.hash;
    }

    var tab = $('#thetab a[href=' + start_tab +']');
    if (!tab.length) {
        tab = $('#thetab a[href=' + DEFAULT_TAB + ']');
        window.location.hash = DEFAULT_TAB;
    }
    tab.tab('show');

    if (can_admin) {
        // Public/Private

        $(".ispublic").bootstrapSwitch();

        $(".ispublic").on('switchChange.bootstrapSwitch', function(event, state) {
            $.ajax("/_setaccess?coll=" + coll_path + "&public=" + state, {
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
        
//        $("#confirm-delete").click(function() {
//            $.ajax("/_delete?coll=" + coll_path, {
//                type: "DELETE",
//
//                success: function() {
//                    window.location.href = "/";
//                },
//            });
//        });
    }

    if (can_write) {

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
            
            $("#home-view").html($("#home-markdown").html());

            $("#home-view").markdown({ 
                savable: true,
                height: "400",
                //hideable: true,
                resize: "both",
                onSave: function (e) {                     
                    var content = e.getContent();

                    $.ajax({
                        type: "POST",
                        url: "/_desc/" + coll_path,
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

});

function show_pages() {
    if (pagesTable) {
        //pagesTable.ajax.reload( null, false );
        return;
    }

    var prefix = "/" + coll_path + "/";

    var render_pages = function (data, type, full, meta) {
        var url = prefix;
        if (full['ts']) {
            url += full['ts'] + "/";
        }
        url += full['url'];

        if (meta.col == 0) {
            var title = data;
            if (!title) {
                title = full['url'];
            }
        } else if (meta.col == 1) {
            var title = ts_to_date(data);
        } else {
            title = data;
        }

        return '<a href="' + url + '">' + title + '</a>';
    }

    pagesTable = $("#pageTable").DataTable( {
        "ajaxSource": "/_listpages?coll=" + coll_path,
        "order": [[ 1, "desc" ]],
        "columns": [
            { "data": "title" },
            { "data": "ts" },
        ],
        "lengthMenu": [[25, 50, 100, -1], [25, 50, 100, "All"]],
        "columnDefs": [ {
            "targets": [0, 1],
            "render": render_pages,
        }],
        "language": {
            "emptyTable": "No pages have been recorded in this collection yet"
        }
    });

    // Select
    $("#pageTable_length select").selectBoxIt({native: true});
}

function show_warcs() {
    if (warcsTable) {
        return;
    }

    var prefix = "/" + coll_path + "/";

    var render_warcs = function (data, type, full, meta) {
        var url = prefix;

        url += "warcs/" + data;

        return '<a href="' + url + '">' + data + '</a>';
    }

    var render_size = function (data, type, full, meta) {
        if (type === "sort") {
            return data;
        }
        return format_bytes(data);
    }

    var render_time = function (data, type, full, meta) {
        if (type === "sort") {
            return data;
        }

        return new Date(data * 1000).toLocaleString();
    }

    warcsTable = $("#warcsTable").DataTable( {
        "ajaxSource": "/_files?user=" + user + "&coll=" + coll,
        "order": [[ 1, "desc" ]],
        "columns": [
            { "data": "name" },
            { "data": "mtime", type: "num" },
            { "data": "size", type: "num"},
        ],
        "lengthMenu": [[25, 50, 100, -1], [25, 50, 100, "All"]],
        "columnDefs": [ {
            "targets": [0],
            "render": render_warcs,
        }, {
            "targets": [2],
            "render": render_size,
        }, {
            "targets": [1],
            "render": render_time,
        }
                      ],
    });
}