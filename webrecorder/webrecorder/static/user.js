$(function(){

    $(".ispublic").bootstrapSwitch();

    $('#create-modal').on('shown.bs.modal', function () {
        $('#title').select();
    });

    // survey countdown
    var survey = $(".survey-countdown");

    $('#survey-alert').on('close.bs.alert', function () {
        window.localStorage.setItem("__wr_skipSurvey", "1");
    });

    if(survey.length && !window.localStorage.getItem("__wr_skipSurvey")) {

      var start = new Date(0);
      start.setUTCSeconds(survey.data('start'));
      var end = new Date(0);
      end.setUTCSeconds(survey.data('end'));

      var now = new Date();
      var offset = now.getTimezoneOffset()/60;
      // apply gmt offset
      start.setHours(start.getHours() + offset);
      end.setHours(end.getHours() + offset);

      if(now > start && now < end ) {
        $('.wr-survey').show();
        var dayDiff = end.getDate() - now.getDate();
        var timeStr;

        if(dayDiff === 0) {
          var hourDiff = end.getHours() - now.getHours();
          var minDiff = end.getMinutes() - now.getMinutes();
          timeStr = hourDiff+' hour'+(hourDiff===1?'':'s')+' and '+minDiff+' minute'+(minDiff===1?'':'s')+' left!';
        } else {
          timeStr = dayDiff + ' day'+(dayDiff>1?'s':'')+' left!';
        }
        survey.html(timeStr);
      }
    }
});
