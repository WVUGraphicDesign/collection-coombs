/*!
  * FilterableList.js - A custom filter plugin.
  * Version: 1.1
  * Author: Kofi Opoku + GPT
  * Year: 2025
  * License: MIT License
  */

// --- Global Configuration ---
window.FilterableListDefaults = {
    listSelector: '.filterable-list',
    itemSelector: ':scope > .item',
    itemDataAttribute: 'properties',
    hiddenClass: 'hidden',
    activeFilterClass: 'active',
    enableTransitions: true,
    transitionDuration: 400,
};

/**
 * Allows users to override default options globally.
 */
window.configureFilterableList = function(userOptions) {
    if (typeof userOptions === 'object' && userOptions !== null) {
        if (userOptions.hasOwnProperty('enableTransitions') && typeof userOptions.enableTransitions !== 'boolean') {
            delete userOptions.enableTransitions;
        }
        if (userOptions.hasOwnProperty('transitionDuration')) {
            const duration = parseInt(userOptions.transitionDuration, 10);
            if (isNaN(duration) || duration < 0) {
                delete userOptions.transitionDuration;
            } else {
                userOptions.transitionDuration = duration;
            }
        }
        Object.assign(window.FilterableListDefaults, userOptions);
    }
};
// --- End Global Configuration ---


class FilterableList {
    /**
     * Initializes a new FilterableList instance.
     */
    constructor(containerSelectorOrElement, options = {}) {
        if (typeof containerSelectorOrElement === 'string') {
            this.container = document.querySelector(containerSelectorOrElement);
            if (!this.container) return;
        } else if (containerSelectorOrElement instanceof Element) {
            this.container = containerSelectorOrElement;
        } else {
             return;
        }
        const internalDefaults = {
            listSelector: '.filterable-list',
            itemSelector: ':scope > .item',
            itemDataAttribute: 'properties',
            hiddenClass: 'hidden',
            activeFilterClass: 'active',
            enableTransitions: true,
            transitionDuration: 400
        };
        this.options = { ...internalDefaults, ...window.FilterableListDefaults, ...options };

        this.listElement = this.container.querySelector(this.options.listSelector);
        this.noMatchesMessageElement = this.listElement.querySelector('.no-matches-message');

        if (!this.listElement) return;

        this.items = Array.from(this.listElement.querySelectorAll(this.options.itemSelector));
        this.originalOrder = [...this.items];
        this.filterControlElements = Array.from(this.container.querySelectorAll('[data-action]'));

        this.itemPropertiesMap = new Map();
        this.items.forEach(item => {
            const propString = item.dataset[this.options.itemDataAttribute];
            this.itemPropertiesMap.set(item, this.parsePropertiesString(propString));
        });

        this.activeFilters = new Map();
        this.currentSortAttribute = null;
        this.currentSortDirection = 'asc';

        this.bindEvents();
    }

    /**
     * Parses the property string from a data attribute.
     */
    parsePropertiesString(propString) {
      const properties = {};
      if (!propString) return properties;

      propString.trim().split(/\s+/).forEach(pair => {
        const lastHyphenIndex = pair.lastIndexOf('-');

        if (lastHyphenIndex > 0 && lastHyphenIndex < pair.length - 1) {
          const key = pair.substring(0, lastHyphenIndex).trim();
          const rawValue = pair.substring(lastHyphenIndex + 1).trim();

          if (key && rawValue) {
            const numValue = parseFloat(rawValue);
            const value = !isNaN(numValue) && /^-?\d+(\.\d+)?$/.test(rawValue)
              ? numValue
              : rawValue;
            if (!properties.hasOwnProperty(key)) {
              properties[key] = [];
            }
            if (!properties[key].includes(value)) {
               properties[key].push(value);
            }
          }
        }
      });
      return properties;
    }

    /**
     * Retrieves the pre-parsed value(s) for an item's attribute.
     */
    getItemValue(item, attribute) {
        const properties = this.itemPropertiesMap.get(item);
        return properties && properties.hasOwnProperty(attribute) ? properties[attribute] : null;
    }

    /**
     * Binds event listeners to controls.
     */
    bindEvents() {
        this.filterControlElements.forEach(element => {
            const eventType = this.getEventTypeForElement(element);
            element.addEventListener(eventType, (event) => {
                if (eventType === 'click' && element.tagName.toLowerCase() === 'a') event.preventDefault();
                this.handleFilterInteraction(element);
            });
        });
    }

    /**
     * Determines the event type for a control element.
     */
    getEventTypeForElement(element) {
        switch(element.tagName.toLowerCase()) {
            case 'input':
                if (['checkbox', 'radio'].includes(element.type)) return 'change';
                if (['text', 'search'].includes(element.type)) return 'input';
                return 'change';
            case 'select':
                return 'change';
            default:
                return 'click';
        }
    }

