import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

import SidebarHeader from 'components/SidebarHeader';


class InspectorPanelUI extends PureComponent {
  static propTypes = {
  };

  render() {
    return (
      <div style={{ flexGrow: 1 }}>
        <SidebarHeader label="Inspector Panel" />
      </div>
    );
  }
}

export default InspectorPanelUI;
