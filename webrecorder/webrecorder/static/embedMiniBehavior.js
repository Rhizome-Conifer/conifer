// a mini behavior script that only operates in child frames of top
(() => {
  if (self === self.top) {
    return;
  }


  const init = () => {
    try {
      if (self.wbinfo && !self.wbinfo.proxy_magic && self.parent === self.top) {
        return;
      }

      // autoscaler's detect_media.js by @ikreymer adapted for autobrowser
      // if we detect a special action
      const specialActions = [
        {
          rx: /w\.soundcloud\.com/,
          check(url) {
            const autoplay = url.searchParams.get('auto_play');
            return autoplay === 'true';
          },
          handle(url) {
            url.searchParams.set('auto_play', 'true');
            // set continuous_play to true in order to handle
            // a playlist etc
            url.searchParams.set('continuous_play', 'true');
            self.location.href = url.href;
          },
        },
        {
          rx: [/player\.vimeo\.com/, /youtube\.com\/embed\//],
          check(url) {
            const autoplay = url.searchParams.get('autoplay');
            return autoplay === '1';
          },
          handle(url) {
            url.searchParams.set('autoplay', '1');
            self.location.href = url.href;
          },
        },
      ];
      const url = new URL(self.location.href);
      for (let i = 0; i < specialActions.length; i++) {
        if (Array.isArray(specialActions[i].rx)) {
          const rxs = specialActions[i].rx;
          for (let j = 0; j < rxs.length; j++) {
            if (url.href.search(rxs[j]) >= 0) {
              if (specialActions[i].check(url)) return;
              return specialActions[i].handle(url);
            }
          }
        } else if (url.href.search(specialActions[i].rx) >= 0) {
          if (specialActions[i].check(url)) return;
          return specialActions[i].handle(url);
        }
      }
    } catch (e) {}
    // default min-behavior
    // scrolls the frame and plays any video, audio (embeded via tag)
    // until no more scrolling an be done
    const canScrollMore = () =>
      self.scrollY + self.innerHeight <
      Math.max(
        self.document.body.scrollHeight,
        self.document.body.offsetHeight,
        self.document.documentElement.clientHeight,
        self.document.documentElement.scrollHeight,
        self.document.documentElement.offsetHeight
      );

    const scrollOpts = { top: 500, left: 0, behavior: 'auto' };
    const played = Symbol(self.crypto.getRandomValues(new Uint8Array(20)).join('-'));
    const noop = () => {};

    function extract() {
      const media = self.document.querySelectorAll('audio, video');
      const proms = [];
      for (let i = 0; i < media.length; i++) {
        if (media[i].paused && !media[i][played]) {
          proms.push(media[i].play().catch(noop));
          Object.defineProperty(media[i], played, {
            value: true,
            enumerable: false,
          });
        }
      }
      if (proms.length > 0) {
        Promise.all(proms).then(run);
        return;
      }
      setTimeout(run, 2500);
    }

    function run() {
      if (canScrollMore()) {
        self.scrollBy(scrollOpts);
        Promise.resolve().then(extract);
      }
    }
    run();
  };
  // we do not want any actions to actions to happen until
  // the document is ready
  if (self.document.readyState !== 'complete') {
    const i = setInterval(() => {
      if (self.document.readyState === 'complete') {
        clearInterval(i);
        init();
      }
    }, 1500);
    return;
  }
  init();
})();
