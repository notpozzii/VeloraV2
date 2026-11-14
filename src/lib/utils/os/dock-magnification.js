// Keep the dock's anchor fixed while neighboring slots share a smooth wave.
export function dockMagnification(node, { enabled = true } = {}) {
  const host = node.ownerDocument.defaultView;
  const doc = node.ownerDocument;
  const motion = host.matchMedia('(prefers-reduced-motion: reduce)');
  let items = [];
  let pointer = null;
  let animation = 0;
  let lastTime = 0;
  let leaveTimer;
  let baseWidth = 0;
  let padding = 0;
  let lastHeight = 0;
  const number = value => Number.parseFloat(value) || 0;

  function measure() {
    const previous = new Map(items.map(item => [item.node, item]));
    items = [...node.querySelectorAll('.dock-wave-item')].map(slot => ({
      node: slot, value: previous.get(slot)?.value || 0,
      velocity: previous.get(slot)?.velocity || 0, base: slot.offsetHeight
    }));
    const content = node.querySelector('.dock-content');
    const children = [...content.children].filter(child => host.getComputedStyle(child).position !== 'absolute');
    baseWidth = Math.max(0, children.length - 1) * number(host.getComputedStyle(content).columnGap);
    for (const child of children) {
      const style = host.getComputedStyle(child);
      const slots = items.filter(item => item.node === child || child.contains(item.node));
      baseWidth += slots.length
        ? slots.reduce((sum, item) => sum + item.base, 0) + Math.max(0, slots.length - 1) * number(style.columnGap)
        : child.getBoundingClientRect().width;
      baseWidth += number(style.marginLeft) + number(style.marginRight);
    }
    const style = host.getComputedStyle(node);
    padding = number(style.paddingLeft) + number(style.paddingRight) + number(style.borderLeftWidth) + number(style.borderRightWidth);
    node.classList.toggle('dock-wave-ready', enabled && !motion.matches && baseWidth + padding < host.innerWidth - 28);
    schedule();
  }

  function schedule() {
    if (!animation && enabled && !motion.matches) animation = host.requestAnimationFrame(draw);
  }
  function draw(time) {
    animation = 0;
    const dt = Math.min(lastTime ? (time - lastTime) / 1000 : 1 / 60, 0.05);
    lastTime = time;
    const available = Math.max(0, host.innerWidth - 28 - padding - baseWidth);
    const active = pointer !== null && available > 0 && !doc.pointerLockElement;
    const centers = items.map(item => {
      const rect = item.node.getBoundingClientRect();
      return rect.left + rect.width / 2;
    });
    let moving = false;
    for (const [index, item] of items.entries()) {
      const radius = Math.max(110, item.base * 2.8);
      const distance = active ? Math.abs(pointer - centers[index]) / radius : 1;
      const target = distance < 1 ? Math.cos(distance * Math.PI / 2) ** 2 : 0;
      // Analytic critically damped spring: stable even when a frame is late.
      const delta = item.value - target;
      const decay = Math.exp(-24 * dt);
      const offset = (item.velocity + 24 * delta) * dt;
      item.value = target + (delta + offset) * decay;
      item.velocity = (item.velocity - 24 * offset) * decay;
      if (Math.abs(item.value - target) < 0.0005 && Math.abs(item.velocity) < 0.005) {
        item.value = target; item.velocity = 0;
      } else moving = true;
    }
    const requested = items.reduce((sum, item) => sum + item.base * item.value, 0);
    const gain = requested ? Math.min(0.55, available / requested) : 0.55;
    for (const item of items) {
      item.node.style.setProperty('--dock-scale', (1 + gain * item.value).toFixed(4));
      item.node.style.setProperty('--dock-lift', (7 * item.value * gain / 0.55).toFixed(2) + 'px');
    }
    if (moving) schedule();
    else lastTime = 0;
  }
  function move(event) {
    if (event.pointerType !== 'mouse') return;
    clearTimeout(leaveTimer);
    pointer = event.clientX;
    schedule();
  }
  function enter(event) { if (event.pointerType === 'mouse') { measure(); move(event); } }
  function leave() {
    clearTimeout(leaveTimer);
    leaveTimer = host.setTimeout(() => { pointer = null; schedule(); }, 32);
  }
  function reset() {
    clearTimeout(leaveTimer);
    host.cancelAnimationFrame(animation);
    animation = 0; lastTime = 0; pointer = null;
    for (const item of items) {
      item.value = item.velocity = 0;
      item.node.style.removeProperty('--dock-scale');
      item.node.style.removeProperty('--dock-lift');
    }
  }
  function motionChanged() { reset(); measure(); }
  function visibilityChanged() { if (doc.hidden) reset(); }
  const mutation = new host.MutationObserver(measure);
  mutation.observe(node, { childList: true, subtree: true });
  const resize = new host.ResizeObserver(() => {
    const height = node.getBoundingClientRect().height;
    if (height !== lastHeight) { lastHeight = height; measure(); }
  });
  resize.observe(node);
  node.addEventListener('pointerenter', enter);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerleave', leave);
  node.addEventListener('pointercancel', reset);
  host.addEventListener('resize', measure);
  host.addEventListener('blur', reset);
  doc.addEventListener('visibilitychange', visibilityChanged);
  doc.addEventListener('pointerlockchange', reset);
  motion.addEventListener('change', motionChanged);
  measure();
  return {
    update(options) {
      enabled = options.enabled;
      if (!enabled) reset();
      measure();
    },
    destroy() {
      reset(); mutation.disconnect(); resize.disconnect();
      node.classList.remove('dock-wave-ready');
      node.removeEventListener('pointerenter', enter);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerleave', leave);
      node.removeEventListener('pointercancel', reset);
      host.removeEventListener('resize', measure);
      host.removeEventListener('blur', reset);
      doc.removeEventListener('visibilitychange', visibilityChanged);
      doc.removeEventListener('pointerlockchange', reset);
      motion.removeEventListener('change', motionChanged);
    }
  };
}
