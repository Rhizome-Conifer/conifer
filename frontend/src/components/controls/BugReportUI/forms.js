import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Button, ControlLabel, Form, FormControl, FormGroup } from 'react-bootstrap';

import { CheckboxField } from './fields';


class ReportBugForm extends PureComponent {
  static contextTypes = {
    currMode: PropTypes.string
  };

  static propTypes = {
    cb: PropTypes.func,
  };

  constructor(props) {
    super(props);

    this.state = {
      desc: '',
      email: ''
    };
  }

  save = (evt) => {
    evt.preventDefault();

    this.props.cb({
      ...this.state,
      state: this.context.currMode,
      url: window.location.href
    });
  }

  handleChange = (evt) => {
    if (evt.target.type === 'checkbox') {
      if (evt.target.name in this.state) {
        this.setState({ [evt.target.name]: !this.state[evt.target.name] });
      } else {
        this.setState({ [evt.target.name]: true });
      }
    } else {
      this.setState({ [evt.target.name]: evt.target.value });
    }
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
            aria-label="additional info (optional)"
            name="desc"
            onChange={this.handleChange}
            componentClass="textarea"
            value={desc}
            placeholder="Additional Info (optional)" />
        </FormGroup>
        <FormGroup>
          <ControlLabel>Email to notify when this issue is fixed: (optional)</ControlLabel>
          <FormControl
            aria-label="email (optional)"
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
