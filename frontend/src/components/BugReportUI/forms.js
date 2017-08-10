import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Button, ControlLabel, Form,
         FormControl, FormGroup } from 'react-bootstrap';

import { CheckboxField } from 'components/BugReportUI/fields';


class ReportBugForm extends Component {
  static propTypes = {
    cb: PropTypes.func,
  };

  constructor(props) {
    super(props);

    this.state = {};
  }

  save = (evt) => {
    evt.preventDefault();

    this.props.cb(this.state);
  }

  handleChange = (evt) => {
    this.setState({ [evt.target.name]: evt.target.value });
  }

  render() {
    const { email, desc } = this.state;
    const fields = [
      { name: 'loading', label: 'Page not loading' },
      { name: 'missing', label: 'Missing content (Images, Video)' },
      { name: 'video', label: 'Video/Audio not playing' },
      { name: 'embed', label: 'Embedded content issues' },
      { name: 'scrolling', label: 'Scrolling issues' },
      { name: 'leak', label: 'Some items not archived, loading from live web' }
    ];

    return (
      <Form id="bugform" onSubmit={this.save}>
        {
          fields.map(
            field => <CheckboxField {...field} key={field.name} cb={this.handleChange} />
          )
        }
        <FormGroup id="formControlTextarea">
          <FormControl
            name="desc"
            onChange={this.handleChange}
            componentClass="textarea"
            value={desc}
            placeholder="Additional Info (optional)" />
        </FormGroup>
        <FormGroup>
          <ControlLabel>Email to notify when this issue is fixed: (optional)</ControlLabel>
          <FormControl
            id="bugEmail"
            type="email"
            name="email"
            onChange={this.handleChange}
            value={email}
            placeholder="Email" />
        </FormGroup>
        <Button bsStyle="primary" type="submit" block>Send Report</Button>
      </Form>
    );
  }
}

export default ReportBugForm;
