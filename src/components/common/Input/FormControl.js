
import React, { Component, PropTypes, cloneElement, Children } from 'react';
import classnames from 'classnames';
import { COMPONENTS, getValueType } from '../util/higherOrders/FormItem';
import merge from '../util/utils/merge';
import { format } from '../util/utils/strings';
import { forEach, shallowEqual, hashcode } from '../util/utils/objects';

import { getLang, setLang } from '../util/lang';
setLang('validation');

function setHint(hints, key, value) {
  let text = getLang('validation.hints.' + key, null);
  if (text) {
    hints.push(format(text, value));
  }
}

class FormControl extends Component {
  constructor (props) {
    super(props);
    this.state = {
      validations: ''
    };

    // for check props
    this.items = {};
    this.itemBind = this.itemBind.bind(this);
    this.itemUnbind = this.itemUnbind.bind(this);
    this.itemChange = this.itemChange.bind(this);
    this.handleValidate = this.handleValidate.bind(this);
  }

  componentWillMount () {
    this.setItems(this.props);
  }

  componentWillReceiveProps (nextProps) {
    if (!shallowEqual(this.props, nextProps)) {
      this.setItems(nextProps);
    }
  }

  shouldComponentUpdate (nextProps, nextState) {
    if (!shallowEqual(this.props, nextProps)) {
      return true;
    }

    if (nextProps.formData) {
      let keys = Object.keys(this.items);
      for (let i=0, key; i<keys.length; i++) {
        key = keys[i];
        if (nextProps.formData[key] !== this.items[key].$value) {
          return true;
        }
      }
    }

    return !shallowEqual(this.state, nextState);
  }

  itemBind (props) {
    this.items[props.id] = props;

    if (this.props.itemBind) {
      this.props.itemBind(props);
    }
  }

  itemUnbind (id) {
    delete this.items[id];

    if (this.props.itemUnbind) {
      this.props.itemUnbind(...arguments);
    }
  }

  itemChange (id, value, result) {
    this.items[id].$value = value;

    this.handleValidate(id, result);

    if (this.props.itemChange) {
      this.props.itemChange(...arguments);
    }
  }

  handleValidate (id, result) {
    this.items[id].$validation = result;

    let validations = [];
    forEach(this.items, (item) => {
      if (item.$validation instanceof Error) {
        validations.push(item.$validation.message);
      }
    });
    validations = validations.join(', ');
    if (validations !== this.state.validations) {
      this.setState({ validations });
    }
  }

  getHint (props) {
    if (props.required) {
      this.required = true;
    }

    if (props.tip) {
      return '';
    }

    let valueType = getValueType(props.type);
    let hints = [];

    setHint(hints, this.props.type);
    if (props.min) { setHint(hints, `min.${valueType}`, props.min); }
    if (props.max) { setHint(hints, `max.${valueType}`, props.max); }

    return (props.label || '') + hints.join(', ');
  }

  setChildrenHint (hints, children) {
    Children.toArray(children).forEach((child) => {
      if (child.type && child.type.displayName === 'FormItem') {
        let hint = this.getHint(child.props);
        if (hint) {
          hints.push(hint);
        }
      } else if (child.children) {
        this.setChildrenHint(hints, children);
      }
    });
  }

  setItems (props) {
    let { label, layout, items, children, ...otherProps} = props;
    let hints = [];

    this.required = false;
    if (children) {
      this.setChildrenHint(hints, children);
    } else {
      if (!items) {
        items = [otherProps];
      }
    }

    if (items) {
      items.forEach((control) => {
        let hint = this.getHint(control);
        if (hint) {
          hints.push(hint);
        }
      });
    }

    this.setState({ items, hints: hints.join(', ') });
  }

  renderTip () {
    let { tip, errorText } = this.props;
    let { validations, hints } = this.state;
    hints = tip || hints;

    if (validations) {
      // if has tip，use tip
      if (errorText) { validations = errorText; }
      return <span key="tip" className="error">{validations}</span>;
    }

    if (hints) {
      return <span key="tip" className="hint">{hints}</span>;
    } else {
      return;
    }
  }

  propsExtend (props) {
    props.itemBind = this.itemBind;
    props.itemUnbind = this.itemUnbind;
    props.itemChange = this.itemChange;
    props.formData = this.props.formData;
    props.onValidate = this.handleValidate;
    props.readOnly = props.readOnly || this.props.readOnly;
    props.label = props.label || this.props.label;
  }

  renderChildren (children, index) {
    let newChildren = Children.toArray(children).map((child, i) => {
      //i = index + '.' + i;

      if (typeof child === 'string') {
        return <span key={i}>{child}</span>;
      }

      let props = {};
      if (child.type.isFormItem) {
        this.propsExtend(props);
      } else if (child.props && child.props.children === 'object') {
        props.children = this.renderChildren(child.props.children, i);
      }
      
      child = cloneElement(child, props);
      return child;
    });
    return newChildren;
  }

  renderItems () {
    const { children } = this.props;
	
    let items = (this.state.items || []).map((props, i) => {
      i += length;
      if (typeof props === 'string') {
        return <span key={i} dangerouslySetInnerHTML={{__html: props}} />;
      }
      let component = COMPONENTS[props.type];
      if (component) {
        this.propsExtend(props);
        props.key = `${props.label}|${props.name}`;
        props.$controlId = this.id;
        props = merge({}, props);
        return component.render(props);
      }
    });

    if (children) {
      items = items.concat(this.renderChildren(children, items.length));
    }

    items.push(this.renderTip());
    
    return items;
  }

  renderStacked (className) {
    return (
      <div style={this.props.style} className={className}>
          {this.renderItems()}
      </div>
    );
  }

  render () {
    let { hintType, layout, className } = this.props;
    if (!hintType) {
      hintType = layout === 'inline' ? 'pop' : 'block';
    }

    className = classnames(
      className,
      'rct-control-group',
      {
        'rct-has-error': this.state.validations.length > 0
      }
    );
    return this.renderStacked(className);
  }
}

FormControl.defaultProps = {
  type: 'text'
};

module.exports = FormControl;