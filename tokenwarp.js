'use strict';

Hooks.on('preUpdateToken', (tdoc, changes, options, userId) => {
  if (!game.users.get(userId).isGM || (!changes.x && !changes.y) || options.animate === false) return;
  const sourceCenter = tdoc.object.center;
  const targetPos = {x: changes.x ??= tdoc.x, y: changes.y ??= tdoc.y};
  const offset = {x: sourceCenter.x - tdoc.x, y: sourceCenter.y - tdoc.y};
  const targetCenter = {x: targetPos.x + offset.x, y: targetPos.y + offset.y};
  const ray = new Ray(sourceCenter, targetCenter);
  if (CONFIG.Canvas.polygonBackends.move.testCollision(ray.A,ray.B,{mode:'any',type: 'move'})) options.animate = false;
});