    /**
     * Handles interaction with a filter control.
     */
    handleFilterInteraction(element) {
        const action = element.dataset.action;
        let attribute = element.dataset.filterAttribute;
        let value;
        let isRadio = false;

        switch(element.tagName.toLowerCase()) {
            case 'input':
                if (element.type === 'checkbox') {
                    value = element.checked ? element.dataset.filterValue : null;
                    if (!element.checked && action === 'filter') {
                        this.removeFilter(attribute, element.dataset.filterValue);
                        return;
                    }
                } else if (element.type === 'radio') {
                    isRadio = true;
                    value = element.checked ? element.dataset.filterValue : null;
                    if (!element.checked) return;
                } else {
                    value = element.value;
                }
                break;
            case 'select':
                value = element.value;
                if (action === 'sort' && !attribute) {
                    attribute = value;
                }
                break;
            default:
                value = element.dataset.filterValue;
        }

        if (action === 'sort') {
            if (attribute === this.currentSortAttribute) {
                this.currentSortDirection = this.currentSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                this.currentSortAttribute = attribute;
                this.currentSortDirection = 'asc';
            }
            this.updateActiveState(element);
            this.sortItems();
            return;
        }

        if (action === 'filter') {
            if (!isRadio && attribute && value && this.isFilterActive(attribute, value)) {
                this.removeFilter(attribute, value);
                if (element.tagName.toLowerCase() !== 'input') {
                     element.classList.remove(this.options.activeFilterClass);
                }
                return;
            }

            this.filterItems(attribute, value, isRadio);
            if (element.tagName.toLowerCase() !== 'input') {
                 this.updateActiveState(element);
            }
            return;
        }
        if (action !== 'reverse' && element.tagName.toLowerCase() !== 'input') {
             this.updateActiveState(element);
        }

        switch (action) {
            case 'reset': this.resetItems(); break;
            case 'reverse': this.reverseItems(); break;
            default: break;
        }
    }

    /**
     * Checks if a specific filter is active.
     */
    isFilterActive(attribute, value) {
        return this.activeFilters.has(attribute) &&
               this.activeFilters.get(attribute).has(value);
    }

    /**
     * Handles clicks on filter links (legacy).
     */
    handleFilterClick(clickedLink) {
        const action = clickedLink.dataset.action;
        const attribute = clickedLink.dataset.filterAttribute;
        const value = clickedLink.dataset.filterValue;

        this.filterLinks.forEach(el => el.classList.remove(this.options.activeFilterClass));
        clickedLink.classList.add(this.options.activeFilterClass);

        switch (action) {
            case 'sort': this.sortItems(attribute); break;
            case 'filter': this.filterItems(attribute, value); break;
            case 'reset': this.resetItems(); break;
            default: break;
        }
    }

    /**
     * Returns a comparison function for sorting.
     */
    compareItems() {
        const attribute = this.currentSortAttribute;
        const directionMultiplier = this.currentSortDirection === 'asc' ? 1 : -1;

        if (!attribute) return () => 0;

        return (a, b) => {
            const valueA = this.getItemValue(a, attribute);
            const valueB = this.getItemValue(b, attribute);

            if (valueA === null && valueB === null) return 0;
            if (valueA === null) return 1;
            if (valueB === null) return -1;

            let comparison = 0;
            if (typeof valueA === 'number' && typeof valueB === 'number') {
                comparison = valueA - valueB;
            } else {
                comparison = String(valueA).toLowerCase().localeCompare(String(valueB).toLowerCase());
            }
            return comparison * directionMultiplier;
        };
    }

    /**
     * Helper to perform FLIP animation.
     */
    animateWithFlip(domChangeFn, elementsToAnimate) {
        if (!this.options.enableTransitions) {
            domChangeFn();
            return;
        }

        const firstRects = new Map();
        elementsToAnimate.forEach(item => {
            firstRects.set(item, item.getBoundingClientRect());
        });

        domChangeFn();

        elementsToAnimate.forEach(item => {
            const lastRect = item.getBoundingClientRect();
            const firstRect = firstRects.get(item);

            if (firstRect && lastRect) {
                const deltaX = firstRect.left - lastRect.left;
                const deltaY = firstRect.top - lastRect.top;

                if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
                    item.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
                    item.style.transition = 'none';
                } else {
                    item.style.transform = '';
                }
            } else {
                 item.style.transform = '';
            }
        });

        this.listElement.offsetHeight;

