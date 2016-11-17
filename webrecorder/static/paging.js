var input = document.querySelector('.form-control');
var iframe = document.querySelector('iframe');
var timestamp = $('.replay-date');
var linklist = $('.linklist');
var index = 0;
var tagIdx = 0;
var linklistData = [];

// buttons
var next = $('.btn-next');
var prev = $('.btn-prev');
var dropdown = $('.input-group-btn .dropdown-menu');

// ui event binding
next.on('click', function () {
  if(index + 1 < data[keys[tagIdx]].length)
    setInput(data[keys[tagIdx]][++index]);
});

prev.on('click', function () {
  if(index - 1 >= 0)
    setInput(data[keys[tagIdx]][--index]);
});

timestamp.on('click', function (evt) {
  evt.stopPropagation();
  linklist.toggleClass('open');
})

dropdown.on('click', 'a', function (evt) {
  evt.preventDefault();
  var newTagIdx = $(evt.target).parent().index();

  if(newTagIdx === tagIdx) return;

  tagIdx = newTagIdx;
  index = 0;
  $('.tagName').html(keys[tagIdx]);

  if(data[keys[tagIdx]].length > 0)
    setInput(data[keys[tagIdx]][0]);

  // rerender link list
  linklist.find('ul.dropdown-menu').html(linklistData[tagIdx]);
});

$(document).on('keyup', function (evt) {
  // esc key
  if(evt.keyCode === 27) {
    $('.open').removeClass('open');
  }
});


function compile_links() {
  for(var i=0; i < keys.length; i++) {
    var linkopts = '';
    if(data[keys[i]].length > 0) {
      for(var tag of data[keys[i]]) {
        var parts = tag.id.split(' ');
        linkopts += "<li>"+(parts[0].replace(/(\?.*)/, '?...'))+"<span class='replay-date'>"+TimesAndSizesFormatter.ts_to_date(parts[1])+"</span></li>";
      }
      linklistData.push(linkopts);
    } else {
      linklistData.push('<li class="disabled">No results</li>');
    }
  }
}

function setInput(obj) {
  var parts = obj.id.split(' ');
  var url = parts[0];
  var ts = parts[1];
  var total = data[keys[tagIdx]].length;

  // prev button presentation
  if(index===0){
    prev.addClass('disabled');
  } else if(index > 0 && prev.hasClass('disabled')){
    prev.removeClass('disabled');
  }

  // next button presentation
  if(index===data[keys[tagIdx]].length-1) {
    next.addClass('disabled');
  } else if(index < total - 1 && next.hasClass('disabled')) {
    next.removeClass('disabled');
  }

  if(keys.length === 1)
    window.location.hash = index;

  input.value = '('+("0000"+(index + 1)).slice(-String(total).split('').length)+' of '+total+')  ' + url;
  timestamp.html(TimesAndSizesFormatter.ts_to_date(ts));
  iframe.src = '/_embed/'+obj.user+'/'+obj.coll+'/'+ts+(obj.br?'$br:'+obj.br:'')+'/'+url;
}


compile_links();

if(data[keys[tagIdx]].length) {
  index = parseInt(window.location.hash.slice(1), 10) || 0;
  setInput(data[keys[tagIdx]][index]);
}

linklist.find('ul.dropdown-menu').html(linklistData[tagIdx]);
linklist.find('ul.dropdown-menu').on('click', 'li', function () {
  var newIndex = $(this).index();
  if(newIndex !== index) {
    index = newIndex;
    setInput(data[keys[tagIdx]][index]);
  }
});