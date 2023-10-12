'use strict';

Hooks.on('preUpdateToken', (tdoc, changes, options, userId) => {
  if (!game.users.get(userId) || (!changes.x && !changes.y)) return;
  const sourcePos = {x: tdoc.x, y: tdoc.y};
  const targetPos = {x: changes.x, y: changes.y};
  if (!targetPos.x) targetPos.x = sourcePos.x;
  if (!targetPos.x) targetPos.y = sourcePos.y;
  const ray = new Ray(sourcePos, targetPos);
  if (CONFIG.Canvas.polygonBackends.move.testCollision(ray.A,ray.B,{mode:'any',type: 'move'})) options.animate = false;
});
