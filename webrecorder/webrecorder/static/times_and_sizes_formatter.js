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
        format_by_attr("data-size-display", format_bytes);
        format_by_attr("data-time-ts", ts_to_date);
        format_by_attr("data-time-sec", function(val) { return new Date(parseInt(val) * 1000).toLocaleString(); });
        format_by_attr("data-time-duration", secondsToStr);

        format_encoded("data-value-encoded", "data-target-decoded");
    }

    function format_encoded(encoded_attr, decoded_attr) {
        $("[" + encoded_attr + "]").each(function(i, elem) {

            var value = $(elem).attr(encoded_attr);
            if (!value) {
                return;
            }

            value = decodeURIComponent(value);

            var dec_val = $(elem).attr(decoded_attr);

            if (dec_val) {
                $(elem).attr(dec_val, value);
            } else {
                $(elem).text(value);
            }
        });
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

        if (ts == "*") {
            return "-";
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

    // From http://stackoverflow.com/questions/8211744/convert-time-interval-given-in-seconds-into-more-human-readable-form/8212878#8212878
    var secondsToStr = function (secs) {
        // TIP: to find current time in milliseconds, use:
        // var  current_time_milliseconds = new Date().getTime();

        function numberEnding (number) {
            return (number > 1) ? 's' : '';
        }

        //var temp = Math.floor(milliseconds / 1000);
        var temp = secs;

        var years = Math.floor(temp / 31536000);
        if (years) {
            return years + ' year' + numberEnding(years);
        }
        //TODO: Months! Maybe weeks?
        var days = Math.floor((temp %= 31536000) / 86400);
        if (days) {
            return days + ' day' + numberEnding(days);
        }
        var hours = Math.floor((temp %= 86400) / 3600);
        if (hours) {
            return hours + ' hour' + numberEnding(hours);
        }
        var minutes = Math.floor((temp %= 3600) / 60);
        if (minutes) {
            return minutes + ' minute' + numberEnding(minutes);
        }
        var seconds = temp % 60;
        if (seconds) {
            return seconds + ' second' + numberEnding(seconds);
        }
        return 'under a second'; //'just now' //or other string you like;
    }

    return {
        format: format,
        ts_to_date: ts_to_date,
    }
})();
