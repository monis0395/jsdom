"use strict";
const webIDLConversions = require("webidl-conversions");
const { CSSStyleDeclaration } = require("cssstyle");
const notImplemented = require("./not-implemented");
const { installInterfaces } = require("../living/interfaces");
const { define} = require("../utils");
const Element = require("../living/generated/Element");
const namedPropertiesWindow = require("../living/named-properties-window");
const idlUtils = require("../living/generated/utils");
const documents = require("../living/documents.js");
const Selection = require("../living/generated/Selection");
const { forEachMatchingSheetRuleOfElement, getResolvedValue, propertiesWithResolvedValueImplemented } =
  require("../living/helpers/style-rules");
const CustomElementRegistry = require("../living/generated/CustomElementRegistry");

exports.createWindow = function (options) {
  return new Window(options);
};

// https://html.spec.whatwg.org/#the-window-object
function setupWindow(windowInstance) {

  installInterfaces(windowInstance, ["Window"]);

  const EventTargetConstructor = windowInstance.EventTarget;

  // eslint-disable-next-line func-name-matching, func-style, no-shadow
  const windowConstructor = function Window() {
    throw new TypeError("Illegal constructor");
  };
  Object.setPrototypeOf(windowConstructor, EventTargetConstructor);

  Object.defineProperty(windowInstance, "Window", {
    configurable: true,
    writable: true,
    value: windowConstructor
  });

  const windowPrototype = Object.create(EventTargetConstructor.prototype);
  Object.defineProperties(windowPrototype, {
    constructor: {
      value: windowConstructor,
      writable: true,
      configurable: true
    },
    [Symbol.toStringTag]: {
      value: "Window",
      configurable: true
    }
  });

  windowConstructor.prototype = windowPrototype;
  Object.setPrototypeOf(windowInstance, windowPrototype);

  windowInstance._globalObject = windowInstance;
}

