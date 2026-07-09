// jsdom doesn't implement scrollIntoView (every real browser does) — stub it so
// components that keep the active item in view can run under tests.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
