/* eslint-disable */
import React from 'react';


let DevTools = null;

if (__DEVELOPMENT__ && __DEVTOOLS__) {
  const { createDevTools } = require('redux-devtools');
  //const ChartMonitor = require('redux-devtools-chart-monitor').default;
  const DockMonitor = require('redux-devtools-dock-monitor').default;
  const LogMonitor = require('redux-devtools-log-monitor').default;
  //const SliderMonitor = require('redux-slider-monitor');

  DevTools = createDevTools(
    <DockMonitor
      defaultIsVisible={false}
      toggleVisibilityKey="ctrl-d"
      changePositionKey="ctrl-p"
      changeMonitorKey="ctrl-m">
        <LogMonitor />
        {/*<SliderMonitor keyboardEnabled />*/}
        {/*<ChartMonitor />*/}
    </DockMonitor>
  );
}

export default DevTools;
