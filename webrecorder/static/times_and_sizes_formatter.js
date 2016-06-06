$(function() {
    TimesAndSizesFormatter.format();
});

var TimesAndSizesFormatter = (function() {

    var format_by_attr = function (attr_name, format_func) {
        $("[" + attr_name + "]").each(function(i, elem) {
            $(elem).text(format_func($(elem).attr(attr_name)));
        });
    }

    var format = function() {
        format_by_attr("data-size", format_bytes);
        format_by_attr("data-time-ts", ts_to_date);
        format_by_attr("data-time-sec", function(val) { return new Date(parseInt(val) * 1000).toLocaleString(); });
    }

    //From http://stackoverflow.com/questions/4498866/actual-numbers-to-the-human-readable-values
    function format_bytes(bytes) {
        if (!isFinite(bytes) || (bytes < 1)) {
            return "0 bytes";
        }
        var s = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
        var e = Math.floor(Math.log(bytes) / Math.log(1000));
        return (bytes / Math.pow(1000, e)).toFixed(2) + " " + s[e];
    }

    function ts_to_date(ts, is_gmt)
    {
        if (!ts) {
            return "";
        }

        if (ts.length < 14) {
            ts += "00000000000000".substr(ts.length);
        }

        var datestr = (ts.substring(0, 4) + "-" +
                      ts.substring(4, 6) + "-" +
                      ts.substring(6, 8) + "T" +
                      ts.substring(8, 10) + ":" +
                      ts.substring(10, 12) + ":" +
                      ts.substring(12, 14) + "-00:00");

        var date = new Date(datestr);
        if (is_gmt) {
            return date.toGMTString();
        } else {
            return date.toLocaleString();
        }
    }

    return {
        format: format
    }
})();
