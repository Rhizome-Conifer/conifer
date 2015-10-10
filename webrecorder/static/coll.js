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
            $.ajax("/_setaccess?coll=" + coll_id + "&public=" + state, {
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
            var query = $.param({coll: coll_id, title: title});
            
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
        
//        $("#confirm-delete").click(function() {
//            $.ajax("/_delete?coll=" + coll_id, {
//                type: "DELETE",
//
//                success: function() {
//                    window.location.href = "/";
//                },
//            });
//        });
    }

    if (can_write) {
        init_markdown_editor(coll_id);
        
        if (coll_size != undefined) {
            $("#total-size").text(format_bytes(coll_size));
        }
    }
/*    
    function switch_state(state) {
        var prefix = "/" + coll_path + "/";
        if (state != "replay") {
            prefix += state + "/";
        }

        $(".nav-url-form").attr("data-path-prefix", prefix);

        var cls = {"record": "btn-primary",
                   "replay": "btn-success",
                   "patch": "btn-info",
                   "live": "btn-default"};

        $("#curr-state").removeClass("btn-primary btn-success btn-info btn-default");
        $("#curr-state").addClass(cls[state]);

        var label = $(".state-drop #" + state).text();

        $("#curr-state span.display-badge").text(label);
    }
    
    if (can_write) {
        switch_state("record");
    } else {
        switch_state("replay");
    }
    
    $(".state-drop a").click(function(e) {
        switch_state($(this).attr("id"));
        e.preventDefault();
    });
    */

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

        var res =  '<a href="' + url + '">' + title + '</a>';
        if (meta.col != 0) {
            return res;
        }
        var tags = full["tags"];
        var tagnames = {"snapshot": "Static Snapshot"}
        if (tags) {
            for (var i = 0; i < tags.length; i++) {
                res += "&nbsp;<span class='label label-success'>" + tagnames[tags[i]] + "</span>";
            }
        }
        return res;
    }

    pagesTable = $("#pageTable").DataTable( {
        "ajaxSource": "/_listpages?coll=" + coll_id,
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
        //var url = prefix;
        //url += "_warcs/" + data;
        var param = "coll=" + coll_id + "&warc=" + data;

        return '<a href="/_dlwarc?' + param + '">' + data + '</a>';
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
        "ajaxSource": "/_files?coll=" + coll_id,
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
