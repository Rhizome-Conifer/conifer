import React, { Component } from 'react';
import 'swagger-ui/dist/swagger-ui.css';

import './style.scss';

class ApiDocs extends Component {
  componentDidMount() {
    const SwaggerUi = require('swagger-ui');
    SwaggerUi({
      dom_id: '#swaggerContainer',
      url: `/api/v1.json`,
      presets: [SwaggerUi.presets.apis],
    });
  }

  render() {
    return (
      <div>
        <div id="swaggerContainer" />
      </div>
    );
  }
}


export default ApiDocs;