// NOTE: per https://heycam.github.io/webidl/#Global, all properties on the Window object must be own-properties.
// That is why we assign everything inside of the constructor, instead of using a shared prototype.
// You can verify this in e.g. Firefox or Internet Explorer, which do a good job with Web IDL compliance.
function Window(options) {
  setupWindow(this, { runScripts: options.runScripts });

  const window = this;

  ///// PRIVATE DATA PROPERTIES

  // vm initialization is deferred until script processing is activated
  this._globalProxy = this;
  Object.defineProperty(idlUtils.implForWrapper(this), idlUtils.wrapperSymbol, { get: () => this._globalProxy });

  // List options explicitly to be clear which are passed through
  this._document = documents.createWrapper(window, {
    parsingMode: options.parsingMode,
    contentType: options.contentType,
    encoding: options.encoding,
    cookieJar: options.cookieJar,
    url: options.url,
    lastModified: options.lastModified,
    referrer: options.referrer,
    concurrentNodeIterators: options.concurrentNodeIterators,
    parseOptions: options.parseOptions,
    defaultView: this._globalProxy,
    global: this
  }, { alwaysUseDocumentClass: true });

  const documentOrigin = idlUtils.implForWrapper(this._document)._origin;
  this._origin = documentOrigin;

  // Set up the window as if it's a top level window.
  // If it's not, then references will be corrected by frame/iframe code.
  this._parent = this._top = this._globalProxy;
  this._frameElement = null;

  // This implements window.frames.length, since window.frames returns a
  // self reference to the window object.  This value is incremented in the
  // HTMLFrameElement implementation.
  this._length = 0;

  ///// SELECTION

  // https://w3c.github.io/selection-api/#dfn-selection
  this._selection = Selection.createImpl(window);

  // https://w3c.github.io/selection-api/#dom-window
  this.getSelection = function () {
    return window._selection;
  };

  ///// GETTERS

  const customElementRegistry = CustomElementRegistry.create(window);

  define(this, {
    get length() {
      return window._length;
    },
    get window() {
      return window._globalProxy;
    },
    get frameElement() {
      return idlUtils.wrapperForImpl(window._frameElement);
    },
    get frames() {
      return window._globalProxy;
    },
    get self() {
      return window._globalProxy;
    },
    get parent() {
      return window._parent;
    },
    get top() {
      return window._top;
    },
    get document() {
      return window._document;
    },
    get location() {
      return idlUtils.wrapperForImpl(idlUtils.implForWrapper(window._document)._location);
    },
    get origin() {
      return window._origin;
    },
    // The origin IDL attribute is defined with [Replaceable].
    set origin(value) {
      Object.defineProperty(this, "origin", {
        value,
        writable: true,
        enumerable: true,
        configurable: true
      });
    },
    get customElements() {
      return customElementRegistry;
    }
  });

  namedPropertiesWindow.initializeWindow(this, this._globalProxy);

  ///// METHODS

  function Option(text, value, defaultSelected, selected) {
    if (text === undefined) {
      text = "";
    }
    text = webIDLConversions.DOMString(text);

    if (value !== undefined) {
      value = webIDLConversions.DOMString(value);
    }

    defaultSelected = webIDLConversions.boolean(defaultSelected);
    selected = webIDLConversions.boolean(selected);

    const option = window._document.createElement("option");
    const impl = idlUtils.implForWrapper(option);

    if (text !== "") {
      impl.text = text;
    }
    if (value !== undefined) {
      impl.setAttributeNS(null, "value", value);
    }
    if (defaultSelected) {
      impl.setAttributeNS(null, "selected", "");
    }
    impl._selectedness = selected;

    return option;
  }
  Object.defineProperty(Option, "prototype", {
    value: this.HTMLOptionElement.prototype,
    configurable: false,
    enumerable: false,
    writable: false
  });
  Object.defineProperty(window, "Option", {
    value: Option,
    configurable: true,
    enumerable: false,
    writable: true
  });

  this.getComputedStyle = function (elt) {
    elt = Element.convert(elt);

    const declaration = new CSSStyleDeclaration();
    const { forEach } = Array.prototype;
    const { style } = elt;

    forEachMatchingSheetRuleOfElement(elt, rule => {
      forEach.call(rule.style, property => {
        declaration.setProperty(
          property,
          rule.style.getPropertyValue(property),
          rule.style.getPropertyPriority(property)
        );
      });
    });

    // https://drafts.csswg.org/cssom/#dom-window-getcomputedstyle
    const declarations = Object.keys(propertiesWithResolvedValueImplemented);
    forEach.call(declarations, property => {
      declaration.setProperty(property, getResolvedValue(elt, property));
    });

    forEach.call(style, property => {
      declaration.setProperty(property, style.getPropertyValue(property), style.getPropertyPriority(property));
    });

    return declaration;
  };

  this.getSelection = function () {
    return window._document.getSelection();
  };

  ///// PUBLIC DATA PROPERTIES (TODO: should be getters)

  function notImplementedMethod(name) {
    return function () {
      notImplemented(name, window);
    };
  }

  define(this, {
    name: "",
    status: "",
    devicePixelRatio: 1,
    innerWidth: 1024,
    innerHeight: 768,
    outerWidth: 1024,
    outerHeight: 768,
    pageXOffset: 0,
    pageYOffset: 0,
    screenX: 0,
    screenLeft: 0,
    screenY: 0,
    screenTop: 0,
    scrollX: 0,
    scrollY: 0,

    alert: notImplementedMethod("window.alert"),
    blur: notImplementedMethod("window.blur"),
    confirm: notImplementedMethod("window.confirm"),
    focus: notImplementedMethod("window.focus"),
    moveBy: notImplementedMethod("window.moveBy"),
    moveTo: notImplementedMethod("window.moveTo"),
    open: notImplementedMethod("window.open"),
    print: notImplementedMethod("window.print"),
    prompt: notImplementedMethod("window.prompt"),
    resizeBy: notImplementedMethod("window.resizeBy"),
    resizeTo: notImplementedMethod("window.resizeTo"),
    scroll: notImplementedMethod("window.scroll"),
    scrollBy: notImplementedMethod("window.scrollBy"),
    scrollTo: notImplementedMethod("window.scrollTo")
  });

}