        elementsToAnimate.forEach(item => {
            if (item.style.transform !== '') {
                item.style.transition = `transform ${this.options.transitionDuration}ms ease-in-out`;
                item.style.transform = '';

                const cleanup = () => {
                    item.style.transition = '';
                    item.removeEventListener('transitionend', cleanup);
                };
                item.addEventListener('transitionend', cleanup, { once: true });
            }
        });
    }

    /**
     * Sorts the items.
     */
    sortItems() {
        if (!this.currentSortAttribute) return;

        const visibleItems = this.items.filter(item => !item.classList.contains(this.options.hiddenClass));

        const sortDomChange = () => {
            this.items.sort(this.compareItems());
            this.items.forEach(item => this.listElement.appendChild(item));
            this._applyFilterClasses();
        };

        this.animateWithFlip(sortDomChange, visibleItems);
        this._updateNoMatchesMessage();
    }

    /**
     * Reverses the item order.
     */
    reverseItems() {
        const currentVisibleItems = Array.from(this.listElement.children)
                                      .filter(el => el.classList.contains('item') && !el.classList.contains(this.options.hiddenClass));

        const reverseDomChange = () => {
            const allCurrentItems = Array.from(this.listElement.children)
                                        .filter(el => el.classList.contains('item'));
            allCurrentItems.reverse();
            allCurrentItems.forEach(item => this.listElement.appendChild(item));
            this.items = allCurrentItems;
        };

        this.animateWithFlip(reverseDomChange, currentVisibleItems);
        this._updateNoMatchesMessage();
    }

    /**
     * Adds a filter.
     */
    filterItems(attribute, filterValue, isRadio = false) {
        if (!attribute || filterValue === null) return;

        if (isRadio && this.activeFilters.has(attribute)) {
            this.activeFilters.get(attribute).clear();
        }

        if (!this.activeFilters.has(attribute)) {
            this.activeFilters.set(attribute, new Set());
        }
        this.activeFilters.get(attribute).add(filterValue);

        this.applyFilters();
        this.updateControlStates();
    }

    /**
     * Removes a specific filter.
     */
    removeFilter(attribute, filterValue) {
        if (this.activeFilters.has(attribute)) {
            this.activeFilters.get(attribute).delete(filterValue);
            if (this.activeFilters.get(attribute).size === 0) {
                this.activeFilters.delete(attribute);
            }
        }
        this.applyFilters();
        this.updateControlStates();
    }

    /**
     * Applies active filters to items (internal).
     */
    _applyFilterClasses() {
      let visibleItemCount = 0;
      const instance = this;

      instance.items.forEach(item => {
        let shouldShow = true;
        if (instance.activeFilters.size > 0) {
          for (const [attribute, selectedValuesSet] of instance.activeFilters.entries()) {
            const itemValues = instance.getItemValue(item, attribute);
            const itemValuesArray = Array.isArray(itemValues) ? itemValues : (itemValues != null ? [itemValues] : []);

            const matchesAnySelected = Array.from(selectedValuesSet).some(filterValue => {
              const filterValStr = filterValue != null ? String(filterValue).toLowerCase() : '';
              return itemValuesArray.some(itemVal => {
                   const itemValStr = itemVal != null ? String(itemVal).toLowerCase() : '';
                   return itemValStr === filterValStr;
              });
            });

            if (!matchesAnySelected) {
              shouldShow = false;
              break;
            }
          }
        }

        if (shouldShow) {
          item.classList.remove(instance.options.hiddenClass);
          visibleItemCount++;
        } else {
          item.classList.add(instance.options.hiddenClass);
        }
      });

      instance._updateNoMatchesMessage(visibleItemCount);
      return visibleItemCount;
    }

    /**
     * Updates the 'no matches' message visibility (internal).
     */
    _updateNoMatchesMessage(count = -1) {
         if (this.noMatchesMessageElement) {
             const visibleCount = count === -1
                 ? this.items.filter(item => !item.classList.contains(this.options.hiddenClass)).length
                 : count;
             this.noMatchesMessageElement.style.display = visibleCount === 0 ? 'list-item' : 'none';
         }
    }

    /**
     * Applies filters and updates messages.
     */
    applyFilters() {
        const visibleCount = this._applyFilterClasses();
        this._updateNoMatchesMessage(visibleCount);
    }

    /**
     * Resets filters and sorting.
     */
    resetItems() {
        const visibleItemsBeforeReset = this.items.filter(item => !item.classList.contains(this.options.hiddenClass));

        const resetDomChange = () => {
            this.activeFilters.clear();
            this.currentSortAttribute = null;
            this.currentSortDirection = 'asc';

            this.originalOrder.forEach(item => {
                 item.classList.remove(this.options.hiddenClass);
                 this.listElement.appendChild(item);
            });
            this.items = [...this.originalOrder];

            this.filterControlElements.forEach(control => {
                 if (control.tagName.toLowerCase() === 'input' && (control.type === 'checkbox' || control.type === 'radio')) {
                    control.checked = false;
                } else if (control.tagName.toLowerCase() === 'select') {
                     control.selectedIndex = 0;
                }
                control.classList.toggle(this.options.activeFilterClass, control.dataset.action === 'reset');
                if (control.dataset.action === 'sort' && control.tagName.toLowerCase() !== 'select' && control.dataset.sortText) {
                    control.innerHTML = control.dataset.sortText;
                }
            });
             this._updateNoMatchesMessage();
        };

        this.animateWithFlip(resetDomChange, visibleItemsBeforeReset);
    }

    /**
     * Updates the visual state of control elements.
     */
    updateControlStates() {
        this.filterControlElements.forEach(el => {
            const action = el.dataset.action;
            const attr = el.dataset.filterAttribute;
            const val = el.dataset.filterValue;

            if (action === 'filter') {
                if (el.tagName.toLowerCase() !== 'input' && attr && val != null) {
                    const isActive = this.isFilterActive(attr, val);
                    el.classList.toggle(this.options.activeFilterClass, isActive);
                }
            } else if (action === 'reset') {
                el.classList.toggle(this.options.activeFilterClass, this.activeFilters.size === 0 && !this.currentSortAttribute);
            } else if (action === 'sort' && el.tagName.toLowerCase() !== 'select') {
                 el.classList.toggle(this.options.activeFilterClass, this.currentSortAttribute === attr);
            } else if (action === 'sort' && el.tagName.toLowerCase() === 'select') {
                 const resetControl = this.filterControlElements.find(c => c.dataset.action === 'reset');
                 if (resetControl && this.currentSortAttribute) {
                     resetControl.classList.remove(this.options.activeFilterClass);
                 }
            }
        });
    }

    /**
     * Updates the active state styling for a specific control element.
     */
    updateActiveState(element) {
        if (element.tagName.toLowerCase() === 'input' &&
            (element.type === 'checkbox' || element.type === 'radio')) {
            this.updateControlStates();
            return;
        }

        if (element.tagName.toLowerCase() === 'select' && element.dataset.action === 'sort') {
            this.filterControlElements.forEach(el => {
                 if (el.dataset.action === 'sort' && el.tagName.toLowerCase() !== 'select') {
                     el.classList.remove(this.options.activeFilterClass);
                     if (el.dataset.sortText) {
                         el.innerHTML = el.dataset.sortText;
                     }
                 }
            });
            this.updateControlStates();
            return;
        }

        const action = element.dataset.action;

        if (action === 'reset') {
            this.filterControlElements.forEach(el => {
                if (el !== element) {
                    el.classList.remove(this.options.activeFilterClass);
                    if (el.dataset.action === 'sort' && el.tagName.toLowerCase() !== 'select' && el.dataset.sortText) {
                        el.innerHTML = el.dataset.sortText;
                    }
                }
            });
            element.classList.add(this.options.activeFilterClass);

        } else if (action === 'filter') {
            this.updateControlStates();

        } else if (action === 'sort') {
            const clickedAttribute = element.dataset.filterAttribute;

            this.filterControlElements.forEach(el => {
                if (el.dataset.action === 'sort' && el.tagName.toLowerCase() !== 'select') {
                    el.classList.remove(this.options.activeFilterClass);
                    const baseText = el.dataset.sortText || el.textContent.replace(/\s*([↑↓]|\(A-Z\)|\(Z-A\))\s*$/,'').trim();
                    if (el.dataset.sortText) {
                        el.innerHTML = el.dataset.sortText;
                    } else {
                         el.dataset.sortText = baseText;
                         el.innerHTML = baseText;
                    }
                } else if (el.dataset.action === 'sort' && el.tagName.toLowerCase() === 'select') {
                }
            });

            const baseText = element.dataset.sortText || element.textContent.replace(/\s*([↑↓]|\(A-Z\)|\(Z-A\))\s*$/,'').trim();
            if (!element.dataset.sortText) {
                element.dataset.sortText = baseText;
            }

            let finalHTML = baseText;

            if (this.currentSortAttribute === clickedAttribute && clickedAttribute === 'name') {
                 const directionIndicatorText = this.currentSortDirection === 'asc' ? '(A-Z)' : '(Z-A)';
                 finalHTML = `${baseText} <span class="sort-direction">${directionIndicatorText}</span>`;
            }

            element.classList.add(this.options.activeFilterClass);
            element.innerHTML = finalHTML;
            this.updateControlStates();

        } else if (action === 'reverse') {
            this.updateControlStates();
        } else {
            this.updateControlStates();
        }
    }
}

// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.filterable-container').forEach(containerElement => {
        new FilterableList(containerElement);
    });

    // Or initialize specific containers by selector:
    // new FilterableList('#mySpecificContainerId');
    // new FilterableList('.product-filters');
});