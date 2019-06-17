import Component from '@ember/component';
import layout from '../templates/components/accessibility-result';
import { inject as service } from '@ember/service';
import { htmlSafe } from '@ember/template';
import { computed } from '@ember/object';
import { bind, debounce, cancel } from '@ember/runloop';

import findScrollContainer from '@coyote-labs/ember-accessibility/utils/find-scroll-container';
import getPopoverPosition from '@coyote-labs/ember-accessibility/utils/get-popover-position';
import { applyStyles, resetStyles } from '@coyote-labs/ember-accessibility/utils/element-style';

const impactColors = {
  critical: 'rgb(220, 53, 69, 0.5)',
  serious: 'rgb(255, 153, 102, 0.5)',
  moderate: 'rgb(255, 204, 0, 0.5)',
  minor: 'rgb(23, 162, 184, 0.5)'
};

export default Component.extend({
  layout,
  tagName: 'span',
  canShowDetails: false,
  style: '',
  popOverPos: '',
  popOverStyle: '',
  scrollDebounce: 150,
  accessibilityTest: service('accessibility-test'),
  isAccessibilityTest: true,

  mouseEnter() {
    let violatingElement = document.querySelector(this.domElement);

    // handle components that might disappear after audit is run
    if (!violatingElement) {
      let { violations } = this.accessibilityTest;
      this.set('accessibilityTest.violations', violations.without(this.violation));

      return;
    }

    let rectangle = violatingElement.getBoundingClientRect();

    applyStyles(this.element.querySelector('.accessbility-result-overlay'), {
      'position': 'absolute',
      'top': `${rectangle.top + window.scrollY}px`,
      'left': `${rectangle.left + window.scrollX}px`,
      'bottom': `${rectangle.bottom}px`,
      'right': `${rectangle.right}px`,
      'height': `${rectangle.height}px`,
      'width': `${rectangle.width}px`,
      'background': 'rgba(0, 0, 0, 0.3)',
      'border-radius': '5px',
      'z-index': '2147483635'
    });
  },

  mouseLeave() {
    resetStyles(this.element.querySelector('.accessbility-result-overlay'));
  },

  didInsertElement() {
    this._super(...arguments);

    this._listen();
    this.findPosition();
  },

  impactIcon: computed('violation.impact', function() {
    let { impact = 'minor' } = this.violation;
    return `${impact.toLowerCase()}-icon`;
  }),

  willDestroyElement() {
    this._super(...arguments);
    this._stopListening();
  },

  _listen() {
    this.setProperties({
      _scrollHandler: bind(this, '_scroll'),
      _clickHandler: bind(this, '_outsideClick')
    });

    this._listener().addEventListener('scroll', this._scrollHandler);
    document.addEventListener('click', this._clickHandler);
  },

  _stopListening() {
    this._listener().removeEventListener('scroll', this._scrollHandler);
    document.removeEventListener('click', this._clickHandler);
    cancel(this._scrollDebounceId);
  },

  _listener() {
    let searchIndex = this.violation.index || 0;
    let node = document.querySelector(this.violation.nodes[searchIndex].target[0]);
    let scrollParentElement = findScrollContainer(node);
    if (scrollParentElement) {
      return scrollParentElement;
    }

    return this.element;
  },

  _scroll(e) {
    this.set('_scrollDebounceId', debounce(this, '_debouncedScroll', e, this.scrollDebounce));
  },

  _outsideClick(e) {
    let { target } = e;
    if (!target.closest(`#${this.elementId}`)) {
      this.set('canShowDetails', false);
    }
  },

  _debouncedScroll() {
    this.findPosition();
  },

  findPosition() {
    if (this.isDestroyed) {
      return;
    }

    let searchIndex = this.violation.index || 0;
    this.set('domElement', this.violation.nodes[searchIndex].target[0]);
    let violatedElement = document.querySelector(this.domElement);
    if (!violatedElement) {
      return;
    }

    let violatedElementPos = violatedElement.getBoundingClientRect();

    let color = impactColors[this.violation.impact];
    let currentStyleEle = {
      'position': 'absolute',
      'top': `${violatedElementPos.top + window.scrollY}px`,
      'left': `${violatedElementPos.left + window.scrollX}px`,
      'background': color,
      'border': `2px solid ${color.replace(', 0.5', '')}`
    };

    let failureSummary = this.violation.nodes[searchIndex].failureSummary || [];
    failureSummary = failureSummary.split('\n');
    failureSummary = failureSummary.map((failure) => {
      if (failure.length) {
        if (failure.includes('Fix all of the following') || failure.includes('Fix any of the following')) {
          return htmlSafe(`<b>${failure}</b>`);
        }

        return htmlSafe(`<li>${failure}</li>`);
      }
    });

    applyStyles(this.element.querySelector('button'), currentStyleEle);

    this.set('failureSummary', failureSummary);
  },

  actions: {
    showDetails() {
      if (this.toggleProperty('canShowDetails')) {
        let popOverElem = this.element.querySelector(`[violation-id='${this.violation.id}']`);
        let buttonElem = this.element.querySelector('button');
        let arrowElem = this.element.querySelector('.arrow');

        let {
          popOverPos,
          topPos,
          leftRightPos,
          arrowPos
        } = getPopoverPosition(popOverElem, buttonElem);

        applyStyles(popOverElem, {
          'top': `${topPos}px`,
          'left': `${leftRightPos}px`
        });

        applyStyles(arrowElem, {
          'top': `${arrowPos}px`
        });

        this.set('popOverPos', popOverPos);
      }
    }
  }
});
